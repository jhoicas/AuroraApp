import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { apiUrl, server } from '../test/server';
import {
  api,
  clearStoredToken,
  getStoredRefreshToken,
  getStoredToken,
  setStoredRefreshToken,
  setStoredToken,
  setUnauthorizedHandler,
} from './api';

beforeEach(() => {
  localStorage.clear();
  setUnauthorizedHandler(() => {});
});

describe('api — persistencia de tokens', () => {
  it('guarda y recupera el access token', () => {
    expect(getStoredToken()).toBeNull();
    setStoredToken('access-123');
    expect(getStoredToken()).toBe('access-123');
  });

  it('guarda y recupera el refresh token', () => {
    expect(getStoredRefreshToken()).toBeNull();
    setStoredRefreshToken('refresh-123');
    expect(getStoredRefreshToken()).toBe('refresh-123');
  });

  it('clearStoredToken borra ambos tokens', () => {
    setStoredToken('access-123');
    setStoredRefreshToken('refresh-123');

    clearStoredToken();

    expect(getStoredToken()).toBeNull();
    expect(getStoredRefreshToken()).toBeNull();
  });
});

describe('api — interceptor de request', () => {
  it('inyecta el header Authorization cuando hay token', async () => {
    setStoredToken('access-123');

    let auth: string | null = null;
    server.use(
      http.get(apiUrl('/ping'), ({ request }) => {
        auth = request.headers.get('authorization');
        return HttpResponse.json({ ok: true });
      }),
    );

    await api.get('/ping');
    expect(auth).toBe('Bearer access-123');
  });

  it('no envía Authorization cuando no hay token', async () => {
    let auth: string | null = 'presente';
    server.use(
      http.get(apiUrl('/ping'), ({ request }) => {
        auth = request.headers.get('authorization');
        return HttpResponse.json({ ok: true });
      }),
    );

    await api.get('/ping');
    expect(auth).toBeNull();
  });

  it('usa Content-Type application/json por defecto', async () => {
    let contentType: string | null = null;
    server.use(
      http.post(apiUrl('/ping'), ({ request }) => {
        contentType = request.headers.get('content-type');
        return HttpResponse.json({ ok: true });
      }),
    );

    await api.post('/ping', { a: 1 });
    expect(contentType).toContain('application/json');
  });
});

describe('api — renovación automática de token (401)', () => {
  it('renueva el token y reintenta la petición original', async () => {
    setStoredToken('access-viejo');
    setStoredRefreshToken('refresh-valido');

    const authHeaders: (string | null)[] = [];
    let refreshBody: Record<string, string> | null = null;

    server.use(
      http.get(apiUrl('/protegido'), ({ request }) => {
        const auth = request.headers.get('authorization');
        authHeaders.push(auth);
        if (auth === 'Bearer access-nuevo') {
          return HttpResponse.json({ ok: true });
        }
        return HttpResponse.json({ error: 'invalid or expired token' }, { status: 401 });
      }),
      http.post(apiUrl('/auth/refresh'), async ({ request }) => {
        refreshBody = (await request.json()) as Record<string, string>;
        return HttpResponse.json({ token: 'access-nuevo', refresh_token: 'refresh-nuevo' });
      }),
    );

    const { data } = await api.get('/protegido');

    expect(data).toEqual({ ok: true });
    expect(refreshBody).toEqual({ refresh_token: 'refresh-valido' });
    expect(authHeaders).toEqual(['Bearer access-viejo', 'Bearer access-nuevo']);
    expect(getStoredToken()).toBe('access-nuevo');
    expect(getStoredRefreshToken()).toBe('refresh-nuevo');
  });

  it('comparte una única renovación entre peticiones concurrentes', async () => {
    setStoredToken('access-viejo');
    setStoredRefreshToken('refresh-valido');

    let refreshCalls = 0;
    server.use(
      http.get(apiUrl('/a'), ({ request }) =>
        request.headers.get('authorization') === 'Bearer access-nuevo'
          ? HttpResponse.json({ from: 'a' })
          : HttpResponse.json({ error: 'expired' }, { status: 401 }),
      ),
      http.get(apiUrl('/b'), ({ request }) =>
        request.headers.get('authorization') === 'Bearer access-nuevo'
          ? HttpResponse.json({ from: 'b' })
          : HttpResponse.json({ error: 'expired' }, { status: 401 }),
      ),
      http.post(apiUrl('/auth/refresh'), async () => {
        refreshCalls += 1;
        await delay(30);
        return HttpResponse.json({ token: 'access-nuevo', refresh_token: 'refresh-nuevo' });
      }),
    );

    const [a, b] = await Promise.all([api.get('/a'), api.get('/b')]);

    expect(a.data).toEqual({ from: 'a' });
    expect(b.data).toEqual({ from: 'b' });
    expect(refreshCalls).toBe(1);
  });

  it('cierra sesión cuando no hay refresh token almacenado', async () => {
    setStoredToken('access-viejo');
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    server.use(
      http.get(apiUrl('/protegido'), () => HttpResponse.json({ error: 'expired' }, { status: 401 })),
    );

    await expect(api.get('/protegido')).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(getStoredToken()).toBeNull();
  });

  it('cierra sesión cuando el refresh es rechazado por el backend', async () => {
    setStoredToken('access-viejo');
    setStoredRefreshToken('refresh-expirado');
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    server.use(
      http.get(apiUrl('/protegido'), () => HttpResponse.json({ error: 'expired' }, { status: 401 })),
      http.post(apiUrl('/auth/refresh'), () =>
        HttpResponse.json({ error: 'invalid refresh token' }, { status: 401 }),
      ),
    );

    await expect(api.get('/protegido')).rejects.toMatchObject({ response: { status: 401 } });

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(getStoredToken()).toBeNull();
    expect(getStoredRefreshToken()).toBeNull();
  });

  it('cierra sesión cuando el endpoint de refresh falla por red', async () => {
    setStoredToken('access-viejo');
    setStoredRefreshToken('refresh-valido');
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    server.use(
      http.get(apiUrl('/protegido'), () => HttpResponse.json({ error: 'expired' }, { status: 401 })),
      http.post(apiUrl('/auth/refresh'), () => HttpResponse.error()),
    );

    await expect(api.get('/protegido')).rejects.toBeDefined();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('no reintenta más de una vez la misma petición', async () => {
    setStoredToken('access-viejo');
    setStoredRefreshToken('refresh-valido');

    let protectedCalls = 0;
    let refreshCalls = 0;

    server.use(
      // Devuelve 401 siempre: el token renovado tampoco sirve.
      http.get(apiUrl('/protegido'), () => {
        protectedCalls += 1;
        return HttpResponse.json({ error: 'expired' }, { status: 401 });
      }),
      http.post(apiUrl('/auth/refresh'), () => {
        refreshCalls += 1;
        return HttpResponse.json({ token: 'access-nuevo', refresh_token: 'refresh-nuevo' });
      }),
    );

    await expect(api.get('/protegido')).rejects.toMatchObject({ response: { status: 401 } });

    expect(protectedCalls).toBe(2);
    expect(refreshCalls).toBe(1);
  });

  it('funciona sin handler de logout registrado', async () => {
    setStoredToken('access-viejo');
    setUnauthorizedHandler(undefined as unknown as () => void);

    server.use(
      http.get(apiUrl('/protegido'), () => HttpResponse.json({ error: 'expired' }, { status: 401 })),
    );

    await expect(api.get('/protegido')).rejects.toMatchObject({ response: { status: 401 } });
  });
});

describe('api — otros códigos de error', () => {
  it('registra un aviso ante un 403 y propaga el error', async () => {
    // El setup silencia console.warn; aquí restauramos el spy para asertar la llamada.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    server.use(
      http.get(apiUrl('/admin'), () => HttpResponse.json({ error: 'insufficient role' }, { status: 403 })),
    );

    await expect(api.get('/admin')).rejects.toMatchObject({ response: { status: 403 } });
    expect(warn).toHaveBeenCalledWith('Forbidden:', expect.stringContaining('/admin'));
  });

  it('propaga un 500 sin intentar renovar el token', async () => {
    setStoredRefreshToken('refresh-valido');
    let refreshCalls = 0;

    server.use(
      http.get(apiUrl('/boom'), () => HttpResponse.json({ error: 'db caída' }, { status: 500 })),
      http.post(apiUrl('/auth/refresh'), () => {
        refreshCalls += 1;
        return HttpResponse.json({ token: 't', refresh_token: 'r' });
      }),
    );

    await expect(api.get('/boom')).rejects.toMatchObject({ response: { status: 500 } });
    expect(refreshCalls).toBe(0);
  });

  it('propaga errores de red', async () => {
    server.use(http.get(apiUrl('/offline'), () => HttpResponse.error()));
    await expect(api.get('/offline')).rejects.toBeDefined();
  });

  it('propaga un 429 de rate limit', async () => {
    server.use(
      http.get(apiUrl('/limited'), () =>
        HttpResponse.json({ error: 'rate limit exceeded' }, { status: 429 }),
      ),
    );

    await expect(api.get('/limited')).rejects.toMatchObject({
      response: { status: 429, data: { error: 'rate limit exceeded' } },
    });
  });
});
