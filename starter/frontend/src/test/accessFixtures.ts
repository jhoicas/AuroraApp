import type { AccessModule, MeAccess, ModulePermissions } from '../store/accessStore';

export const FULL: ModulePermissions = { view: true, create: true, edit: true, delete: true };
export const VIEW_ONLY: ModulePermissions = { view: true, create: false, edit: false, delete: false };
export const NONE: ModulePermissions = { view: false, create: false, edit: false, delete: false };

export function mod(
  code: string,
  name: string,
  route: string,
  opts: Partial<AccessModule> = {},
): AccessModule {
  return {
    code,
    name,
    kind: 'MODULE',
    scope: 'TENANT',
    route,
    order: 0,
    enabled: true,
    permissions: VIEW_ONLY,
    ...opts,
  };
}

/** Árbol de un FORMULADOR (espejo del manifiesto del backend). */
export function tenantModules(overrides: Record<string, Partial<AccessModule>> = {}): AccessModule[] {
  const sec = (code: string, name: string, order: number) =>
    mod(code, name, `/tenant/projects/:id/formulation#${code.split('.')[1]}`, {
      kind: 'SECTION',
      order,
      permissions: FULL,
    });
  const list = [
    mod('projects', 'Proyectos', '/tenant/projects', { order: 10, permissions: FULL }),
    mod('mga', 'Formulación MGA', '/tenant/projects/:id/formulation', {
      order: 20,
      permissions: FULL,
      children: [
        sec('mga.identificacion', 'Identificación', 21),
        sec('mga.preparacion', 'Preparación', 22),
        sec('mga.evaluacion', 'Evaluación', 23),
        sec('mga.programacion', 'Programación', 24),
        sec('mga.presentar', 'Presentar', 25),
      ],
    }),
    mod('catalog', 'Catálogo DNP', '/tenant/catalog', { order: 30 }),
    mod('ai', 'Exploración MGA', '/tenant/ai', { order: 40 }),
    mod('reports', 'Reportes', '/tenant/reports', { order: 50 }),
    mod('users', 'Usuarios y permisos', '/tenant/users', { order: 60, permissions: NONE }),
  ];
  return list.map((m) => ({ ...m, ...(overrides[m.code] ?? {}) }));
}

/** Árbol de un SUPER_ADMIN (módulos de plataforma). */
export function platformModules(): AccessModule[] {
  const p = (code: string, name: string, route: string, order: number, extra: Partial<AccessModule> = {}) =>
    mod(code, name, route, { scope: 'PLATFORM', order, permissions: FULL, ...extra });
  const child = (parent: string, key: string, name: string, route: string, order: number) =>
    p(`${parent}.${key}`, name, route, order, { kind: 'SECTION' });
  return [
    p('admin.tenants', 'Gestión de Tenants', '/admin/tenants', 100),
    p('admin.catalogs', 'Catálogos Maestros', '/admin/catalogs', 110, {
      children: [
        child('admin.catalogs', 'sectors', 'Sectores', '/admin/catalogs/sectors', 111),
        child('admin.catalogs', 'programs', 'Programas', '/admin/catalogs/programs', 112),
        child('admin.catalogs', 'edt', 'Catálogo EDT', '/admin/catalogs/edt', 114),
        child('admin.catalogs', 'deliverables', 'Catálogo de Entregables', '/admin/catalogs/deliverables', 115),
      ],
    }),
    p('admin.mga_catalogs', 'Catálogos MGA', '/admin/mga-catalogs', 125, {
      children: [
        child('admin.mga_catalogs', 'actors', 'Actores MGA', '/admin/catalogs/mga-actors', 126),
        child('admin.mga_catalogs', 'entities', 'Entidades MGA', '/admin/catalogs/mga-entities', 127),
      ],
    }),
    p('admin.ai', 'Gestión IA Aurora', '/admin/ai', 140),
    p('admin.settings', 'Settings', '/admin/settings', 150),
  ];
}

export function meAccess(modules: AccessModule[], extra: Partial<MeAccess> = {}): MeAccess {
  return {
    user_id: 'user-1',
    role: 'FORMULADOR',
    tenant_id: 'tenant-1',
    is_super_admin: false,
    is_tenant_admin: false,
    token_version: 0,
    modules,
    ...extra,
  };
}
