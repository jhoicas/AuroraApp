import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { act, renderHook } from '@testing-library/react';
import { apiUrl, errorResponse, server } from '../test/server';
import {
  COPILOT_CATALOG_ROUTES,
  useAuroraCopilotStore,
  useCopilotSearchSync,
} from './auroraCopilotStore';
import { useCatalogStore } from './catalogStore';

const initialState = useAuroraCopilotStore.getState();

const resetStore = () => {
  useAuroraCopilotStore.setState(
    {
      ...initialState,
      isOpen: false,
      messages: [],
      isTyping: false,
      error: null,
      sessionId: null,
      abortController: null,
      draftInput: '',
    },
    true,
  );
};

const store = () => useAuroraCopilotStore.getState();

describe('auroraCopilotStore — control del panel', () => {
  beforeEach(resetStore);

  it('arranca cerrado y sin mensajes', () => {
    expect(store().isOpen).toBe(false);
    expect(store().messages).toEqual([]);
    expect(store().isTyping).toBe(false);
    expect(store().error).toBeNull();
    expect(store().sessionId).toBeNull();
  });

  it('toggleOpen alterna el panel y limpia el error', () => {
    useAuroraCopilotStore.setState({ error: 'error previo' });

    act(() => store().toggleOpen());
    expect(store().isOpen).toBe(true);
    expect(store().error).toBeNull();

    act(() => store().toggleOpen());
    expect(store().isOpen).toBe(false);
  });

  it('open limpia el error y close lo conserva', () => {
    useAuroraCopilotStore.setState({ error: 'boom' });

    act(() => store().open());
    expect(store().isOpen).toBe(true);
    expect(store().error).toBeNull();

    useAuroraCopilotStore.setState({ error: 'otro' });
    act(() => store().close());
    expect(store().isOpen).toBe(false);
    expect(store().error).toBe('otro');
  });

  it('clearError limpia el mensaje de error', () => {
    useAuroraCopilotStore.setState({ error: 'boom' });
    act(() => store().clearError());
    expect(store().error).toBeNull();
  });

  it('askAurora abre el panel e inyecta el prompt en draftInput', () => {
    act(() => store().askAurora('¿Cómo redacto el problema central?'));
    expect(store().isOpen).toBe(true);
    expect(store().draftInput).toBe('¿Cómo redacto el problema central?');
  });

  it('appendToDraft concatena sin duplicar espacios innecesarios', () => {
    act(() => store().setDraftInput('Consulta sobre'));
    act(() => store().appendToDraft('"Nodo A" (Problema)'));
    expect(store().draftInput).toBe('Consulta sobre "Nodo A" (Problema)');
  });
});

describe('auroraCopilotStore — clearChat (reinicio seguro)', () => {
  beforeEach(resetStore);

  it('limpia historial, session_id, error e isTyping', () => {
    useAuroraCopilotStore.setState({
      messages: [
        { id: 'u-1', role: 'user', content: 'hola' },
        { id: 'a-1', role: 'assistant', content: 'respuesta' },
      ],
      sessionId: 'session-abc',
      error: 'fallo previo',
      isTyping: true,
    });

    act(() => store().clearChat());

    expect(store().messages).toEqual([]);
    expect(store().sessionId).toBeNull();
    expect(store().error).toBeNull();
    expect(store().isTyping).toBe(false);
    expect(store().abortController).toBeNull();
  });

  it('aborta una generación en curso sin dejar residuos', async () => {
    server.use(
      http.post(apiUrl('/ai/aurora/chat'), async () => {
        await delay(200);
        return HttpResponse.json({
          reply: 'tarde',
          action_cards: [],
          model: 'm',
          session_id: 's',
          user_message_id: 'u',
          assistant_message_id: 'a',
        });
      }),
    );

    let pending!: Promise<void>;
    act(() => {
      pending = store().sendMessage('hola', '/dashboard');
    });

    expect(store().isTyping).toBe(true);
    expect(store().messages).toHaveLength(1);

    act(() => store().clearChat());

    await act(async () => {
      await pending;
    });

    expect(store().messages).toEqual([]);
    expect(store().sessionId).toBeNull();
    expect(store().isTyping).toBe(false);
    expect(store().abortController).toBeNull();
    expect(store().error).toBeNull();
  });

  it('es idempotente cuando el chat ya está vacío', () => {
    act(() => store().clearChat());
    act(() => store().clearChat());

    expect(store().messages).toEqual([]);
    expect(store().sessionId).toBeNull();
  });

  it('tras clearChat, el siguiente mensaje inicia una sesión nueva', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    useAuroraCopilotStore.setState({ sessionId: 'session-vieja' });

    server.use(
      http.post(apiUrl('/ai/aurora/chat'), async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          reply: 'nueva conversación',
          action_cards: [],
          model: 'm',
          session_id: 'session-nueva',
          user_message_id: 'u',
          assistant_message_id: 'a',
        });
      }),
    );

    act(() => store().clearChat());

    await act(async () => {
      await store().sendMessage('reinicio', '/dashboard');
    });

    expect(bodies[0]).not.toHaveProperty('session_id');
    expect(store().sessionId).toBe('session-nueva');
    expect(store().messages).toHaveLength(2);
  });
});

describe('auroraCopilotStore — sendMessage', () => {
  beforeEach(resetStore);

  it('ignora mensajes vacíos o solo espacios', async () => {
    await act(async () => {
      await store().sendMessage('   ', '/dashboard');
    });

    expect(store().messages).toHaveLength(0);
    expect(store().isTyping).toBe(false);
  });

  it('añade el mensaje del usuario y la respuesta con action cards', async () => {
    server.use(
      http.post(apiUrl('/ai/aurora/chat'), () =>
        HttpResponse.json({
          reply: 'El ODS 6.1 aplica a tu acueducto.',
          action_cards: [
            { catalog: 'ods', code: '6.1', label: 'Agua limpia', description: 'Meta ODS' },
          ],
          model: 'claude-haiku-4-5-20251001',
          session_id: 'session-abc',
          user_message_id: 'u-1',
          assistant_message_id: 'a-1',
        }),
      ),
    );

    await act(async () => {
      await store().sendMessage('  ¿Qué ODS aplica?  ', '/admin/catalogs/ods');
    });

    const { messages, isTyping, error, sessionId, abortController } = store();
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: 'user', content: '¿Qué ODS aplica?' });
    expect(messages[1]).toMatchObject({
      id: 'a-1',
      role: 'assistant',
      content: 'El ODS 6.1 aplica a tu acueducto.',
    });
    expect(messages[1].actionCards).toEqual([
      { catalog: 'ods', code: '6.1', label: 'Agua limpia', description: 'Meta ODS' },
    ]);
    expect(isTyping).toBe(false);
    expect(error).toBeNull();
    expect(sessionId).toBe('session-abc');
    expect(abortController).toBeNull();
  });

  it('marca isTyping mientras espera la respuesta', async () => {
    server.use(
      http.post(apiUrl('/ai/aurora/chat'), async () => {
        await delay(40);
        return HttpResponse.json({
          reply: 'listo',
          action_cards: [],
          model: 'claude-haiku-4-5-20251001',
          session_id: 's',
          user_message_id: 'u',
          assistant_message_id: 'a',
        });
      }),
    );

    let pending!: Promise<void>;
    act(() => {
      pending = store().sendMessage('hola', '/dashboard');
    });

    expect(store().isTyping).toBe(true);
    expect(store().abortController).toBeInstanceOf(AbortController);
    expect(store().messages).toHaveLength(1);

    await act(async () => {
      await pending;
    });

    expect(store().isTyping).toBe(false);
  });

  it('reenvía el session_id en las llamadas siguientes', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(apiUrl('/ai/aurora/chat'), async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          reply: 'ok',
          action_cards: [],
          model: 'm',
          session_id: 'session-fija',
          user_message_id: 'u',
          assistant_message_id: 'a',
        });
      }),
    );

    await act(async () => {
      await store().sendMessage('primera', '/dashboard');
    });
    await act(async () => {
      await store().sendMessage('segunda', '/dashboard');
    });

    expect(bodies[0]).not.toHaveProperty('session_id');
    expect(bodies[1]).toMatchObject({ session_id: 'session-fija', message: 'segunda' });
  });

  it('genera un id de fallback si el backend no devuelve assistant_message_id', async () => {
    server.use(
      http.post(apiUrl('/ai/aurora/chat'), () =>
        HttpResponse.json({
          reply: 'sin id',
          action_cards: [],
          model: 'm',
          session_id: 's',
          user_message_id: '',
          assistant_message_id: '',
        }),
      ),
    );

    await act(async () => {
      await store().sendMessage('hola', '/dashboard');
    });

    expect(store().messages[1].id).toMatch(/^assistant-\d+$/);
  });

  it('tolera action_cards ausente en la respuesta', async () => {
    server.use(
      http.post(apiUrl('/ai/aurora/chat'), () =>
        HttpResponse.json({
          reply: 'sin tarjetas',
          model: 'm',
          session_id: 's',
          user_message_id: 'u',
          assistant_message_id: 'a',
        }),
      ),
    );

    await act(async () => {
      await store().sendMessage('hola', '/dashboard');
    });

    expect(store().messages[1].actionCards).toEqual([]);
  });

  it.each([
    { status: 400, body: 'mensaje demasiado largo', expected: 'mensaje demasiado largo' },
    { status: 401, body: 'invalid user', expected: 'invalid user' },
    { status: 429, body: 'rate limit exceeded', expected: 'rate limit exceeded' },
    { status: 502, body: 'no se pudo contactar a Aurora', expected: 'no se pudo contactar a Aurora' },
  ])('propaga el error $status del backend', async ({ status, body, expected }) => {
    server.use(http.post(apiUrl('/ai/aurora/chat'), () => errorResponse(status, body)));

    await act(async () => {
      await store().sendMessage('hola', '/dashboard');
    });

    expect(store().error).toBe(expected);
    expect(store().isTyping).toBe(false);
    expect(store().abortController).toBeNull();
    expect(store().messages).toHaveLength(1);
  });

  it('usa el mensaje de fallback cuando el error no trae cuerpo estructurado', async () => {
    server.use(
      http.post(apiUrl('/ai/aurora/chat'), () => new HttpResponse('boom', { status: 500 })),
    );

    await act(async () => {
      await store().sendMessage('hola', '/dashboard');
    });

    expect(store().error).toContain('Aurora no pudo responder');
  });

  it('usa el fallback ante un fallo de red', async () => {
    server.use(http.post(apiUrl('/ai/aurora/chat'), () => HttpResponse.error()));

    await act(async () => {
      await store().sendMessage('hola', '/dashboard');
    });

    expect(store().error).toContain('Aurora no pudo responder');
    expect(store().isTyping).toBe(false);
  });
});

describe('auroraCopilotStore — cancelación (AbortController)', () => {
  beforeEach(resetStore);

  it('cancelGeneration aborta la petición sin registrar error', async () => {
    server.use(
      http.post(apiUrl('/ai/aurora/chat'), async () => {
        await delay(200);
        return HttpResponse.json({
          reply: 'tarde',
          action_cards: [],
          model: 'm',
          session_id: 's',
          user_message_id: 'u',
          assistant_message_id: 'a',
        });
      }),
    );

    let pending!: Promise<void>;
    act(() => {
      pending = store().sendMessage('hola', '/dashboard');
    });

    act(() => store().cancelGeneration());

    await act(async () => {
      await pending;
    });

    expect(store().isTyping).toBe(false);
    expect(store().abortController).toBeNull();
    expect(store().error).toBeNull();
    expect(store().messages).toHaveLength(1);
  });

  it('cancelGeneration sin generación activa no rompe nada', () => {
    act(() => store().cancelGeneration());
    expect(store().isTyping).toBe(false);
    expect(store().abortController).toBeNull();
  });

  it('un nuevo sendMessage aborta la generación anterior', async () => {
    let resolveFirst: (() => void) | null = null;
    const firstStarted = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    server.use(
      http.post(apiUrl('/ai/aurora/chat'), async ({ request }) => {
        const body = (await request.json()) as { message: string };
        if (body.message === 'primera') {
          resolveFirst?.();
          await delay(200);
        }
        return HttpResponse.json({
          reply: `respuesta a ${body.message}`,
          action_cards: [],
          model: 'm',
          session_id: 's',
          user_message_id: 'u',
          assistant_message_id: `a-${body.message}`,
        });
      }),
    );

    let first!: Promise<void>;
    act(() => {
      first = store().sendMessage('primera', '/dashboard');
    });
    await firstStarted;

    let second!: Promise<void>;
    act(() => {
      second = store().sendMessage('segunda', '/dashboard');
    });

    await act(async () => {
      await Promise.all([first, second]);
    });

    // Ambos mensajes de usuario están, pero solo llegó la respuesta de la segunda.
    const assistantMessages = store().messages.filter((m) => m.role === 'assistant');
    expect(assistantMessages).toHaveLength(1);
    expect(assistantMessages[0].content).toBe('respuesta a segunda');
    expect(store().error).toBeNull();
  });
});

describe('useCopilotSearchSync', () => {
  beforeEach(() => {
    resetStore();
    useCatalogStore.setState({ copilotSearch: null });
  });

  it('aplica la búsqueda del copiloto al catálogo correspondiente y la consume', () => {
    const applied: string[] = [];
    useCatalogStore.getState().applyCopilotSearch('ods', '  6.1  ');

    renderHook(() => useCopilotSearchSync('ods', (q) => applied.push(q)));

    expect(applied).toEqual(['6.1']);
    expect(useCatalogStore.getState().copilotSearch).toBeNull();
  });

  it('ignora búsquedas dirigidas a otro catálogo', () => {
    const applied: string[] = [];
    useCatalogStore.getState().applyCopilotSearch('products', 'P-01');

    renderHook(() => useCopilotSearchSync('ods', (q) => applied.push(q)));

    expect(applied).toEqual([]);
    expect(useCatalogStore.getState().copilotSearch).toEqual({
      catalog: 'products',
      query: 'P-01',
    });
  });

  it('ignora una búsqueda con query vacía', () => {
    const applied: string[] = [];
    useCatalogStore.getState().applyCopilotSearch('ods', '   ');

    renderHook(() => useCopilotSearchSync('ods', (q) => applied.push(q)));

    expect(applied).toEqual([]);
  });

  it('no hace nada cuando no hay búsqueda pendiente', () => {
    const applied: string[] = [];
    renderHook(() => useCopilotSearchSync('ods', (q) => applied.push(q)));
    expect(applied).toEqual([]);
  });
});

describe('COPILOT_CATALOG_ROUTES', () => {
  it('mapea cada catálogo del copiloto a su ruta de administración', () => {
    expect(COPILOT_CATALOG_ROUTES).toEqual({
      ods: '/admin/catalogs/ods',
      products: '/admin/catalogs/products',
      sectors: '/admin/catalogs/sectors',
      programs: '/admin/catalogs/programs',
      edt: '/admin/catalogs/edt',
      deliverables: '/admin/catalogs/deliverables',
      activities: '/admin/catalogs/activities',
    });
  });
});
