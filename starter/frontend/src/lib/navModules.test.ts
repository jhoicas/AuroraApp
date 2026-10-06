import { describe, expect, it, vi } from 'vitest';
import { buildNavItems, firstNavPath, isGroupActive, titleForPath } from './navModules';
import { mod, platformModules, tenantModules } from '../test/accessFixtures';

describe('navModules', () => {
  it('buildNavItems: solo módulos con UI y enlace (sin mga ni users) y grupos con secciones', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(buildNavItems(tenantModules()).map((i) => i.node.code)).toEqual(['projects', 'catalog', 'ai', 'reports']);

    const items = buildNavItems(platformModules());
    expect(items.map((i) => i.node.code)).toEqual(['admin.tenants', 'admin.catalogs', 'admin.mga_catalogs', 'admin.ai', 'admin.settings']);
    expect(items[1].children.map((c) => c.node.name)).toEqual(['Sectores', 'Programas', 'Catálogo EDT', 'Catálogo de Entregables']);
    expect(items[0].children).toEqual([]);
  });

  it('firstNavPath: primer ítem navegable o null', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(firstNavPath(tenantModules())).toBe('/tenant/projects');
    expect(firstNavPath(platformModules())).toBe('/admin/tenants');
    expect(firstNavPath([])).toBeNull();
    // Sin proyectos, el primero es el catálogo.
    expect(firstNavPath(tenantModules().filter((m) => m.code !== 'projects'))).toBe('/tenant/catalog');
  });

  it('isGroupActive replica las reglas del menú de administración', () => {
    const [, catalogs, mgaCatalogs] = buildNavItems(platformModules());
    expect(isGroupActive(catalogs, '/admin/catalogs/sectors')).toBe(true);
    expect(isGroupActive(catalogs, '/admin/catalogo')).toBe(true);
    expect(isGroupActive(catalogs, '/admin/catalogs/mga-actors')).toBe(false);
    expect(isGroupActive(mgaCatalogs, '/admin/catalogs/mga-actors')).toBe(true);
    expect(isGroupActive(mgaCatalogs, '/admin/catalogs/sectors')).toBe(false);
  });

  it('titleForPath: el módulo o sección activo (prefijo más largo) da el título', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const admin = platformModules();
    const cases: Array<[string, string | null]> = [
      ['/admin/tenants', 'Gestión de Tenants'],
      ['/admin/catalogs/sectors', 'Sectores'],
      ['/admin/catalogs/mga-actors', 'Actores MGA'],
      ['/admin/catalogs/indicators', 'Catálogo EDT'],
      ['/admin/catalogs/funding-sources', 'Catálogo de Entregables'],
      ['/admin/catalogs', 'Catálogos Maestros'],
      ['/admin/catalogo', 'Catálogos Maestros'],
      ['/admin/ai', 'Gestión IA Aurora'],
      ['/admin/settings', 'Settings'],
      ['/admin/security', 'Settings'],
      ['/admin/users', null],
    ];
    for (const [path, title] of cases) expect(titleForPath(admin, path), path).toBe(title);

    const tenant = tenantModules();
    expect(titleForPath(tenant, '/tenant/projects')).toBe('Proyectos');
    expect(titleForPath(tenant, '/tenant/projects/abc/formulation')).toBe('Proyectos');
    expect(titleForPath(tenant, '/tenant/catalog')).toBe('Catálogo DNP');
    expect(titleForPath(tenant, '/tenant/ai')).toBe('Exploración MGA');
    expect(titleForPath([mod('projects', 'Mis Proyectos', '/tenant/projects')], '/tenant/projects')).toBe('Mis Proyectos');
  });
});
