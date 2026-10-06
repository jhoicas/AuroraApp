import { create } from 'zustand';
import { api } from '../lib/api';

/** Acciones granulares por módulo (D1). */
export type AccessAction = 'view' | 'create' | 'edit' | 'delete';

/** Alcance de navegación: módulos de entidad (TENANT) o de plataforma (PLATFORM / ADMIN). */
export type NavScope = 'TENANT' | 'PLATFORM';

export type ModulePermissions = {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
};

/** Nodo del árbol devuelto por GET /api/v1/auth/me/access. */
export type AccessModule = {
  code: string;
  name: string;
  description?: string;
  kind: 'MODULE' | 'SECTION' | string;
  scope: NavScope | string;
  route: string;
  order: number;
  enabled: boolean;
  permissions: ModulePermissions;
  children?: AccessModule[];
};

export type MeAccess = {
  user_id: string;
  role: string;
  tenant_id?: string;
  is_super_admin: boolean;
  is_tenant_admin: boolean;
  token_version: number;
  modules: AccessModule[];
};

export type AccessStatus = 'idle' | 'loading' | 'ready' | 'error';

type AccessState = {
  status: AccessStatus;
  error: string | null;
  access: MeAccess | null;
  /** Epoch ms de la última carga correcta (para refrescos por foco). */
  loadedAt: number | null;
  /** Código → nodo, para búsquedas O(1). */
  byCode: Record<string, AccessModule>;
  /** Árbol navegable por alcance (referencias estables entre renders). */
  nav: Record<NavScope, AccessModule[]>;

  fetchAccess: () => Promise<void>;
  reset: () => void;
  /** ¿Puede el usuario ejecutar `action` sobre el módulo? Módulo ausente o deshabilitado ⇒ false. */
  can: (code: string, action?: AccessAction) => boolean;
  /** Módulos de primer nivel visibles (habilitados y con `view`), con sus secciones visibles. */
  navTree: (scope: NavScope) => AccessModule[];
  getModule: (code: string) => AccessModule | undefined;
};

const EMPTY_NAV: Record<NavScope, AccessModule[]> = { TENANT: [], PLATFORM: [] };

function isVisible(m: AccessModule): boolean {
  return Boolean(m.enabled && m.permissions?.view);
}

function indexModules(mods: AccessModule[], into: Record<string, AccessModule> = {}) {
  for (const m of mods) {
    into[m.code] = m;
    if (m.children?.length) indexModules(m.children, into);
  }
  return into;
}

function buildNav(mods: AccessModule[]): Record<NavScope, AccessModule[]> {
  const nav: Record<NavScope, AccessModule[]> = { TENANT: [], PLATFORM: [] };
  for (const m of mods) {
    if (!isVisible(m)) continue;
    const scope = m.scope === 'PLATFORM' ? 'PLATFORM' : 'TENANT';
    nav[scope].push({ ...m, children: (m.children ?? []).filter(isVisible) });
  }
  const byOrder = (a: AccessModule, b: AccessModule) => a.order - b.order || a.code.localeCompare(b.code);
  nav.TENANT.sort(byOrder);
  nav.PLATFORM.sort(byOrder);
  for (const list of [nav.TENANT, nav.PLATFORM]) for (const m of list) m.children?.sort(byOrder);
  return nav;
}

let inFlight: Promise<void> | null = null;

/**
 * Permisos y módulos resueltos por el servidor. A propósito NO se persiste (ni localStorage
 * ni sessionStorage): se vuelve a pedir en cada login/restauración de sesión para que las
 * revocaciones y cambios de permisos se apliquen de inmediato.
 */
export const useAccessStore = create<AccessState>((set, get) => ({
  status: 'idle',
  error: null,
  access: null,
  loadedAt: null,
  byCode: {},
  nav: EMPTY_NAV,

  fetchAccess: async () => {
    if (inFlight) return inFlight;
    // Un refresco con datos ya cargados no vuelve a mostrar la pantalla de carga.
    if (get().status !== 'ready') set({ status: 'loading', error: null });

    inFlight = (async () => {
      try {
        const { data } = await api.get<MeAccess>('/auth/me/access');
        const modules = data.modules ?? [];
        set({
          status: 'ready',
          error: null,
          access: { ...data, modules },
          loadedAt: Date.now(),
          byCode: indexModules(modules),
          nav: buildNav(modules),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'No se pudieron cargar los permisos';
        // Si ya había permisos, se conservan hasta el próximo intento; sin datos, estado de error.
        if (get().access) set({ error: message });
        else set({ status: 'error', error: message });
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  },

  reset: () => {
    inFlight = null;
    set({ status: 'idle', error: null, access: null, loadedAt: null, byCode: {}, nav: EMPTY_NAV });
  },

  can: (code, action = 'view') => {
    const m = get().byCode[code];
    return Boolean(m && m.enabled && m.permissions?.[action]);
  },

  navTree: (scope) => get().nav[scope],

  getModule: (code) => get().byCode[code],
}));
