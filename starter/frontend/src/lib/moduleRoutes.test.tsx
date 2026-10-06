import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { buildModuleRoutes } from './moduleRoutes';
import type { RegistryEntry } from './moduleRegistry';
import { useAccessStore } from '../store/accessStore';
import { meAccess, mod, tenantModules } from '../test/accessFixtures';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { id: 'u', email: 'a@b.co', full_name: 'A', role: 'FORMULADOR', tenant_id: 't' },
    logout: vi.fn(),
  }),
}));

const registry: Record<string, RegistryEntry> = {
  projects: { routes: [{ path: 'projects', Component: () => <div>PROYECTOS</div> }, { path: 'formulation', redirectTo: '/tenant/projects' }] },
  catalog: { routes: [{ path: 'catalog', Component: () => <div>CATALOGO</div> }] },
  reports: { routes: [{ path: 'reports', Component: () => <div>REPORTES</div> }] },
};

function renderRoutes(path: string, modules = tenantModules()) {
  const state = useAccessStore.getState();
  const byCode = Object.fromEntries(modules.map((m) => [m.code, m]));
  useAccessStore.setState({ status: 'ready', access: meAccess(modules), byCode, can: state.can });
  const nav = modules.filter((m) => m.enabled && m.permissions.view);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/tenant">{buildModuleRoutes(nav, registry)}</Route>
        <Route path="*" element={<div>NO-ENCONTRADA</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('buildModuleRoutes', () => {
  beforeEach(() => {
    useAccessStore.getState().reset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('inyecta las rutas de los módulos visibles', () => {
    renderRoutes('/tenant/projects');
    expect(screen.getByText('PROYECTOS')).toBeInTheDocument();
  });

  it('soporta redirecciones declaradas en el registro', () => {
    renderRoutes('/tenant/formulation');
    expect(screen.getByText('PROYECTOS')).toBeInTheDocument();
  });

  it('un módulo que el usuario no ve no tiene ruta', () => {
    renderRoutes('/tenant/reports', tenantModules({ reports: { enabled: false } }));
    expect(screen.getByText('NO-ENCONTRADA')).toBeInTheDocument();
    expect(screen.queryByText('REPORTES')).toBeNull();
  });

  it('módulos sin registro se omiten sin romper el resto', () => {
    renderRoutes('/tenant/catalog', [...tenantModules(), mod('algo.futuro', 'Futuro', '/tenant/futuro')]);
    expect(screen.getByText('CATALOGO')).toBeInTheDocument();
  });

  it('cada módulo queda protegido por su guard: si el permiso se revoca, deja de renderizar', () => {
    const { unmount } = renderRoutes('/tenant/catalog');
    expect(screen.getByText('CATALOGO')).toBeInTheDocument();
    unmount();
    // Tras un refresco del acceso, el guard (leyendo el store) niega la página.
    const modules = tenantModules({ catalog: { enabled: false } });
    const byCode = Object.fromEntries(modules.map((m) => [m.code, m]));
    useAccessStore.setState({ byCode, nav: { TENANT: modules, PLATFORM: [] } });
    render(
      <MemoryRouter initialEntries={['/tenant/catalog']}>
        <Routes>
          <Route path="/tenant">{buildModuleRoutes(tenantModules(), registry)}</Route>
          <Route path="*" element={<div>NO-ENCONTRADA</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByText('CATALOGO')).toBeNull();
  });
});
