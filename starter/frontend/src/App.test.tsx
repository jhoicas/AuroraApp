import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import App from './App';
import { apiUrl, server } from './test/server';
import { seedAuthUser } from './test/renderWithProviders';
import { useAccessStore } from './store/accessStore';
import { meAccess, platformModules, tenantModules } from './test/accessFixtures';

vi.mock('./components/AuroraAsistente/FloatingAssistant', () => ({ default: () => null }));

function go(path: string) {
  window.history.pushState({}, '', path);
}

describe('App con rutas y menú dinámicos', () => {
  beforeEach(() => {
    useAccessStore.getState().reset();
  });
  afterEach(() => go('/'));

  it('FORMULADOR: carga el acceso, arma el menú y entra a /tenant/projects', async () => {
    seedAuthUser({ role: 'FORMULADOR', tenant_id: 'tenant-1' });
    server.use(http.get(apiUrl('/auth/me/access'), () => HttpResponse.json(meAccess(tenantModules()))));
    go('/tenant');

    render(<App />);

    expect(await screen.findByRole('heading', { level: 2, name: 'Proyectos' })).toBeInTheDocument();
    expect(screen.getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual([
      '/tenant/projects', '/tenant/catalog', '/tenant/ai', '/tenant/reports',
    ]);
    await waitFor(() => expect(window.location.pathname).toBe('/tenant/projects'));
  });

  it('un módulo revocado por el servidor desaparece del menú y su ruta redirige', async () => {
    seedAuthUser({ role: 'FORMULADOR', tenant_id: 'tenant-1' });
    server.use(
      http.get(apiUrl('/auth/me/access'), () =>
        HttpResponse.json(meAccess(tenantModules({ reports: { enabled: false } }))),
      ),
    );
    go('/tenant/reports');

    render(<App />);

    expect(await screen.findByRole('heading', { level: 2, name: 'Proyectos' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Reportes/ })).toBeNull();
    expect(window.location.pathname).not.toBe('/tenant/reports');
  });

  it('SUPER_ADMIN: menú de plataforma desde el árbol y título del módulo activo', async () => {
    seedAuthUser({ role: 'SUPER_ADMIN', tenant_id: null });
    server.use(
      http.get(apiUrl('/auth/me/access'), () =>
        HttpResponse.json(meAccess(platformModules(), { role: 'SUPER_ADMIN', is_super_admin: true, tenant_id: undefined })),
      ),
      http.get(apiUrl('/admin/tenants'), () =>
        HttpResponse.json({ data: [], page: 1, page_size: 10, total: 0, total_pages: 1 }),
      ),
    );
    go('/admin');

    render(<App />);

    expect(await screen.findByRole('heading', { level: 2, name: 'Gestión de Tenants' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Catálogos Maestros/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Catálogos MGA/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Gestión IA Aurora/ })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/admin/tenants');
  });

  it('si el acceso no carga, muestra el error con reintento (sin menús ni rutas)', async () => {
    seedAuthUser({ role: 'FORMULADOR', tenant_id: 'tenant-1' });
    server.use(http.get(apiUrl('/auth/me/access'), () => HttpResponse.json({ error: 'x' }, { status: 500 })));
    go('/tenant/projects');

    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar tus permisos');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
