import { describe, expect, it } from 'vitest';
import type { PermissionRow, RoleTemplate } from './accessAdminApi';
import { applyTemplate, buildMatrix, cellState, changedInputs, setCell } from './permissionMatrix';

const row = (code: string, extra: Partial<PermissionRow> = {}): PermissionRow => ({
  module_code: code,
  name: code,
  kind: 'MODULE',
  enabled_in_tenant: true,
  can_view: false,
  can_create: false,
  can_edit: false,
  can_delete: false,
  default_view: false,
  default_create: false,
  default_edit: false,
  default_delete: false,
  ...extra,
});

const rows = (): PermissionRow[] => [
  row('mga'),
  row('mga.a', { kind: 'SECTION', parent_code: 'mga' }),
  row('mga.b', { kind: 'SECTION', parent_code: 'mga' }),
  row('reports'),
];

describe('permissionMatrix', () => {
  it('agrupa secciones bajo su módulo', () => {
    const m = buildMatrix(rows());
    expect(m.map((n) => n.row.module_code)).toEqual(['mga', 'reports']);
    expect(m[0].children.map((c) => c.module_code)).toEqual(['mga.a', 'mga.b']);
  });

  it('el padre aplica cascada a los hijos', () => {
    const out = setCell(rows(), 'mga', 'edit', true);
    expect(out.filter((r) => r.can_edit).map((r) => r.module_code)).toEqual(['mga', 'mga.a', 'mga.b']);
    expect(out.every((r) => r.module_code === 'reports' || r.can_view)).toBe(true);
  });

  it('un hijo suelto deja al padre indeterminado', () => {
    const out = setCell(rows(), 'mga.a', 'view', true);
    expect(cellState(buildMatrix(out)[0], 'view')).toBe('indeterminate');
    expect(cellState(buildMatrix(setCell(out, 'mga', 'view', true))[0], 'view')).toBe('checked');
  });

  it('quitar ver limpia el resto de acciones', () => {
    const on = setCell(rows(), 'reports', 'delete', true);
    const off = setCell(on, 'reports', 'view', false);
    expect(off.find((r) => r.module_code === 'reports')).toMatchObject({
      can_view: false,
      can_create: false,
      can_edit: false,
      can_delete: false,
    });
  });

  it('no modifica módulos fuera del techo del tenant', () => {
    const locked = [row('reports', { enabled_in_tenant: false })];
    expect(setCell(locked, 'reports', 'view', true)[0].can_view).toBe(false);
  });

  it('aplicar plantilla sobrescribe todo según el rol', () => {
    const start = setCell(rows(), 'reports', 'delete', true);
    const tpl: RoleTemplate = {
      role: 'VIEWER',
      modules: { mga: { can_view: true, can_create: false, can_edit: false, can_delete: false } },
    };
    const out = applyTemplate(start, tpl);
    expect(out.find((r) => r.module_code === 'mga')?.can_view).toBe(true);
    expect(out.find((r) => r.module_code === 'reports')).toMatchObject({ can_view: false, can_delete: false });
  });

  it('solo envía las filas modificadas', () => {
    const base = rows();
    const next = setCell(base, 'reports', 'view', true);
    expect(changedInputs(next, base)).toEqual([
      { module_code: 'reports', can_view: true, can_create: false, can_edit: false, can_delete: false },
    ]);
  });
});
