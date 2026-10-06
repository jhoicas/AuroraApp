import { useAccessStore, type AccessModule } from '../store/accessStore';

type Perms = { view?: boolean; create?: boolean; edit?: boolean; delete?: boolean };

/** Precarga permisos por módulo en accessStore (lo que `GET /auth/me/access` resolvería). */
export function seedAccess(perms: Record<string, Perms>): void {
  const byCode: Record<string, AccessModule> = {};
  Object.entries(perms).forEach(([code, p], i) => {
    byCode[code] = {
      code,
      name: code,
      kind: 'MODULE',
      scope: 'TENANT',
      route: `/tenant/${code}`,
      order: i,
      enabled: true,
      permissions: { view: false, create: false, edit: false, delete: false, ...p },
    };
  });
  useAccessStore.setState({ status: 'ready', byCode });
}

const FULL = { view: true, create: true, edit: true, delete: true };
const READ = { view: true };

export const seedFullAccess = (): void => seedAccess({ projects: FULL, mga: FULL, catalog: FULL });
export const seedViewerAccess = (): void => seedAccess({ projects: READ, mga: READ, catalog: READ });
