import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ROLE_LABELS,
  TEMPLATE_ROLES,
  type PermissionRow,
  type RoleTemplate,
} from '../../lib/accessAdminApi';
import {
  ACTION_LABELS,
  MATRIX_ACTIONS,
  applyTemplate,
  buildMatrix,
  cellState,
  getFlag,
  setCell,
  type MatrixAction,
  type MatrixNode,
} from '../../lib/permissionMatrix';
import { ghostBtn } from './Modal';

type PermissionMatrixProps = {
  rows: PermissionRow[];
  templates: RoleTemplate[];
  /** Rol actual del usuario: plantilla preseleccionada. */
  userRole?: string;
  disabled?: boolean;
  onChange: (rows: PermissionRow[]) => void;
};

function Cell({
  label,
  state,
  disabled,
  onToggle,
}: {
  label: string;
  state: 'checked' | 'unchecked' | 'indeterminate';
  disabled: boolean;
  onToggle: (next: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'indeterminate';
  }, [state]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={state === 'checked'}
      disabled={disabled}
      onChange={(e) => onToggle(e.target.checked)}
      className="h-4 w-4 accent-[#006162] disabled:opacity-40"
    />
  );
}

export default function PermissionMatrix({ rows, templates, userRole, disabled, onChange }: PermissionMatrixProps) {
  const nodes = useMemo(() => buildMatrix(rows), [rows]);
  const initial = TEMPLATE_ROLES.find((r) => r === userRole) ?? TEMPLATE_ROLES[0];
  const [templateRole, setTemplateRole] = useState<string>(initial);

  const apply = () => {
    onChange(applyTemplate(rows, templates.find((t) => t.role === templateRole)));
  };

  const renderRow = (node: MatrixNode, row: PermissionRow, isChild: boolean) => {
    const isParentRow = !isChild;
    return (
      <tr key={row.module_code} className={isChild ? 'bg-white' : 'bg-[#f9f9ff]'}>
        <th
          scope="row"
          className={`py-2 pr-3 text-left text-sm ${isChild ? 'pl-10 font-normal text-gray-600' : 'pl-3 font-semibold text-[#121c2c]'}`}
        >
          {row.name}
          {!row.enabled_in_tenant && <span className="ml-2 text-xs text-amber-700">(no habilitado en la entidad)</span>}
        </th>
        {MATRIX_ACTIONS.map((a: MatrixAction) => {
          const state = isParentRow
            ? cellState(node, a)
            : getFlag(row, a)
              ? 'checked'
              : 'unchecked';
          return (
            <td key={a} className="py-2 text-center">
              <Cell
                label={`${row.name} · ${ACTION_LABELS[a]}`}
                state={state}
                disabled={Boolean(disabled) || !row.enabled_in_tenant}
                onToggle={(next) => onChange(setCell(rows, row.module_code, a, next))}
              />
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
        <div>
          <label htmlFor="template-role" className="block text-sm font-medium text-gray-700 mb-1">
            Plantilla de rol
          </label>
          <select
            id="template-role"
            value={templateRole}
            disabled={disabled}
            onChange={(e) => setTemplateRole(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          >
            {TEMPLATE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={apply} disabled={disabled} className={`${ghostBtn} border border-gray-300`}>
          Aplicar plantilla de rol
        </button>
        <p className="text-xs text-gray-500">Sobrescribe todas las casillas con los valores por defecto del rol.</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="py-2 pl-3 text-left text-sm font-semibold text-gray-700">
                Módulo
              </th>
              {MATRIX_ACTIONS.map((a) => (
                <th key={a} scope="col" className="w-24 py-2 text-center text-sm font-semibold text-gray-700">
                  {ACTION_LABELS[a]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {nodes.flatMap((node) => [
              renderRow(node, node.row, false),
              ...node.children.map((c) => renderRow(node, c, true)),
            ])}
          </tbody>
        </table>
      </div>
    </div>
  );
}
