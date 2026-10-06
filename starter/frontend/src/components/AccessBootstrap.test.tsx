import { render, screen, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import AccessBootstrap from './AccessBootstrap';
import { useAccessStore } from '../store/accessStore';
import { apiUrl, server } from '../test/server';
import { meAccess, tenantModules } from '../test/accessFixtures';

const auth = vi.hoisted(() => ({
  value: { isAuthenticated: true, isLoading: false, user: { id: 'u1' } as { id: string } | null, logout: vi.fn() },
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth.value }));

describe('AccessBootstrap', () => {
  beforeEach(() => {
    useAccessStore.getState().reset();
    auth.value = { isAuthenticated: true, isLoading: false, user: { id: 'u1' }, logout: vi.fn() };
  });

  it('carga el acceso al restaurar la sesión y luego muestra la app', async () => {
    let calls = 0;
    server.use(
      http.get(apiUrl('/auth/me/access'), () => {
        calls += 1;
        return HttpResponse.json(meAccess(tenantModules()));
      }),
    );
    render(<AccessBootstrap><div>APP</div></AccessBootstrap>);
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
    expect(await screen.findByText('APP')).toBeInTheDocument();
    expect(calls).toBe(1);
    expect(useAccessStore.getState().can('projects')).toBe(true);
  });

  it('sin sesión no pide nada, limpia permisos y deja pasar a login/landing', async () => {
    auth.value = { isAuthenticated: false, isLoading: false, user: null, logout: vi.fn() };
    useAccessStore.setState({ status: 'ready' });
    render(<AccessBootstrap><div>PUBLICO</div></AccessBootstrap>);
    expect(await screen.findByText('PUBLICO')).toBeInTheDocument();
    await waitFor(() => expect(useAccessStore.getState().status).toBe('idle'));
  });

  it('error al cargar: ofrece reintentar y cerrar sesión', async () => {
    server.use(http.get(apiUrl('/auth/me/access'), () => HttpResponse.json({ error: 'x' }, { status: 500 })));
    render(<AccessBootstrap><div>APP</div></AccessBootstrap>);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar tus permisos');
    expect(screen.queryByText('APP')).toBeNull();

    server.use(http.get(apiUrl('/auth/me/access'), () => HttpResponse.json(meAccess(tenantModules()))));
    await act(async () => {
      screen.getByRole('button', { name: 'Reintentar' }).click();
    });
    expect(await screen.findByText('APP')).toBeInTheDocument();
  });

  it('refresca al volver a la pestaña si pasó más de un minuto', async () => {
    let calls = 0;
    server.use(
      http.get(apiUrl('/auth/me/access'), () => {
        calls += 1;
        return HttpResponse.json(meAccess(tenantModules()));
      }),
    );
    render(<AccessBootstrap><div>APP</div></AccessBootstrap>);
    await screen.findByText('APP');
    expect(calls).toBe(1);

    document.dispatchEvent(new Event('visibilitychange'));
    expect(calls).toBe(1); // reciente: no refresca

    useAccessStore.setState({ loadedAt: Date.now() - 120_000 });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(calls).toBe(2));
  });
});
