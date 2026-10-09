import { api } from './api';

/** Quién administra: SUPER_ADMIN (cualquier tenant) o TENANT_ADMIN (su entidad). */
export type AdminScope = 'platform' | 'tenant';

export type AdminUser = {
  id: string;
  tenant_id?: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

export type PermissionRow = {
  module_code: string;
  name: string;
  kind: string;
  parent_code?: string;
  enabled_in_tenant: boolean;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  default_view: boolean;
  default_create: boolean;
  default_edit: boolean;
  default_delete: boolean;
};

export type UserPermissions = {
  user: AdminUser;
  resolved_by_role: boolean;
  permissions: PermissionRow[];
};

export type PermissionInput = {
  module_code: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

export type RoleTemplate = {
  role: string;
  modules: Record<string, Omit<PermissionInput, 'module_code'>>;
};

export type CreateUserPayload = { email: string; full_name: string; password: string; role_code: string };
export type UpdateUserPayload = { email?: string; full_name?: string; role_code?: string };

export type AdminModule = {
  id: string;
  code: string;
  name: string;
  description?: string;
  kind: string;
  scope: string;
  parent_id?: string;
  parent_code?: string;
  route: string;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
  customized: boolean;
};

export type CreateModulePayload = {
  code: string;
  name: string;
  description?: string;
  kind: string;
  scope: string;
  parent_code?: string;
  route: string;
  sort_order: number;
};

export type UpdateModulePayload = Partial<{
  name: string;
  description: string;
  route: string;
  sort_order: number;
  is_active: boolean;
}>;

/** Roles asignables desde la UI (SUPER_ADMIN no se asigna nunca). */
export const ASSIGNABLE_ROLES = ['TENANT_ADMIN', 'FORMULADOR', 'EVALUADOR', 'VIEWER'] as const;
export const TEMPLATE_ROLES = ['FORMULADOR', 'EVALUADOR', 'VIEWER'] as const;

export const ROLE_LABELS: Record<string, string> = {
  TENANT_ADMIN: 'Administrador de entidad',
  FORMULADOR: 'Formulador',
  EVALUADOR: 'Evaluador',
  VIEWER: 'Solo lectura',
};

// ── Usuarios ────────────────────────────────────────────────────────────────

export const usersApi = {
  async list(scope: AdminScope, tenantId?: string): Promise<AdminUser[]> {
    const url = scope === 'platform' ? `/admin/tenants/${tenantId}/users` : '/tenant/users';
    const { data } = await api.get<{ data: AdminUser[] }>(url, { params: { limit: 200 } });
    return data.data ?? [];
  },
  async create(scope: AdminScope, tenantId: string | undefined, payload: CreateUserPayload): Promise<AdminUser> {
    const url = scope === 'platform' ? `/admin/tenants/${tenantId}/users` : '/tenant/users';
    const { data } = await api.post<AdminUser>(url, payload);
    return data;
  },
  async update(scope: AdminScope, id: string, payload: UpdateUserPayload): Promise<AdminUser> {
    const url = scope === 'platform' ? `/admin/users/${id}` : `/tenant/users/${id}`;
    const { data } = await api.patch<AdminUser>(url, payload);
    return data;
  },
  async setPassword(scope: AdminScope, id: string, newPassword: string): Promise<void> {
    const base = scope === 'platform' ? '/admin/users' : '/tenant/users';
    await api.put(`${base}/${id}/password`, { new_password: newPassword });
  },
  async setStatus(scope: AdminScope, id: string, isActive: boolean): Promise<void> {
    if (scope === 'platform') await api.put(`/admin/users/${id}/status`, { is_active: isActive });
    else await api.patch(`/tenant/users/${id}/status`, { is_active: isActive });
  },
  async getPermissions(scope: AdminScope, id: string): Promise<UserPermissions> {
    const base = scope === 'platform' ? '/admin/users' : '/tenant/users';
    const { data } = await api.get<UserPermissions>(`${base}/${id}/permissions`);
    return { ...data, permissions: data.permissions ?? [] };
  },
  async setPermissions(scope: AdminScope, id: string, permissions: PermissionInput[]): Promise<UserPermissions> {
    const base = scope === 'platform' ? '/admin/users' : '/tenant/users';
    const { data } = await api.put<UserPermissions>(`${base}/${id}/permissions`, { permissions });
    return { ...data, permissions: data.permissions ?? [] };
  },
  async roleTemplates(scope: AdminScope): Promise<RoleTemplate[]> {
    const url = scope === 'platform' ? '/admin/role-templates' : '/tenant/role-templates';
    const { data } = await api.get<{ data: RoleTemplate[] }>(url);
    return data.data ?? [];
  },
};

// ── Módulos (solo SUPER_ADMIN) ──────────────────────────────────────────────

export const modulesApi = {
  async list(): Promise<AdminModule[]> {
    const { data } = await api.get<{ data: AdminModule[] }>('/admin/modules');
    return data.data ?? [];
  },
  async listPage(params: { page: number; limit: number; search?: string }): Promise<Paged<AdminModule>> {
    const { data } = await api.get<Paged<AdminModule>>('/admin/modules', {
      params: { page: params.page, limit: params.limit, ...(params.search ? { search: params.search } : {}) },
    });
    return { ...data, data: data.data ?? [] };
  },
  async create(payload: CreateModulePayload): Promise<AdminModule> {
    const { data } = await api.post<AdminModule>('/admin/modules', payload);
    return data;
  },
  async update(id: string, payload: UpdateModulePayload): Promise<AdminModule> {
    const { data } = await api.put<AdminModule>(`/admin/modules/${id}`, payload);
    return data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/admin/modules/${id}`);
  },
  async reorder(items: { id: string; sort_order: number }[]): Promise<void> {
    await api.put('/admin/modules/order', { items });
  },
};

export type Paged<T> = { data: T[]; total: number; page: number; limit: number };

/** Metadatos de paginación en la forma que espera CatalogPagination. */
export function pageMeta(p: { total: number; page: number; limit: number }) {
  return { total: p.total, page: p.page, limit: p.limit, last_page: Math.max(1, Math.ceil(p.total / p.limit)) };
}

// ── Plantillas de rol (solo SUPER_ADMIN) ────────────────────────────────────

export const roleTemplatesApi = {
  async list(): Promise<RoleTemplate[]> {
    return usersApi.roleTemplates('platform');
  },
  async save(role: string, modules: RoleTemplate['modules']): Promise<RoleTemplate> {
    const { data } = await api.put<RoleTemplate>(`/admin/role-templates/${role}`, { modules });
    return { ...data, modules: data.modules ?? {} };
  },
};

// ── Proyectos de todas las entidades (solo SUPER_ADMIN) ─────────────────────

export type AdminProject = {
  id: string;
  name: string;
  code_bpin?: string;
  status: string;
  fase_maduracion: string;
  sector?: string;
  tenant_id: string;
  tenant_name: string;
  creator_id: string;
  creator_email: string;
  creator_name: string;
  created_at: string;
  updated_at: string;
};

export type AdminProjectFilters = {
  tenant_id?: string;
  created_by?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
};

export const adminProjectsApi = {
  async list(filters: AdminProjectFilters): Promise<Paged<AdminProject>> {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''));
    const { data } = await api.get<Paged<AdminProject>>('/admin/projects', { params });
    return { ...data, data: data.data ?? [] };
  },
};

/** Mensaje legible de un error de la API. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return msg || (err instanceof Error && err.message ? err.message : fallback);
}
