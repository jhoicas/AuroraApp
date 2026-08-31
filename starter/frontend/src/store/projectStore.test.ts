import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { act } from '@testing-library/react';
import { apiUrl, errorResponse, server } from '../test/server';
import { useProjectStore, type EvaluationResult, type Project } from './projectStore';

const initialState = useProjectStore.getState();
const store = () => useProjectStore.getState();

beforeEach(() => {
  useProjectStore.setState(initialState, true);
});

const project = (overrides: Partial<Project> = {}): Project => ({
  id: 'proj-1',
  tenant_id: 'tenant-1',
  creator_id: 'user-1',
  name: 'Acueducto rural',
  status: 'DRAFT',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const budgetItem = (id: string) => ({
  id,
  tenant_id: 'tenant-1',
  project_id: 'proj-1',
  description: `Ítem ${id}`,
  amount: 1000,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

describe('projectStore — fetchProjects', () => {
  it('carga la lista paginada', async () => {
    server.use(
      http.get(apiUrl('/projects'), () =>
        HttpResponse.json({ data: [project()], page: 1, page_size: 100, total: 1, total_pages: 1 }),
      ),
    );

    await act(async () => {
      await store().fetchProjects();
    });

    expect(store().projects).toHaveLength(1);
    expect(store().isLoading).toBe(false);
    expect(store().error).toBeNull();
  });

  it('activa isLoading mientras la petición está en vuelo', async () => {
    server.use(
      http.get(apiUrl('/projects'), async () => {
        await delay(40);
        return HttpResponse.json({ data: [], page: 1, page_size: 100, total: 0, total_pages: 1 });
      }),
    );

    let pending!: Promise<void>;
    act(() => {
      pending = store().fetchProjects();
    });

    expect(store().isLoading).toBe(true);

    await act(async () => {
      await pending;
    });

    expect(store().isLoading).toBe(false);
  });

  it('tolera una respuesta sin data', async () => {
    server.use(http.get(apiUrl('/projects'), () => HttpResponse.json({})));

    await act(async () => {
      await store().fetchProjects();
    });

    expect(store().projects).toEqual([]);
  });

  it('registra el error del backend sin lanzar excepción', async () => {
    server.use(http.get(apiUrl('/projects'), () => errorResponse(500, 'db caída')));

    await act(async () => {
      await store().fetchProjects();
    });

    expect(store().error).toBe('db caída');
    expect(store().isLoading).toBe(false);
  });

  it('usa el mensaje de fallback si el error no es estructurado', async () => {
    server.use(http.get(apiUrl('/projects'), () => new HttpResponse('boom', { status: 503 })));

    await act(async () => {
      await store().fetchProjects();
    });

    expect(store().error).toBe('No se pudieron cargar los proyectos');
  });
});

describe('projectStore — createProject', () => {
  it('recorta los campos y antepone el proyecto a la lista', async () => {
    let body: Record<string, string> | null = null;
    server.use(
      http.post(apiUrl('/projects'), async ({ request }) => {
        body = (await request.json()) as Record<string, string>;
        return HttpResponse.json(project({ id: 'proj-nuevo' }));
      }),
    );

    useProjectStore.setState({ projects: [project({ id: 'proj-viejo' })] });

    let created: Project | undefined;
    await act(async () => {
      created = await store().createProject({
        name: '  Acueducto  ',
        sector: '  40  ',
        description: '  Descripción  ',
        code_bpin: '  2026001  ',
      });
    });

    expect(body).toEqual({
      name: 'Acueducto',
      sector: '40',
      description: 'Descripción',
      code_bpin: '2026001',
    });
    expect(created?.id).toBe('proj-nuevo');
    expect(store().projects.map((p) => p.id)).toEqual(['proj-nuevo', 'proj-viejo']);
    expect(store().currentProject?.id).toBe('proj-nuevo');
    expect(store().isLoading).toBe(false);
  });

  it('omite description y code_bpin cuando llegan vacíos', async () => {
    let body: Record<string, string> | null = null;
    server.use(
      http.post(apiUrl('/projects'), async ({ request }) => {
        body = (await request.json()) as Record<string, string>;
        return HttpResponse.json(project());
      }),
    );

    await act(async () => {
      await store().createProject({ name: 'A', sector: '40', description: '   ', code_bpin: '  ' });
    });

    expect(body).toEqual({ name: 'A', sector: '40' });
  });

  it('lanza el error del backend y lo deja en el estado', async () => {
    server.use(http.post(apiUrl('/projects'), () => errorResponse(409, 'BPIN duplicado')));

    await expect(store().createProject({ name: 'A', sector: '40' })).rejects.toThrow('BPIN duplicado');
    expect(store().error).toBe('BPIN duplicado');
    expect(store().isLoading).toBe(false);
    expect(store().projects).toEqual([]);
  });
});

describe('projectStore — fetchProjectById', () => {
  it('fija el proyecto actual', async () => {
    server.use(http.get(apiUrl('/projects/proj-1'), () => HttpResponse.json(project())));

    let loaded: Project | undefined;
    await act(async () => {
      loaded = await store().fetchProjectById('proj-1');
    });

    expect(loaded?.id).toBe('proj-1');
    expect(store().currentProject?.id).toBe('proj-1');
    expect(store().isLoading).toBe(false);
  });

  it('limpia el proyecto actual y lanza el error', async () => {
    server.use(http.get(apiUrl('/projects/proj-1'), () => errorResponse(404, 'project not found')));
    useProjectStore.setState({ currentProject: project() });

    await expect(store().fetchProjectById('proj-1')).rejects.toThrow('project not found');
    expect(store().currentProject).toBeNull();
    expect(store().error).toBe('project not found');
  });
});

describe('projectStore — updateProjectDetails', () => {
  it('recorta los textos y sincroniza la lista', async () => {
    let body: Record<string, string> | null = null;
    const updated = project({ problem_description: 'Problema', general_objective: 'Objetivo' });

    server.use(
      http.patch(apiUrl('/projects/proj-1/details'), async ({ request }) => {
        body = (await request.json()) as Record<string, string>;
        return HttpResponse.json(updated);
      }),
    );

    useProjectStore.setState({ projects: [project(), project({ id: 'otro' })] });

    await act(async () => {
      await store().updateProjectDetails('proj-1', {
        problem_description: '  Problema  ',
        general_objective: '  Objetivo  ',
        situacion_existente: '  Situación  ',
        magnitud_problema: '  Magnitud  ',
      });
    });

    expect(body).toEqual({
      problem_description: 'Problema',
      general_objective: 'Objetivo',
      situacion_existente: 'Situación',
      magnitud_problema: 'Magnitud',
    });
    expect(store().currentProject?.problem_description).toBe('Problema');
    expect(store().projects[0].general_objective).toBe('Objetivo');
    expect(store().projects[1].id).toBe('otro');
    expect(store().isSaving).toBe(false);
  });

  it('usa el flag isSaving durante la petición', async () => {
    server.use(
      http.patch(apiUrl('/projects/proj-1/details'), async () => {
        await delay(40);
        return HttpResponse.json(project());
      }),
    );

    let pending!: Promise<Project>;
    act(() => {
      pending = store().updateProjectDetails('proj-1', {
        problem_description: 'p',
        general_objective: 'o',
        situacion_existente: '',
        magnitud_problema: '',
      });
    });

    expect(store().isSaving).toBe(true);

    await act(async () => {
      await pending;
    });

    expect(store().isSaving).toBe(false);
  });

  it('lanza el error y libera isSaving', async () => {
    server.use(http.patch(apiUrl('/projects/proj-1/details'), () => errorResponse(400, 'texto inválido')));

    await expect(
      store().updateProjectDetails('proj-1', {
        problem_description: 'p',
        general_objective: 'o',
        situacion_existente: '',
        magnitud_problema: '',
      }),
    ).rejects.toThrow('texto inválido');
    expect(store().isSaving).toBe(false);
    expect(store().error).toBe('texto inválido');
  });
});

describe('projectStore — presupuesto', () => {
  it('fetchBudget carga los ítems', async () => {
    server.use(
      http.get(apiUrl('/projects/proj-1/budget'), () => HttpResponse.json([budgetItem('b-1')])),
    );

    await act(async () => {
      await store().fetchBudget('proj-1');
    });

    expect(store().budget).toHaveLength(1);
    expect(store().isLoading).toBe(false);
  });

  it('fetchBudget tolera un payload que no es array', async () => {
    server.use(http.get(apiUrl('/projects/proj-1/budget'), () => HttpResponse.json({ nope: 1 })));

    await act(async () => {
      await store().fetchBudget('proj-1');
    });

    expect(store().budget).toEqual([]);
  });

  it('fetchBudget registra el error y vacía la lista', async () => {
    server.use(http.get(apiUrl('/projects/proj-1/budget'), () => errorResponse(500, 'presupuesto caído')));
    useProjectStore.setState({ budget: [budgetItem('previo')] });

    await act(async () => {
      await store().fetchBudget('proj-1');
    });

    expect(store().error).toBe('presupuesto caído');
    expect(store().budget).toEqual([]);
  });

  it('addBudgetItem añade el ítem al final', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(apiUrl('/projects/proj-1/budget'), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(budgetItem('b-2'));
      }),
    );

    useProjectStore.setState({ budget: [budgetItem('b-1')] });

    await act(async () => {
      await store().addBudgetItem('proj-1', { description: '  Obra civil  ', amount: 500 });
    });

    expect(body).toEqual({ description: 'Obra civil', amount: 500 });
    expect(store().budget.map((b) => b.id)).toEqual(['b-1', 'b-2']);
    expect(store().isSaving).toBe(false);
  });

  it('addBudgetItem incluye product_id cuando se proporciona', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(apiUrl('/projects/proj-1/budget'), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(budgetItem('b-2'));
      }),
    );

    await act(async () => {
      await store().addBudgetItem('proj-1', {
        description: 'Obra',
        amount: 100,
        product_id: 'prod-9',
      });
    });

    expect(body).toMatchObject({ product_id: 'prod-9' });
  });

  it('addBudgetItem lanza el error del backend', async () => {
    server.use(http.post(apiUrl('/projects/proj-1/budget'), () => errorResponse(400, 'monto inválido')));

    await expect(
      store().addBudgetItem('proj-1', { description: 'x', amount: -1 }),
    ).rejects.toThrow('monto inválido');
    expect(store().isSaving).toBe(false);
  });

  it('deleteBudgetItem elimina solo el ítem indicado', async () => {
    server.use(
      http.delete(apiUrl('/projects/proj-1/budget/b-1'), () => new HttpResponse(null, { status: 204 })),
    );

    useProjectStore.setState({ budget: [budgetItem('b-1'), budgetItem('b-2')] });

    await act(async () => {
      await store().deleteBudgetItem('proj-1', 'b-1');
    });

    expect(store().budget.map((b) => b.id)).toEqual(['b-2']);
    expect(store().error).toBeNull();
  });

  it('deleteBudgetItem lanza el error y conserva la lista', async () => {
    server.use(http.delete(apiUrl('/projects/proj-1/budget/b-1'), () => errorResponse(403, 'sin permisos')));
    useProjectStore.setState({ budget: [budgetItem('b-1')] });

    await expect(store().deleteBudgetItem('proj-1', 'b-1')).rejects.toThrow('sin permisos');
    expect(store().budget).toHaveLength(1);
    expect(store().error).toBe('sin permisos');
  });
});

describe('projectStore — evaluación financiera', () => {
  const evaluations: EvaluationResult[] = [
    { alternative_name: 'Red por gravedad', discount_rate: 0.1, cash_flows: [-1000, 400, 400, 400], vpn: -5.26, tir: 0.0964 },
    { alternative_name: 'Bombeo', discount_rate: 0.1, cash_flows: [100, 100], vpn: 190.9, tir: null },
  ];

  it('evaluateProject devuelve los resultados y refresca el resumen', async () => {
    let summaryCalls = 0;
    server.use(
      http.post(apiUrl('/projects/proj-1/evaluate'), () => HttpResponse.json({ evaluations })),
      http.get(apiUrl('/projects/evaluations/summary'), () => {
        summaryCalls += 1;
        return HttpResponse.json({
          data: [
            { project_id: 'proj-1', alternative_name: 'Red por gravedad', vpn: -5.26, tir: 0.0964, created_at: '2026-01-01T00:00:00Z' },
          ],
        });
      }),
    );

    let results: EvaluationResult[] = [];
    await act(async () => {
      results = await store().evaluateProject('proj-1', {
        discount_rate: 0.1,
        alternatives: [{ name: 'Red por gravedad', cash_flows: [-1000, 400, 400, 400] }],
      });
    });

    expect(results).toHaveLength(2);
    expect(results[0].tir).toBeCloseTo(0.0964, 4);
    expect(results[1].tir).toBeNull();
    expect(summaryCalls).toBe(1);
    expect(store().evaluationSummary).toHaveLength(1);
    expect(store().isSaving).toBe(false);
  });

  it('evaluateProject tolera respuesta sin evaluations', async () => {
    server.use(http.post(apiUrl('/projects/proj-1/evaluate'), () => HttpResponse.json({})));

    let results: unknown;
    await act(async () => {
      results = await store().evaluateProject('proj-1', { discount_rate: 0.1, alternatives: [] });
    });

    expect(results).toEqual([]);
  });

  it('evaluateProject lanza el error del backend', async () => {
    server.use(http.post(apiUrl('/projects/proj-1/evaluate'), () => errorResponse(400, 'tasa inválida')));

    await expect(
      store().evaluateProject('proj-1', { discount_rate: 5, alternatives: [] }),
    ).rejects.toThrow('tasa inválida');
    expect(store().isSaving).toBe(false);
    expect(store().error).toBe('tasa inválida');
  });

  it('fetchEvaluationSummary usa el límite por defecto', async () => {
    let params: URLSearchParams | null = null;
    server.use(
      http.get(apiUrl('/projects/evaluations/summary'), ({ request }) => {
        params = new URL(request.url).searchParams;
        return HttpResponse.json({ data: [] });
      }),
    );

    await act(async () => {
      await store().fetchEvaluationSummary();
    });

    expect(params!.get('limit')).toBe('20');
  });

  it('fetchEvaluationSummary respeta un límite personalizado', async () => {
    let params: URLSearchParams | null = null;
    server.use(
      http.get(apiUrl('/projects/evaluations/summary'), ({ request }) => {
        params = new URL(request.url).searchParams;
        return HttpResponse.json({ data: [] });
      }),
    );

    await act(async () => {
      await store().fetchEvaluationSummary(5);
    });

    expect(params!.get('limit')).toBe('5');
  });

  it('fetchEvaluationSummary registra el error sin lanzar', async () => {
    server.use(
      http.get(apiUrl('/projects/evaluations/summary'), () => errorResponse(500, 'resumen caído')),
    );

    await act(async () => {
      await store().fetchEvaluationSummary();
    });

    expect(store().error).toBe('resumen caído');
  });

  it('fetchEvaluationSummary tolera respuesta sin data', async () => {
    server.use(http.get(apiUrl('/projects/evaluations/summary'), () => HttpResponse.json({})));

    await act(async () => {
      await store().fetchEvaluationSummary();
    });

    expect(store().evaluationSummary).toEqual([]);
  });
});

describe('projectStore — limpieza', () => {
  it('clearError limpia el error', () => {
    useProjectStore.setState({ error: 'boom' });
    act(() => store().clearError());
    expect(store().error).toBeNull();
  });

  it('clearCurrentProject limpia proyecto y presupuesto', () => {
    useProjectStore.setState({ currentProject: project(), budget: [budgetItem('b-1')] });
    act(() => store().clearCurrentProject());
    expect(store().currentProject).toBeNull();
    expect(store().budget).toEqual([]);
  });
});
