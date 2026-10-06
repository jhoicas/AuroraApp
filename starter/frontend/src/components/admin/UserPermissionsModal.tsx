import { useEffect, useState } from 'react';
import {
  apiErrorMessage,
  usersApi,
  type AdminScope,
  type AdminUser,
  type PermissionRow,
  type RoleTemplate,
} from '../../lib/accessAdminApi';
import { changedInputs } from '../../lib/permissionMatrix';
import Modal, { ghostBtn, primaryBtn } from './Modal';
import PermissionMatrix from './PermissionMatrix';

type Props = {
  scope: AdminScope;
  user: AdminUser;
  onClose: () => void;
};

export default function UserPermissionsModal({ scope, user, onClose }: Props) {
  const [original, setOriginal] = useState<PermissionRow[]>([]);
  const [rows, setRows] = useState<PermissionRow[]>([]);
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [byRole, setByRole] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [perms, tpl] = await Promise.all([usersApi.getPermissions(scope, user.id), usersApi.roleTemplates(scope)]);
        if (cancelled) return;
        setOriginal(perms.permissions);
        setRows(perms.permissions);
        setTemplates(tpl);
        setByRole(perms.resolved_by_role);
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'No se pudieron cargar los permisos'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope, user.id]);

  const dirty = changedInputs(rows, original).length > 0;

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      const saved = await usersApi.setPermissions(scope, user.id, changedInputs(rows, original));
      setOriginal(saved.permissions);
      setRows(saved.permissions);
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudieron guardar los permisos'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Permisos · ${user.full_name}`} titleId="permissions-title" onClose={onClose} wide>
      <div className="px-6 py-5 space-y-4">
        {loading && <p className="text-gray-600">Cargando permisos…</p>}
        {!loading && byRole && (
          <div role="status" className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            Este usuario es administrador: sus permisos se resuelven por rol y no se editan por módulo.
          </div>
        )}
        {!loading && !byRole && (
          <PermissionMatrix rows={rows} templates={templates} userRole={user.role} onChange={setRows} />
        )}
        {error && (
          <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ghostBtn}>
            Cerrar
          </button>
          {!byRole && (
            <button type="button" onClick={save} disabled={saving || !dirty} className={primaryBtn}>
              {saving ? 'Guardando…' : 'Guardar permisos'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
