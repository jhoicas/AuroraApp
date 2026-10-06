import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { AccessModule, NavScope } from '../store/accessStore';

type PageComponent = LazyExoticComponent<ComponentType<any>> | ComponentType<any>;

/** Ruta hija del layout del módulo (relativa a /tenant o /admin). */
export type RegistryRoute =
  | { path: string; Component: PageComponent; redirectTo?: undefined }
  | { path: string; redirectTo: string; Component?: undefined };

/** Qué UI tiene un módulo en esta app. El servidor decide acceso; esto decide cómo se ve. */
export type RegistryEntry = {
  /** Ícono Material Symbols del ítem de menú. */
  icon?: string;
  /** Rutas inyectadas cuando el usuario puede ver el módulo. */
  routes?: RegistryRoute[];
  /** false: el módulo existe pero no aparece como enlace propio (p. ej. etapas MGA). */
  nav?: boolean;
  /** Prefijos de URL que activan el grupo del menú (por defecto, la ruta del módulo). */
  activePrefixes?: string[];
  /** Prefijos que NO activan el grupo (p. ej. catálogos MGA cuelgan de /admin/catalogs/). */
  excludePrefixes?: string[];
  /** Prefijos extra que cuentan como "este módulo" para el título del header. */
  titlePrefixes?: string[];
};

const lz = {
  projectsDashboard: lazy(() => import('../pages/tenant/ProjectsDashboard')),
  projectCreationAssistant: lazy(() => import('../pages/tenant/ProjectCreationAssistant')),
  projectDetail: lazy(() => import('../pages/tenant/ProjectDetailPage')),
  catalog: lazy(() => import('../pages/tenant/CatalogPage')),
  aiAssistant: lazy(() => import('../pages/tenant/AiAssistantPage')),
  reports: lazy(() => import('../pages/tenant/ReportsPage')),
  tenants: lazy(() => import('../pages/admin/TenantsPage')),
  adminModules: lazy(() => import('../pages/admin/ModulesPage')),
  usersAdmin: lazy(() => import('../pages/admin/UsersAdminPage')),
  adminSettings: lazy(() => import('../pages/admin/AdminSettingsPage')),
  roleTemplates: lazy(() => import('../pages/admin/RoleTemplatesPage')),
  adminProjects: lazy(() => import('../pages/admin/AdminProjectsPage')),
  adminProjectDetail: lazy(() => import('../pages/admin/AdminProjectDetailPage')),
  aiKnowledge: lazy(() => import('../pages/admin/AIKnowledgePage')),
  sectors: lazy(() => import('../pages/admin/SectorsCatalogPage')),
  programs: lazy(() => import('../pages/admin/ProgramsCatalogPage')),
  products: lazy(() => import('../pages/admin/ProductsCatalogPage')),
  edt: lazy(() => import('../pages/admin/EdtCatalogPage')),
  deliverables: lazy(() => import('../pages/admin/DeliverablesCatalogPage')),
  activities: lazy(() => import('../pages/admin/ActivitiesCatalogPage')),
  ods: lazy(() => import('../pages/admin/OdsCatalogPage')),
  pnd: lazy(() => import('../pages/admin/PndCatalogPage')),
  procesos: lazy(() => import('../pages/admin/ProcesosCatalogPage')),
  locations: lazy(() => import('../pages/admin/LocationsCatalogPage')),
  measurementUnits: lazy(() => import('../pages/admin/MeasurementUnitsCatalogPage')),
  mgaActors: lazy(() => import('../pages/admin/MgaActorsCatalogPage')),
  mgaEntities: lazy(() => import('../pages/admin/MgaEntitiesCatalogPage')),
  mgaPositions: lazy(() => import('../pages/admin/MgaPositionsCatalogPage')),
  comingSoon: lazy(() => import('../pages/ComingSoonPage')),
};

/** Marcador de módulos que existen en el servidor pero no tienen enlace/ruta propia. */
const headless: RegistryEntry = { nav: false };

/**
 * Registro código de módulo → UI. Las claves son los `code` del manifiesto del backend
 * (internal/domain/modules). Un código del servidor que no esté aquí no rompe la UI: se
 * registra una advertencia en consola y se omite (ver `warnUnregistered`).
 */
export const moduleRegistry: Record<string, RegistryEntry> = {
  // ── Entidad (TENANT) ──
  projects: {
    icon: 'dashboard',
    routes: [
      { path: 'projects', Component: lz.projectsDashboard },
      { path: 'projects/create-assistant', Component: lz.projectCreationAssistant },
      { path: 'projects/:id/formulation', Component: lz.projectDetail },
      { path: 'projects/:id', Component: lz.projectDetail },
      { path: 'formulation', redirectTo: '/tenant/projects' },
    ],
    // Las rutas de proyecto también activan este ítem (el detalle vive bajo /tenant/projects/:id).
    activePrefixes: ['/tenant/projects'],
  },
  // La formulación MGA se renderiza dentro del detalle del proyecto: sin ruta ni enlace propios.
  mga: headless,
  'mga.identificacion': headless,
  'mga.preparacion': headless,
  'mga.evaluacion': headless,
  'mga.programacion': headless,
  'mga.presentar': headless,
  catalog: { icon: 'category', routes: [{ path: 'catalog', Component: lz.catalog }] },
  ai: { icon: 'hub', routes: [{ path: 'ai', Component: lz.aiAssistant }] },
  reports: { icon: 'insert_chart', routes: [{ path: 'reports', Component: lz.reports }] },
  users: { icon: 'manage_accounts', routes: [{ path: 'users', Component: lz.usersAdmin }] },

  // ── Plataforma (PLATFORM) ──
  'admin.tenants': { icon: 'settings_suggest', routes: [{ path: 'tenants', Component: lz.tenants }] },
  'admin.projects': {
    icon: 'folder_open',
    routes: [
      { path: 'projects', Component: lz.adminProjects },
      // Detalle y formulación del proyecto en modo lectura (Super Admin).
      { path: 'projects/:id', Component: lz.adminProjectDetail },
    ],
  },
  'admin.catalogs': {
    icon: 'edit_document',
    routes: [
      { path: 'catalogo', redirectTo: '/admin/catalogs/sectors' },
      { path: 'catalogs', redirectTo: '/admin/catalogs/sectors' },
      { path: 'catalogs/indicators', redirectTo: '/admin/catalogs/edt' },
      { path: 'catalogs/funding-sources', redirectTo: '/admin/catalogs/deliverables' },
    ],
    activePrefixes: ['/admin/catalogs', '/admin/catalogo'],
    excludePrefixes: ['/admin/catalogs/mga-'],
    titlePrefixes: ['/admin/catalog'],
  },
  'admin.catalogs.sectors': { routes: [{ path: 'catalogs/sectors', Component: lz.sectors }] },
  'admin.catalogs.programs': { routes: [{ path: 'catalogs/programs', Component: lz.programs }] },
  'admin.catalogs.products': { routes: [{ path: 'catalogs/products', Component: lz.products }] },
  'admin.catalogs.edt': {
    routes: [{ path: 'catalogs/edt', Component: lz.edt }],
    titlePrefixes: ['/admin/catalogs/indicators'],
  },
  'admin.catalogs.deliverables': {
    routes: [{ path: 'catalogs/deliverables', Component: lz.deliverables }],
    titlePrefixes: ['/admin/catalogs/funding'],
  },
  'admin.catalogs.activities': { routes: [{ path: 'catalogs/activities', Component: lz.activities }] },
  'admin.catalogs.ods': { routes: [{ path: 'catalogs/ods', Component: lz.ods }] },
  'admin.catalogs.pnd': { routes: [{ path: 'catalogs/pnd', Component: lz.pnd }] },
  'admin.catalogs.procesos': { routes: [{ path: 'catalogs/procesos', Component: lz.procesos }] },
  'admin.catalogs.locations': { routes: [{ path: 'catalogs/locations', Component: lz.locations }] },
  'admin.catalogs.measurement-units': {
    routes: [{ path: 'catalogs/measurement-units', Component: lz.measurementUnits }],
  },
  'admin.mga_catalogs': { icon: 'group_work', activePrefixes: ['/admin/catalogs/mga-'] },
  'admin.mga_catalogs.actors': { routes: [{ path: 'catalogs/mga-actors', Component: lz.mgaActors }] },
  'admin.mga_catalogs.entities': { routes: [{ path: 'catalogs/mga-entities', Component: lz.mgaEntities }] },
  'admin.mga_catalogs.positions': { routes: [{ path: 'catalogs/mga-positions', Component: lz.mgaPositions }] },
  'admin.modules': { icon: 'widgets', routes: [{ path: 'modules', Component: lz.adminModules }] },
  'admin.users': {
    icon: 'manage_accounts',
    routes: [
      { path: 'users', Component: lz.usersAdmin },
      // Plantillas de permisos por rol: cuelgan de Usuarios (no tienen módulo propio).
      { path: 'roles', Component: lz.roleTemplates },
    ],
    activePrefixes: ['/admin/users', '/admin/roles'],
    titlePrefixes: ['/admin/roles'],
  },
  'admin.ai': { icon: 'psychology', routes: [{ path: 'ai', Component: lz.aiKnowledge }] },
  'admin.settings': {
    icon: 'settings',
    routes: [
      { path: 'settings', Component: lz.adminSettings },
      { path: 'security', Component: lz.comingSoon },
      { path: 'reports', Component: lz.comingSoon },
    ],
    titlePrefixes: ['/admin/security'],
  },
};

const warned = new Set<string>();

/** Advierte (una vez por código) de módulos del servidor sin entrada en el registro. */
export function warnUnregistered(
  code: string,
  registry: Record<string, RegistryEntry> = moduleRegistry,
): boolean {
  if (registry[code]) return false;
  if (!warned.has(code)) {
    warned.add(code);
    console.warn(`[moduleRegistry] El módulo "${code}" no está en el registro: se omite de rutas y menú.`);
  }
  return true;
}

/** Solo para pruebas. */
export function resetRegistryWarnings(): void {
  warned.clear();
}

/** Entradas del registro de los módulos visibles de un alcance (recorre secciones). */
export function registeredModules(
  nodes: AccessModule[],
  registry: Record<string, RegistryEntry> = moduleRegistry,
): Array<{ node: AccessModule; entry: RegistryEntry }> {
  const out: Array<{ node: AccessModule; entry: RegistryEntry }> = [];
  const walk = (list: AccessModule[]) => {
    for (const node of list) {
      if (warnUnregistered(node.code, registry)) continue;
      out.push({ node, entry: registry[node.code] });
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

export const SCOPE_PREFIX: Record<NavScope, string> = { TENANT: '/tenant', PLATFORM: '/admin' };
