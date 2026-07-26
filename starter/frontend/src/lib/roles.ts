/** Roles canónicos del backend (roles.code). */
export const Roles = {
  SuperAdmin: 'SUPER_ADMIN',
  TenantAdmin: 'TENANT_ADMIN',
  Formulador: 'FORMULADOR',
  Evaluador: 'EVALUADOR',
  Analista: 'ANALISTA',
  Viewer: 'VIEWER',
} as const;

export type RedirectUser = {
  role: string;
  tenant_id?: string | null;
};

/** Normaliza variantes: "super_admin", "Super-Admin" → "SUPER_ADMIN". */
export function normalizeRole(role: string | null | undefined): string {
  if (!role) return '';
  return role.trim().toUpperCase().replace(/-/g, '_');
}

export function isSuperAdmin(role: string | null | undefined): boolean {
  return normalizeRole(role) === Roles.SuperAdmin;
}

/**
 * Destino post-login / fallback de guards.
 * Orden estricto: SUPER_ADMIN → /admin/tenants; si no, requiere tenant_id.
 */
export function homeForUser(user: RedirectUser): string {
  const userRole = normalizeRole(user.role);

  if (userRole === Roles.SuperAdmin) {
    return '/admin/tenants';
  }

  if (user.tenant_id) {
    return '/tenant/projects';
  }

  return '/login';
}

/** @deprecated Preferir homeForUser({ role, tenant_id }). */
export function homeForRole(role: string | null | undefined, tenantId?: string | null): string {
  return homeForUser({ role: role ?? '', tenant_id: tenantId });
}

export function roleIsAllowed(
  userRole: string | null | undefined,
  allowedRoles: string[],
): boolean {
  const normalized = normalizeRole(userRole);
  if (!normalized) return false;
  return allowedRoles.some((allowed) => normalizeRole(allowed) === normalized);
}
