import { describe, expect, it } from 'vitest';
import { homeForRole, homeForUser, isSuperAdmin, normalizeRole, roleIsAllowed, Roles } from './roles';

describe('normalizeRole', () => {
  it.each([
    ['super_admin', 'SUPER_ADMIN'],
    ['Super-Admin', 'SUPER_ADMIN'],
    ['  tenant-admin  ', 'TENANT_ADMIN'],
    ['FORMULADOR', 'FORMULADOR'],
    ['', ''],
  ])('normaliza %s → %s', (input, expected) => {
    expect(normalizeRole(input)).toBe(expected);
  });

  it('devuelve cadena vacía para null y undefined', () => {
    expect(normalizeRole(null)).toBe('');
    expect(normalizeRole(undefined)).toBe('');
  });
});

describe('isSuperAdmin', () => {
  it.each(['SUPER_ADMIN', 'super_admin', 'Super-Admin', '  super-admin  '])(
    'reconoce %s como super admin',
    (role) => {
      expect(isSuperAdmin(role)).toBe(true);
    },
  );

  it.each(['TENANT_ADMIN', 'FORMULADOR', '', null, undefined])(
    'rechaza %s',
    (role) => {
      expect(isSuperAdmin(role)).toBe(false);
    },
  );
});

describe('homeForUser', () => {
  it('lleva al super admin a la gestión de tenants aunque tenga tenant_id', () => {
    expect(homeForUser({ role: 'super_admin', tenant_id: 'tenant-1' })).toBe('/admin/tenants');
  });

  it('lleva a un usuario con tenant a sus proyectos', () => {
    expect(homeForUser({ role: 'FORMULADOR', tenant_id: 'tenant-1' })).toBe('/tenant/projects');
  });

  it.each([
    { role: 'FORMULADOR', tenant_id: null },
    { role: 'VIEWER', tenant_id: undefined },
    { role: '', tenant_id: null },
  ])('devuelve /login sin tenant para %o', (user) => {
    expect(homeForUser(user)).toBe('/login');
  });
});

describe('homeForRole (deprecado)', () => {
  it('delega en homeForUser', () => {
    expect(homeForRole('SUPER_ADMIN')).toBe('/admin/tenants');
    expect(homeForRole('FORMULADOR', 'tenant-1')).toBe('/tenant/projects');
    expect(homeForRole(null)).toBe('/login');
  });
});

describe('roleIsAllowed', () => {
  it('acepta el rol comparando de forma normalizada', () => {
    expect(roleIsAllowed('tenant-admin', ['TENANT_ADMIN'])).toBe(true);
    expect(roleIsAllowed('FORMULADOR', ['super_admin', 'formulador'])).toBe(true);
  });

  it('rechaza roles fuera de la lista', () => {
    expect(roleIsAllowed('VIEWER', ['SUPER_ADMIN', 'TENANT_ADMIN'])).toBe(false);
  });

  it('rechaza roles vacíos aunque la lista los incluya', () => {
    expect(roleIsAllowed('', [''])).toBe(false);
    expect(roleIsAllowed(null, ['SUPER_ADMIN'])).toBe(false);
    expect(roleIsAllowed(undefined, ['SUPER_ADMIN'])).toBe(false);
  });

  it('rechaza con lista de permitidos vacía', () => {
    expect(roleIsAllowed('SUPER_ADMIN', [])).toBe(false);
  });
});

describe('Roles', () => {
  it('expone los códigos canónicos del backend', () => {
    expect(Roles).toEqual({
      SuperAdmin: 'SUPER_ADMIN',
      TenantAdmin: 'TENANT_ADMIN',
      Formulador: 'FORMULADOR',
      Evaluador: 'EVALUADOR',
      Analista: 'ANALISTA',
      Viewer: 'VIEWER',
    });
  });
});
