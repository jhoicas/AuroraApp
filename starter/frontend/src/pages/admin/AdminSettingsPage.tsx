import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import Modal, { ghostBtn, inputClass, primaryBtn } from '../../components/admin/Modal';
import { useToast } from '../../components/ui/Toast';
import {
  TOKEN_EXPIRY_MAX,
  TOKEN_EXPIRY_MIN,
  fetchSystemSettings,
  saveSystemSettings,
  type SystemSettings,
} from '../../lib/systemSettingsApi';
import { useSystemStatusStore } from '../../store/systemStatusStore';

const BANNER_MAX = 500;

function Switch({ checked, onChange, label, danger }: { checked: boolean; onChange: (v: boolean) => void; label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006162] ${
        checked ? (danger ? 'bg-red-600' : 'bg-[#006162]') : 'bg-gray-300'
      }`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

function Section({ title, icon, children, tone }: { title: string; icon: string; children: React.ReactNode; tone?: 'danger' }) {
  return (
    <section className={`rounded-lg border bg-white p-6 shadow-sm space-y-5 ${tone === 'danger' ? 'border-red-200' : 'border-gray-200'}`}>
      <h3 className={`flex items-center gap-2 text-lg font-semibold ${tone === 'danger' ? 'text-red-700' : 'text-gray-800'}`}>
        <span className="material-symbols-outlined">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

export default function AdminSettingsPage() {
  const toast = useToast();
  const [form, setForm] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmMaintenance, setConfirmMaintenance] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchSystemSettings()
      .then((s) => alive && setForm(s))
      .catch(() => alive && toast.error('No se pudo cargar la configuración'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="p-4 text-gray-600">Cargando…</div>;
  if (!form) return <div className="p-4 text-red-700">No se pudo cargar la configuración.</div>;

  const patch = (p: Partial<SystemSettings>) => setForm((f) => (f ? { ...f, ...p } : f));
  const expiryValid = Number.isInteger(form.token_expiry_minutes) && form.token_expiry_minutes >= TOKEN_EXPIRY_MIN && form.token_expiry_minutes <= TOKEN_EXPIRY_MAX;
  const bannerValid = !form.banner_enabled || form.banner_message.trim() !== '';
  const canSave = expiryValid && bannerValid && !saving;

  const save = async () => {
    setSaving(true);
    try {
      const saved = await saveSystemSettings(form);
      setForm(saved);
      void useSystemStatusStore.getState().load();
      toast.success('Configuración guardada correctamente');
    } catch (e) {
      const msg = isAxiosError(e) ? (e.response?.data as { error?: string } | undefined)?.error : undefined;
      toast.error(msg ?? 'No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Section title="General y Avisos" icon="campaign">
        <div>
          <label htmlFor="support-email" className="mb-1 block text-sm font-medium text-gray-700">Email de soporte técnico</label>
          <input id="support-email" type="email" className={inputClass} value={form.support_email} onChange={(e) => patch({ support_email: e.target.value })} placeholder="soporte@ejemplo.gov.co" />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700">Banner de Anuncio Global</p>
            <p className="text-xs text-gray-500">Muestra un mensaje informativo en la parte superior de la app para todos los usuarios.</p>
          </div>
          <Switch checked={form.banner_enabled} onChange={(v) => patch({ banner_enabled: v })} label="Mostrar banner global" />
        </div>
        <div>
          <label htmlFor="banner-message" className="mb-1 block text-sm font-medium text-gray-700">Mensaje del banner</label>
          <textarea id="banner-message" rows={3} maxLength={BANNER_MAX} className={inputClass} value={form.banner_message} onChange={(e) => patch({ banner_message: e.target.value })} />
          <div className="mt-1 flex justify-between text-xs">
            <span className="text-red-600">{bannerValid ? '' : 'Escribe un mensaje para activar el banner'}</span>
            <span className="text-gray-500">{form.banner_message.length}/{BANNER_MAX}</span>
          </div>
        </div>
      </Section>

      <Section title="Seguridad de Sesión" icon="lock_clock">
        <div>
          <label htmlFor="token-expiry" className="mb-1 block text-sm font-medium text-gray-700">Expiración de tokens JWT (minutos)</label>
          <input
            id="token-expiry"
            type="number"
            min={TOKEN_EXPIRY_MIN}
            max={TOKEN_EXPIRY_MAX}
            className={`${inputClass} max-w-[10rem]`}
            value={Number.isNaN(form.token_expiry_minutes) ? '' : form.token_expiry_minutes}
            onChange={(e) => patch({ token_expiry_minutes: e.target.value === '' ? NaN : Number(e.target.value) })}
          />
          <p className={`mt-1 text-xs ${expiryValid ? 'text-gray-500' : 'text-red-600'}`}>Entre {TOKEN_EXPIRY_MIN} y {TOKEN_EXPIRY_MAX} minutos. Aplica a nuevos inicios de sesión.</p>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700">Forzar expiración periódica de sesiones</p>
            <p className="text-xs text-gray-500">La sesión no se renueva en silencio: al vencer el token el usuario debe iniciar sesión de nuevo.</p>
          </div>
          <Switch checked={form.force_session_expiry} onChange={(v) => patch({ force_session_expiry: v })} label="Forzar expiración periódica de sesiones" />
        </div>
      </Section>

      <Section title="Mantenimiento del Sistema" icon="construction" tone="danger">
        <div className="flex items-center justify-between gap-4 rounded-lg bg-red-50 p-4">
          <div>
            <p className="font-semibold text-red-800">Activar Modo Mantenimiento</p>
            <p className="text-xs text-red-700">Los usuarios que no sean SUPER_ADMIN verán la pantalla “Sistema en Mantenimiento”.</p>
          </div>
          <Switch
            danger
            checked={form.maintenance_mode}
            label="Activar Modo Mantenimiento"
            onChange={(v) => (v ? setConfirmMaintenance(true) : patch({ maintenance_mode: false }))}
          />
        </div>
      </Section>

      <div className="flex justify-end">
        <button type="button" className={primaryBtn} disabled={!canSave} onClick={() => void save()}>
          {saving ? 'Guardando…' : 'Guardar Cambios'}
        </button>
      </div>

      {confirmMaintenance && (
        <Modal title="¿Activar Modo Mantenimiento?" titleId="maintenance-confirm-title" onClose={() => setConfirmMaintenance(false)}>
          <div className="space-y-4 px-6 py-4">
            <p className="text-sm text-gray-700">
              Al guardar, todos los usuarios distintos de SUPER_ADMIN quedarán bloqueados y verán “Sistema en Mantenimiento”.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className={ghostBtn} onClick={() => setConfirmMaintenance(false)}>Cancelar</button>
              <button
                type="button"
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                onClick={() => {
                  patch({ maintenance_mode: true });
                  setConfirmMaintenance(false);
                }}
              >
                Sí, activar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
