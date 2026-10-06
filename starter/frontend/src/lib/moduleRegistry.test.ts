import { beforeEach, describe, expect, it, vi } from 'vitest';
import { moduleRegistry, registeredModules, resetRegistryWarnings, warnUnregistered } from './moduleRegistry';
import { mod, platformModules, tenantModules } from '../test/accessFixtures';

describe('moduleRegistry', () => {
  beforeEach(() => resetRegistryWarnings());

  it('registra todos los módulos con UI del manifiesto del backend', () => {
    const expected = [
      'projects', 'mga', 'mga.identificacion', 'mga.preparacion', 'mga.evaluacion', 'mga.programacion', 'mga.presentar',
      'catalog', 'ai', 'reports',
      'admin.tenants', 'admin.catalogs', 'admin.mga_catalogs', 'admin.ai', 'admin.settings',
      ...['sectors', 'programs', 'products', 'edt', 'deliverables', 'activities', 'ods', 'pnd', 'procesos', 'locations', 'measurement-units']
        .map((k) => `admin.catalogs.${k}`),
      ...['actors', 'entities', 'positions'].map((k) => `admin.mga_catalogs.${k}`),
    ];
    for (const code of expected) expect(moduleRegistry[code], code).toBeDefined();
  });

  it('un código desconocido se advierte una sola vez y no lanza', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(warnUnregistered('modulo.nuevo')).toBe(true);
    expect(warnUnregistered('modulo.nuevo')).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('modulo.nuevo');
    expect(warnUnregistered('projects')).toBe(false);
  });

  it('registeredModules omite (con aviso) lo desconocido y conserva el resto', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = registeredModules([...tenantModules(), mod('algo.futuro', 'Futuro', '/tenant/futuro')]);
    const codes = out.map((o) => o.node.code);
    expect(codes).toContain('projects');
    expect(codes).not.toContain('algo.futuro');
    // `users` aún no tiene pantalla (Fase 6): también se omite con aviso.
    expect(codes).not.toContain('users');
    expect(warn).toHaveBeenCalled();
  });

  it('las secciones se recorren junto a su módulo', () => {
    const codes = registeredModules(platformModules()).map((o) => o.node.code);
    expect(codes).toContain('admin.catalogs.sectors');
    expect(codes).toContain('admin.mga_catalogs.actors');
  });
});
