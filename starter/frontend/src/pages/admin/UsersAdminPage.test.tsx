import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UsersAdminPage from './UsersAdminPage';
import { renderWithProviders } from '../../test/renderWithProviders';
import { useAccessStore } from '../../store/accessStore';
import { useTenantStore } from '../../store/tenantStore';
import { FULL, meAccess, mod } from '../../test/accessFixtures';

const auth = vi.hoisted(() => ({ role: 'TENANT_ADMIN' }));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u', email: 'a@b.co', full_name: 'A', role: auth.role, tenant_id: 't' } }),
}));

const api = vi.hoisted(() => ({
  list: vi.fn(),
  getPermissions: vi.fn(),
  roleTemplates: vi.fn(),
}));
vi.mock('../../lib/accessAdminApi', async (orig) => {
  const actual = await orig<typeof import('../../lib/accessAdminApi')>();
  return { ...actual, usersApi: { ...actual.usersApi, ...api } };
});

const sample = {
  id: 'u1',
  email: 'ana@x.co',
  full_name: 'Ana Pérez',
  role: 'FORMULADOR',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
};

function seedAccess(code: string) {
  const modules = [mod(code, 'Usuarios', '/x', { permissions: FULL })];
  useAccessStore.setState({
    status: 'ready',
    access: meAccess(modules),
    byCode: { [code]: modules[0] },
    can: useAccessStore.getState().can,
  });
}

describe('UsersAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockResolvedValue([sample]);
    useTenantStore.setState({ tenants: [], fetchTenants: vi.fn().mockResolvedValue(undefined) });
  });

  it('Tenant Admin: lista su entidad y no muestra selector de tenant', async () => {
    auth.role = 'TENANT_ADMIN';
    seedAccess('users');
    renderWithProviders(<UsersAdminPage />, { route: '/tenant/users' });
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.queryByLabelText('Entidad')).not.toBeInTheDocument();
    expect(api.list).toHaveBeenCalledWith('tenant', undefined);
  });

  it('Super Admin: exige elegir tenant antes de listar', async () => {
    auth.role = 'SUPER_ADMIN';
    seedAccess('admin.users');
    useTenantStore.setState({
      tenants: [{ id: 'ten-1', name: 'Alcaldía A' } as never],
    });
    const { user } = renderWithProviders(<UsersAdminPage />, { route: '/admin/users' });
    expect(screen.getByText(/Selecciona una entidad para ver/)).toBeInTheDocument();
    expect(api.list).not.toHaveBeenCalled();
    await user.selectOptions(screen.getByLabelText('Entidad'), 'ten-1');
    await waitFor(() => expect(api.list).toHaveBeenCalledWith('platform', 'ten-1'));
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
  });

  it('abre la matriz de permisos y aplica la plantilla de rol', async () => {
    auth.role = 'TENANT_ADMIN';
    seedAccess('users');
    const row = (code: string) => ({
      module_code: code, name: code, kind: 'MODULE', enabled_in_tenant: true,
      can_view: false, can_create: false, can_edit: false, can_delete: false,
      default_view: false, default_create: false, default_edit: false, default_delete: false,
    });
    api.getPermissions.mockResolvedValue({ user: sample, resolved_by_role: false, permissions: [row('projects')] });
    api.roleTemplates.mockResolvedValue([
      { role: 'FORMULADOR', modules: { projects: { can_view: true, can_create: true, can_edit: true, can_delete: true } } },
    ]);
    const { user } = renderWithProviders(<UsersAdminPage />, { route: '/tenant/users' });
    await user.click(await screen.findByLabelText('Permisos de Ana Pérez'));
    const view = await screen.findByLabelText('projects · Ver');
    expect(view).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Aplicar plantilla de rol' }));
    expect(screen.getByLabelText('projects · Ver')).toBeChecked();
    expect(screen.getByLabelText('projects · Eliminar')).toBeChecked();
  });
});
