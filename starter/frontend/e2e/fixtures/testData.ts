/**
 * Identidades E2E y rutas multi-tenant.
 * El aislamiento real lo impone el JWT (tenant_id); aquí modelamos dos tenants
 * y un Super Admin para el flujo de Aurora Copilot + catálogos.
 */

export type E2EUser = {
  id: string;
  email: string;
  password: string;
  full_name: string;
  role: string;
  tenant_id: string | null;
  storageFile: string;
};

export const TENANT_A = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'tenant-a',
  name: 'Alcaldía Tenant A',
  pathPrefix: '/tenant',
} as const;

export const TENANT_B = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'tenant-b',
  name: 'Gobernación Tenant B',
  pathPrefix: '/tenant',
} as const;

export const users = {
  tenantA: {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    email: 'formulador.a@tenant-a.gov.co',
    password: 'TenantA2026*',
    full_name: 'Ana Formuladora',
    role: 'FORMULADOR',
    tenant_id: TENANT_A.id,
    storageFile: 'tenant-a.json',
  },
  tenantB: {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    email: 'formulador.b@tenant-b.gov.co',
    password: 'TenantB2026*',
    full_name: 'Bruno Formulador',
    role: 'FORMULADOR',
    tenant_id: TENANT_B.id,
    storageFile: 'tenant-b.json',
  },
  superAdmin: {
    id: '99999999-9999-4999-8999-999999999999',
    email: 'admin@aurora.gov.co',
    password: 'Admin2026*',
    full_name: 'Super Admin',
    role: 'SUPER_ADMIN',
    tenant_id: null,
    storageFile: 'super-admin.json',
  },
} as const satisfies Record<string, E2EUser>;

export const PROJECT_A = {
  id: 'proj-tenant-a-1',
  name: 'Acueducto rural Tenant A',
  sector: 'Agua potable',
  code_bpin: '2026-A-001',
  status: 'IN_FORMULATION',
  created_at: '2026-03-11T10:00:00Z',
} as const;

export const PROJECT_B = {
  id: 'proj-tenant-b-1',
  name: 'Vía terciaria Tenant B',
  sector: 'Transporte',
  code_bpin: '2026-B-001',
  status: 'SUBMITTED',
  created_at: '2026-03-12T10:00:00Z',
} as const;

export const EVALUATION_A = {
  project_id: PROJECT_A.id,
  alternative_name: 'Alternativa A',
  vpn: 1_250_000_000,
  tir: 0.1842,
  created_at: '2026-03-12T10:00:00Z',
} as const;

export const PRODUCT_CARD = {
  catalog: 'products' as const,
  code: '4001001',
  label: 'Acueducto rural construido',
  description: 'Producto DNP del sector agua potable.',
};

/** Rutas canónicas por rol (alineadas con homeForUser). */
export const routes = {
  login: '/login',
  tenantProjects: '/tenant/projects',
  tenantCatalog: '/tenant/catalog',
  tenantAi: '/tenant/ai',
  tenantCrash: '/tenant/e2e-crash',
  adminAi: '/admin/ai',
  adminProducts: '/admin/catalogs/products',
  adminTenants: '/admin/tenants',
} as const;
