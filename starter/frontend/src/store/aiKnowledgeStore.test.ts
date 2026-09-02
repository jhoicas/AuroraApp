import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { act } from '@testing-library/react';
import { apiUrl, errorResponse, server } from '../test/server';
import {
  nodeTypeColors,
  nodeTypeLabels,
  relationshipLabels,
  useAiKnowledgeStore,
} from './aiKnowledgeStore';

const initialState = useAiKnowledgeStore.getState();
const store = () => useAiKnowledgeStore.getState();

beforeEach(() => {
  useAiKnowledgeStore.setState(initialState, true);
});

const graph = {
  nodes: [{ id: 'n-1', label: 'Proyecto', type: 'project', group: 'acueducto' }],
  links: [{ source: 'n-1', target: 'n-2', relationship: 'has_cause' }],
};

const summary = {
  project_key: 'acueducto',
  project_name: 'Acueducto Test',
  nodes_created: 8,
  links_created: 7,
  alternatives: 1,
  products: 1,
  activities: 1,
  causes: 1,
  effects: 1,
  central_problem: true,
  specific_objective: false,
  message: 'Se aprendieron 1 alternativas...',
};

const xmlFile = () => new File(['<MGAProject/>'], 'proyecto.xml', { type: 'text/xml' });

describe('aiKnowledgeStore — fetchGraph', () => {
  it('carga el grafo y registra telemetría', async () => {
    let telemetryAction: string | null = null;

    server.use(
      http.get(apiUrl('/ai/knowledge/graph'), () => HttpResponse.json(graph)),
      http.post(apiUrl('/ai/telemetry/log'), async ({ request }) => {
        telemetryAction = ((await request.json()) as { action: string }).action;
        return HttpResponse.json({ ok: true });
      }),
    );

    await act(async () => {
      await store().fetchGraph();
      // La telemetría es fire-and-forget: se deja avanzar el event loop.
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(store().graph).toEqual(graph);
    expect(store().loadingGraph).toBe(false);
    expect(store().error).toBeNull();
    expect(telemetryAction).toBe('view_graph');
  });

  it('marca loadingGraph durante la carga', async () => {
    server.use(
      http.get(apiUrl('/ai/knowledge/graph'), async () => {
        await delay(40);
        return HttpResponse.json(graph);
      }),
      http.post(apiUrl('/ai/telemetry/log'), () => HttpResponse.json({ ok: true })),
    );

    let pending!: Promise<void>;
    act(() => {
      pending = store().fetchGraph();
    });
    expect(store().loadingGraph).toBe(true);

    await act(async () => {
      await pending;
    });
    expect(store().loadingGraph).toBe(false);
  });

  it('registra el error del backend', async () => {
    server.use(
      http.get(apiUrl('/ai/knowledge/graph'), () => errorResponse(500, 'grafo caído')),
    );

    await act(async () => {
      await store().fetchGraph();
    });

    expect(store().error).toBe('grafo caído');
    expect(store().loadingGraph).toBe(false);
    expect(store().graph).toBeNull();
  });

  it('usa el fallback si el error no es estructurado', async () => {
    server.use(
      http.get(apiUrl('/ai/knowledge/graph'), () => new HttpResponse('boom', { status: 500 })),
    );

    await act(async () => {
      await store().fetchGraph();
    });

    expect(store().error).toBe('No se pudo cargar el grafo de conocimiento');
  });

  it('no falla si la telemetría está caída', async () => {
    server.use(
      http.get(apiUrl('/ai/knowledge/graph'), () => HttpResponse.json(graph)),
      http.post(apiUrl('/ai/telemetry/log'), () => errorResponse(500, 'telemetría caída')),
    );

    await act(async () => {
      await store().fetchGraph();
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(store().graph).toEqual(graph);
    expect(store().error).toBeNull();
  });
});

describe('aiKnowledgeStore — ingestXml', () => {
  it('sube el XML y recarga el grafo', async () => {
    let contentType: string | null = null;
    let graphCalls = 0;

    server.use(
      http.post(apiUrl('/ai/knowledge/ingest'), async ({ request }) => {
        contentType = request.headers.get('content-type');
        const form = await request.formData();
        expect(form.has('file')).toBe(true);
        return HttpResponse.json(summary, { status: 201 });
      }),
      http.get(apiUrl('/ai/knowledge/graph'), () => {
        graphCalls += 1;
        return HttpResponse.json(graph);
      }),
      http.post(apiUrl('/ai/telemetry/log'), () => HttpResponse.json({ ok: true })),
    );

    let result: unknown;
    await act(async () => {
      result = await store().ingestXml(xmlFile());
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(contentType).toContain('multipart/form-data');
    expect(result).toMatchObject({ project_name: 'Acueducto Test', nodes_created: 8 });
    expect(store().lastIngest).toMatchObject({ project_key: 'acueducto' });
    expect(store().ingesting).toBe(false);
    expect(graphCalls).toBe(1);
    expect(store().graph).toEqual(graph);
  });

  it('marca ingesting durante la subida', async () => {
    server.use(
      http.post(apiUrl('/ai/knowledge/ingest'), async () => {
        await delay(40);
        return HttpResponse.json(summary, { status: 201 });
      }),
      http.get(apiUrl('/ai/knowledge/graph'), () => HttpResponse.json(graph)),
      http.post(apiUrl('/ai/telemetry/log'), () => HttpResponse.json({ ok: true })),
    );

    let pending!: Promise<unknown>;
    act(() => {
      pending = store().ingestXml(xmlFile());
    });
    expect(store().ingesting).toBe(true);

    await act(async () => {
      await pending;
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(store().ingesting).toBe(false);
  });

  it('lanza el error del backend ante un XML corrupto', async () => {
    server.use(
      http.post(apiUrl('/ai/knowledge/ingest'), () => errorResponse(400, 'parse xml: EOF inesperado')),
    );

    await expect(store().ingestXml(xmlFile())).rejects.toThrow('parse xml: EOF inesperado');
    expect(store().error).toBe('parse xml: EOF inesperado');
    expect(store().ingesting).toBe(false);
    expect(store().lastIngest).toBeNull();
  });

  it('usa el fallback si el error no es estructurado', async () => {
    server.use(
      http.post(apiUrl('/ai/knowledge/ingest'), () => new HttpResponse('boom', { status: 500 })),
    );

    await expect(store().ingestXml(xmlFile())).rejects.toThrow('Error al ingerir el XML MGA');
  });

  it('muestra mensaje amigable ante duplicado (409)', async () => {
    server.use(
      http.post(apiUrl('/ai/knowledge/ingest'), () =>
        errorResponse(409, "El proyecto con BPIN/Clave 'acueducto-test' ya existe en la base de conocimiento y no puede ser duplicado."),
      ),
    );

    await expect(store().ingestXml(xmlFile())).rejects.toThrow(
      'Error: Este proyecto ya ha sido procesado e ingresado al Knowledge Graph anteriormente.',
    );
    expect(store().error).toBe(
      'Error: Este proyecto ya ha sido procesado e ingresado al Knowledge Graph anteriormente.',
    );
    expect(store().ingesting).toBe(false);
  });
});

describe('aiKnowledgeStore — telemetría y limpieza', () => {
  it('logTelemetry no propaga errores', async () => {
    server.use(http.post(apiUrl('/ai/telemetry/log'), () => errorResponse(500, 'caído')));
    await expect(store().logTelemetry('apply_action_card')).resolves.toBeUndefined();
  });

  it('logTelemetry envía la acción', async () => {
    let action: string | null = null;
    server.use(
      http.post(apiUrl('/ai/telemetry/log'), async ({ request }) => {
        action = ((await request.json()) as { action: string }).action;
        return HttpResponse.json({ ok: true });
      }),
    );

    await store().logTelemetry('ingest_xml');
    expect(action).toBe('ingest_xml');
  });

  it('clearError limpia el error', () => {
    useAiKnowledgeStore.setState({ error: 'boom' });
    act(() => store().clearError());
    expect(store().error).toBeNull();
  });
});

describe('aiKnowledgeStore — diccionarios de presentación', () => {
  it('asigna un color a cada tipo de nodo MGA', () => {
    expect(Object.keys(nodeTypeColors)).toEqual(
      expect.arrayContaining([
        'project',
        'central_problem',
        'cause',
        'effect',
        'specific_objective',
        'alternative',
        'product',
        'activity',
      ]),
    );
    expect(nodeTypeColors.central_problem).toBe('#dc2626');
    expect(nodeTypeColors.alternative).toBe('#16a34a');
  });

  it('etiqueta en español cada tipo de nodo y relación', () => {
    expect(nodeTypeLabels.central_problem).toBe('Problema central');
    expect(nodeTypeLabels.activity).toBe('Actividad');
    expect(relationshipLabels.has_cause).toBe('tiene causa');
    expect(relationshipLabels.has_activity).toBe('tiene actividad');
  });

  it('cubre todos los tipos de nodo con color y etiqueta', () => {
    expect(Object.keys(nodeTypeColors).sort()).toEqual(Object.keys(nodeTypeLabels).sort());
  });
});
