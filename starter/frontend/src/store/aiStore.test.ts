import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { act } from '@testing-library/react';
import { apiUrl, errorResponse, server } from '../test/server';
import { useAIStore } from './aiStore';

const initialState = useAIStore.getState();
const store = () => useAIStore.getState();

beforeEach(() => {
  useAIStore.setState(initialState, true);
});

const historyUrl = apiUrl('/ai/projects/proj-1/history');

describe('aiStore — fetchHistory', () => {
  it('carga el historial filtrando roles desconocidos', async () => {
    server.use(
      http.get(historyUrl, () =>
        HttpResponse.json({
          data: [
            { id: 'm-1', role: 'user', content: 'Hola', created_at: '2026-01-01T00:00:00Z' },
            { id: 'm-2', role: 'assistant', content: 'Buenas', created_at: '2026-01-01T00:01:00Z' },
            { id: 'm-3', role: 'system', content: 'ignorar', created_at: '2026-01-01T00:02:00Z' },
          ],
        }),
      ),
    );

    await act(async () => {
      await store().fetchHistory('proj-1');
    });

    expect(store().messages.map((m) => m.id)).toEqual(['m-1', 'm-2']);
    expect(store().error).toBeNull();
  });

  it('envía los parámetros de paginación', async () => {
    let params: URLSearchParams | null = null;
    server.use(
      http.get(historyUrl, ({ request }) => {
        params = new URL(request.url).searchParams;
        return HttpResponse.json({ data: [] });
      }),
    );

    await act(async () => {
      await store().fetchHistory('proj-1');
    });

    expect(params!.get('page')).toBe('1');
    expect(params!.get('page_size')).toBe('100');
  });

  it('tolera respuesta sin data', async () => {
    server.use(http.get(historyUrl, () => HttpResponse.json({})));

    await act(async () => {
      await store().fetchHistory('proj-1');
    });

    expect(store().messages).toEqual([]);
  });

  it('registra el error y vacía los mensajes', async () => {
    server.use(http.get(historyUrl, () => errorResponse(500, 'historial caído')));
    useAIStore.setState({ messages: [{ id: 'previo', role: 'user', content: 'x' }] });

    await act(async () => {
      await store().fetchHistory('proj-1');
    });

    expect(store().error).toBe('historial caído');
    expect(store().messages).toEqual([]);
  });

  it('usa el fallback si el error no es estructurado', async () => {
    server.use(http.get(historyUrl, () => new HttpResponse('boom', { status: 503 })));

    await act(async () => {
      await store().fetchHistory('proj-1');
    });

    expect(store().error).toBe('No se pudo cargar el historial del chat');
  });
});

describe('aiStore — sendMessage', () => {
  it('ignora mensajes vacíos', async () => {
    await act(async () => {
      await store().sendMessage('proj-1', '   ');
    });

    expect(store().messages).toEqual([]);
    expect(store().isTyping).toBe(false);
  });

  it('reemplaza el mensaje optimista por los ids reales del backend', async () => {
    let body: Record<string, string> | null = null;
    server.use(
      http.post(apiUrl('/ai/chat'), async ({ request }) => {
        body = (await request.json()) as Record<string, string>;
        return HttpResponse.json({
          reply: 'Respuesta del asistente',
          model: 'claude-haiku-4-5-20251001',
          user_message_id: 'u-real',
          assistant_message_id: 'a-real',
        });
      }),
    );

    await act(async () => {
      await store().sendMessage('proj-1', '  ¿Cómo formulo?  ');
    });

    expect(body).toEqual({ message: '¿Cómo formulo?', project_id: 'proj-1' });
    expect(store().messages.map((m) => m.id)).toEqual(['u-real', 'a-real']);
    expect(store().messages[1].content).toBe('Respuesta del asistente');
    expect(store().isTyping).toBe(false);
  });

  it('muestra el mensaje optimista mientras espera', async () => {
    server.use(
      http.post(apiUrl('/ai/chat'), async () => {
        await delay(40);
        return HttpResponse.json({
          reply: 'ok',
          model: 'm',
          user_message_id: 'u',
          assistant_message_id: 'a',
        });
      }),
    );

    let pending!: Promise<void>;
    act(() => {
      pending = store().sendMessage('proj-1', 'hola');
    });

    expect(store().isTyping).toBe(true);
    expect(store().messages).toHaveLength(1);
    expect(store().messages[0].id).toMatch(/^temp-user-/);

    await act(async () => {
      await pending;
    });

    expect(store().isTyping).toBe(false);
  });

  it('marca rateLimited ante un 429 sin lanzar excepción', async () => {
    server.use(http.post(apiUrl('/ai/chat'), () => errorResponse(429, 'rate limit exceeded')));

    await act(async () => {
      await store().sendMessage('proj-1', 'hola');
    });

    expect(store().rateLimited).toBe(true);
    expect(store().error).toContain('límite de mensajes');
    expect(store().messages).toEqual([]);
    expect(store().isTyping).toBe(false);
  });

  it('elimina el mensaje optimista y relanza el error en otros fallos', async () => {
    server.use(http.post(apiUrl('/ai/chat'), () => errorResponse(500, 'anthropic caído')));

    await expect(store().sendMessage('proj-1', 'hola')).rejects.toBeDefined();

    expect(store().error).toBe('anthropic caído');
    expect(store().rateLimited).toBe(false);
    expect(store().messages).toEqual([]);
    expect(store().isTyping).toBe(false);
  });

  it('conserva los mensajes previos al fallar', async () => {
    server.use(http.post(apiUrl('/ai/chat'), () => errorResponse(500, 'boom')));
    useAIStore.setState({ messages: [{ id: 'anterior', role: 'assistant', content: 'previo' }] });

    await expect(store().sendMessage('proj-1', 'hola')).rejects.toBeDefined();

    expect(store().messages.map((m) => m.id)).toEqual(['anterior']);
  });
});

describe('aiStore — limpieza', () => {
  it('clearError limpia error y rateLimited', () => {
    useAIStore.setState({ error: 'boom', rateLimited: true });
    act(() => store().clearError());
    expect(store().error).toBeNull();
    expect(store().rateLimited).toBe(false);
  });

  it('clearMessages vacía la conversación completa', () => {
    useAIStore.setState({
      messages: [{ id: 'm', role: 'user', content: 'x' }],
      error: 'boom',
      rateLimited: true,
    });

    act(() => store().clearMessages());

    expect(store().messages).toEqual([]);
    expect(store().error).toBeNull();
    expect(store().rateLimited).toBe(false);
  });
});
