import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { useAccessStore } from '../store/accessStore';
import { meAccess, tenantModules } from '../test/accessFixtures';

const auth = vi.hoisted(() => ({
  value: {
    isAuthenticated: true,
    isLoading: false,
    user: { id: 'u1', email: 'a@b.co', full_name: 'A', role: 'FORMULADOR', tenant_id: 't1' } as {
      id: string; email: string; full_name: string; role: string; tenant_id: string | null;
    } | null,
    logout: vi.fn(),
  },
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth.value }));

function setAccess(overrides: Parameters<typeof tenantModules>[0] = {}) {
  const modules = tenantModules(overrides);
  const state = useAccessStore.getState();
  useAccessStore.setState({
    status: 'ready',
    access: meAccess(modules),
    byCode: Object.fromEntries(modules.flatMap((m) => [[m.code, m], ...(m.children ?? []).map((c) => [c.code, c])])),
    nav: { TENANT: modules.filter((m) => m.permissions.view && m.enabled), PLATFORM: [] },
    can: state.can,
  });
}

function renderAt(path: string, route: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>LOGIN</div>} />
        {/* El guard envuelve una sola ruta: el destino de la redirección queda fuera de él. */}
        <Route element={route}>
          <Route path="/tenant/reports" element={<div>REPORTES</div>} />
          <Route path="/tenant/guarded-projects" element={<div>PROYECTOS-GUARDADO</div>} />
          <Route path="/tenant/guarded-catalog" element={<div>CATALOGO</div>} />
        </Route>
        <Route path="/tenant/projects" element={<div>PROYECTOS</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute con módulo y acción', () => {
  beforeEach(() => {
    useAccessStore.getState().reset();
    auth.value.isAuthenticated = true;
    auth.value.isLoading = false;
    auth.value.user = { id: 'u1', email: 'a@b.co', full_name: 'A', role: 'FORMULADOR', tenant_id: 't1' };
  });

  it('permite el paso si el módulo está habilitado y permite la acción (view por defecto)', () => {
    setAccess();
    renderAt('/tenant/reports', <ProtectedRoute module="reports" />);
    expect(screen.getByText('REPORTES')).toBeInTheDocument();
  });

  it('exige la acción indicada', () => {
    setAccess(); // reports: solo view
    renderAt('/tenant/reports', <ProtectedRoute module="reports" action="edit" />);
    expect(screen.queryByText('REPORTES')).toBeNull();
  });

  it('módulo deshabilitado ⇒ redirige al primer módulo navegable', () => {
    setAccess({ reports: { enabled: false } });
    renderAt('/tenant/reports', <ProtectedRoute module="reports" />);
    expect(screen.getByText('PROYECTOS')).toBeInTheDocument();
  });

  it('sin ningún destino navegable muestra "sin acceso" en vez de entrar en bucle', () => {
    setAccess({ reports: { enabled: false } });
    useAccessStore.setState({ nav: { TENANT: [], PLATFORM: [] } });
    renderAt('/tenant/reports', <ProtectedRoute module="reports" />);
    expect(screen.getByRole('alert')).toHaveTextContent('No tienes acceso');
  });

  it('no autenticado ⇒ /login', () => {
    auth.value.isAuthenticated = false;
    auth.value.user = null;
    setAccess();
    renderAt('/tenant/reports', <ProtectedRoute module="reports" />);
    expect(screen.getByText('LOGIN')).toBeInTheDocument();
  });

  it('allowedRoles se mantiene por retrocompatibilidad', () => {
    setAccess();
    renderAt('/tenant/guarded-projects', <ProtectedRoute allowedRoles={['SUPER_ADMIN']} />);
    expect(screen.queryByText('PROYECTOS-GUARDADO')).toBeNull();

    renderAt('/tenant/guarded-projects', <ProtectedRoute allowedRoles={['FORMULADOR']} module="projects" />);
    expect(screen.getByText('PROYECTOS-GUARDADO')).toBeInTheDocument();
  });

  it('sin module/allowedRoles solo exige sesión', () => {
    renderAt('/tenant/guarded-catalog', <ProtectedRoute />);
    expect(screen.getByText('CATALOGO')).toBeInTheDocument();
  });
});
