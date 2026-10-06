import { type FormEvent, useState } from 'react';
import { ASSIGNABLE_ROLES, ROLE_LABELS, type AdminUser, apiErrorMessage } from '../../lib/accessAdminApi';
import Modal, { ghostBtn, inputClass, primaryBtn } from './Modal';

export type UserFormValues = { email: string; full_name: string; role_code: string; password: string };

type UserFormModalProps = {
  /** Usuario a editar; sin él, alta. */
  user?: AdminUser;
  onClose: () => void;
  onSubmit: (values: UserFormValues) => Promise<void>;
};

export default function UserFormModal({ user, onClose, onSubmit }: UserFormModalProps) {
  const editing = Boolean(user);
  const [email, setEmail] = useState(user?.email ?? '');
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [role, setRole] = useState(user?.role ?? 'FORMULADOR');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit({ email, full_name: fullName, role_code: role, password });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo guardar el usuario'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={editing ? 'Editar usuario' : 'Nuevo usuario'} titleId="user-form-title" onClose={onClose}>
      <form onSubmit={handle} className="px-6 py-5 space-y-4">
        <div>
          <label htmlFor="user-name" className="block text-sm font-medium text-gray-700 mb-1">
            Nombre completo
          </label>
          <input id="user-name" required minLength={2} value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="user-email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input id="user-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="user-role" className="block text-sm font-medium text-gray-700 mb-1">
            Rol
          </label>
          <select id="user-role" value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        {!editing && (
          <div>
            <label htmlFor="user-password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña inicial
            </label>
            <input
              id="user-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>
        )}
        {error && (
          <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={ghostBtn}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} className={primaryBtn}>
            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
