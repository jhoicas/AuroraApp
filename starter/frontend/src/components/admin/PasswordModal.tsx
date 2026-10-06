import { type FormEvent, useState } from 'react';
import { apiErrorMessage, type AdminUser } from '../../lib/accessAdminApi';
import Modal, { ghostBtn, inputClass, primaryBtn } from './Modal';

type PasswordModalProps = {
  user: AdminUser;
  onClose: () => void;
  onSubmit: (newPassword: string) => Promise<void>;
};

export default function PasswordModal({ user, onClose, onSubmit }: PasswordModalProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit(password);
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo cambiar la contraseña'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Cambiar contraseña · ${user.full_name}`} titleId="password-title" onClose={onClose}>
      <form onSubmit={handle} className="px-6 py-5 space-y-4">
        <p className="text-sm text-gray-600">Al cambiarla se cierran las sesiones activas del usuario.</p>
        <div>
          <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
            Nueva contraseña
          </label>
          <input id="new-password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
            Confirmar contraseña
          </label>
          <input id="confirm-password" type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
        </div>
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
            {saving ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
