import type { PermissionInput, PermissionRow, RoleTemplate } from './accessAdminApi';

export type MatrixAction = 'view' | 'create' | 'edit' | 'delete';
export const MATRIX_ACTIONS: MatrixAction[] = ['view', 'create', 'edit', 'delete'];
export const ACTION_LABELS: Record<MatrixAction, string> = {
  view: 'Ver',
  create: 'Crear',
  edit: 'Editar',
  delete: 'Eliminar',
};

export type MatrixNode = { row: PermissionRow; children: PermissionRow[] };

const KEY: Record<MatrixAction, 'can_view' | 'can_create' | 'can_edit' | 'can_delete'> = {
  view: 'can_view',
  create: 'can_create',
  edit: 'can_edit',
  delete: 'can_delete',
};

export function getFlag(row: PermissionRow, action: MatrixAction): boolean {
  return row[KEY[action]];
}

/** Agrupa filas: cada módulo raíz con sus secciones (hijos), en el orden recibido. */
export function buildMatrix(rows: PermissionRow[]): MatrixNode[] {
  const byParent = new Map<string, PermissionRow[]>();
  const roots: PermissionRow[] = [];
  const codes = new Set(rows.map((r) => r.module_code));
  for (const r of rows) {
    if (r.parent_code && codes.has(r.parent_code)) {
      byParent.set(r.parent_code, [...(byParent.get(r.parent_code) ?? []), r]);
    } else {
      roots.push(r);
    }
  }
  return roots.map((row) => ({ row, children: byParent.get(row.module_code) ?? [] }));
}

/** Escribir exige ver: quitar `view` limpia el resto; marcar create/edit/delete marca `view`. */
function withFlag(row: PermissionRow, action: MatrixAction, value: boolean): PermissionRow {
  if (!row.enabled_in_tenant) return row;
  const next = { ...row, [KEY[action]]: value };
  if (action === 'view' && !value) {
    next.can_create = false;
    next.can_edit = false;
    next.can_delete = false;
  }
  if (action !== 'view' && value) next.can_view = true;
  return next;
}

/** Cambia una celda; si es un módulo con secciones, la cascada aplica el mismo valor a sus hijos. */
export function setCell(
  rows: PermissionRow[],
  code: string,
  action: MatrixAction,
  value: boolean,
): PermissionRow[] {
  return rows.map((r) => {
    if (r.module_code === code || r.parent_code === code) return withFlag(r, action, value);
    return r;
  });
}

export type CellState = 'checked' | 'unchecked' | 'indeterminate';

/** Estado de la celda de un nodo: un padre refleja a sus hijos (indeterminado si hay mezcla). */
export function cellState(node: MatrixNode, action: MatrixAction): CellState {
  const group = [node.row, ...node.children].filter((r) => r.enabled_in_tenant);
  if (group.length === 0) return 'unchecked';
  const on = group.filter((r) => getFlag(r, action)).length;
  if (on === 0) return 'unchecked';
  return on === group.length ? 'checked' : 'indeterminate';
}

/** Sobrescribe todas las casillas con los defaults del rol (módulo ausente en la plantilla ⇒ sin acceso). */
export function applyTemplate(rows: PermissionRow[], template: RoleTemplate | undefined): PermissionRow[] {
  if (!template) return rows;
  return rows.map((r) => {
    if (!r.enabled_in_tenant) return r;
    const t = template.modules[r.module_code];
    return {
      ...r,
      can_view: t?.can_view ?? false,
      can_create: t?.can_create ?? false,
      can_edit: t?.can_edit ?? false,
      can_delete: t?.can_delete ?? false,
    };
  });
}

/** Solo las filas que cambiaron respecto al original (evita enviar módulos no asignables). */
export function changedInputs(current: PermissionRow[], original: PermissionRow[]): PermissionInput[] {
  const before = new Map(original.map((r) => [r.module_code, r]));
  return current
    .filter((r) => {
      const o = before.get(r.module_code);
      return (
        r.enabled_in_tenant &&
        o &&
        MATRIX_ACTIONS.some((a) => getFlag(r, a) !== getFlag(o, a))
      );
    })
    .map((r) => ({
      module_code: r.module_code,
      can_view: r.can_view,
      can_create: r.can_create,
      can_edit: r.can_edit,
      can_delete: r.can_delete,
    }));
}
