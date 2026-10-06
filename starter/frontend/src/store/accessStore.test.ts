import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { apiUrl, server } from '../test/server';
import { useAccessStore } from './accessStore';
import { meAccess, mod, NONE, platformModules, tenantModules } from '../test/accessFixtures';

function serveAccess(body: unknown, status = 200) {
  server.use(http.get(apiUrl('/auth/me/access'), () => HttpResponse.json(body as object, { status })));
}

describe('accessStore', () => {
  beforeEach(() => useAccessStore.getState().reset());

  it('arranca vacío y sin permisos', () => {
    const s = useAccessStore.getState();
    expect(s.status).toBe('idle');
    expect(s.can('projects')).toBe(false);
    expect(s.navTree('TENANT')).toEqual([]);
  });

  it('carga el árbol desde GET /auth/me/access', async () => {
    serveAccess(meAccess(tenantModules()));
    const promise = useAccessStore.getState().fetchAccess();
    expect(useAccessStore.getState().status).toBe('loading');
    await promise;

    const s = useAccessStore.getState();
    expect(s.status).toBe('ready');
    expect(s.access?.role).toBe('FORMULADOR');
    expect(s.getModule('mga.evaluacion')?.name).toBe('Evaluación');
  });

  it('can(code, action): módulo ausente, deshabilitado o sin la acción ⇒ false', async () => {
    serveAccess(
      meAccess(
        tenantModules({
          reports: { enabled: false },
          catalog: { permissions: { view: true, create: false, edit: false, delete: false } },
        }),
      ),
    );
    await useAccessStore.getState().fetchAccess();
    const { can } = useAccessStore.getState();

    expect(can('projects')).toBe(true); // action por defecto: view
    expect(can('projects', 'delete')).toBe(true);
    expect(can('catalog', 'view')).toBe(true);
    expect(can('catalog', 'edit')).toBe(false);
    expect(can('reports', 'view')).toBe(false); // deshabilitado para el tenant
    expect(can('users', 'view')).toBe(false); // sin permiso
    expect(can('no-existe', 'view')).toBe(false);
    expect(can('mga.presentar', 'create')).toBe(true); // secciones indexadas
  });

  it('navTree(scope): solo módulos habilitados con view, ordenados y con secciones visibles', async () => {
    const modules = [
      ...tenantModules({ reports: { enabled: false } }).map((m) =>
        m.code === 'mga'
          ? { ...m, children: [...(m.children ?? []), mod('mga.oculta', 'Oculta', '/x', { kind: 'SECTION', permissions: NONE })] }
          : m,
      ),
      ...platformModules(),
    ];
    // Desordenar para comprobar el orden.
    serveAccess(meAccess(modules.reverse(), { role: 'SUPER_ADMIN', is_super_admin: true }));
    await useAccessStore.getState().fetchAccess();
    const { navTree } = useAccessStore.getState();

    expect(navTree('TENANT').map((m) => m.code)).toEqual(['projects', 'mga', 'catalog', 'ai']);
    const mga = navTree('TENANT').find((m) => m.code === 'mga');
    expect(mga?.children?.map((c) => c.code)).toEqual([
      'mga.identificacion', 'mga.preparacion', 'mga.evaluacion', 'mga.programacion', 'mga.presentar',
    ]);
    expect(navTree('PLATFORM').map((m) => m.code)).toEqual([
      'admin.tenants', 'admin.catalogs', 'admin.mga_catalogs', 'admin.ai', 'admin.settings',
    ]);
    // Referencia estable entre llamadas (necesaria para selectores de zustand).
    expect(navTree('TENANT')).toBe(navTree('TENANT'));
  });

  it('no persiste nada en localStorage/sessionStorage', async () => {
    serveAccess(meAccess(tenantModules()));
    await useAccessStore.getState().fetchAccess();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('reset() limpia los permisos (cierre de sesión)', async () => {
    serveAccess(meAccess(tenantModules()));
    await useAccessStore.getState().fetchAccess();
    useAccessStore.getState().reset();
    const s = useAccessStore.getState();
    expect(s.status).toBe('idle');
    expect(s.access).toBeNull();
    expect(s.can('projects')).toBe(false);
  });

  it('error de red sin datos previos ⇒ estado error; con datos previos los conserva', async () => {
    serveAccess({ error: 'boom' }, 500);
    await useAccessStore.getState().fetchAccess();
    expect(useAccessStore.getState().status).toBe('error');

    serveAccess(meAccess(tenantModules()));
    await useAccessStore.getState().fetchAccess();
    expect(useAccessStore.getState().status).toBe('ready');

    serveAccess({ error: 'boom' }, 500);
    await useAccessStore.getState().fetchAccess();
    const s = useAccessStore.getState();
    expect(s.status).toBe('ready');
    expect(s.error).toBeTruthy();
    expect(s.can('projects')).toBe(true);
  });

  it('un refresco aplica la revocación de inmediato', async () => {
    serveAccess(meAccess(tenantModules()));
    await useAccessStore.getState().fetchAccess();
    expect(useAccessStore.getState().can('reports')).toBe(true);

    serveAccess(meAccess(tenantModules({ reports: { permissions: NONE } })));
    await useAccessStore.getState().fetchAccess();
    expect(useAccessStore.getState().can('reports')).toBe(false);
    expect(useAccessStore.getState().status).toBe('ready'); // sin parpadeo de carga
  });

  it('peticiones concurrentes comparten una sola llamada', async () => {
    let calls = 0;
    server.use(
      http.get(apiUrl('/auth/me/access'), () => {
        calls += 1;
        return HttpResponse.json(meAccess(tenantModules()));
      }),
    );
    await Promise.all([useAccessStore.getState().fetchAccess(), useAccessStore.getState().fetchAccess()]);
    expect(calls).toBe(1);
  });
});
