import { useEffect, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { inputClass, primaryBtn } from '../../components/admin/Modal';
import { useToast } from '../../components/ui/Toast';
import { fetchAISettings, saveAISettings, type AISettings } from '../../lib/aiSettingsApi';

const emptyForm: AISettings = {
  gemini_api_key: '',
  gemini_model: 'gemini-1.5-flash',
  anthropic_api_key: '',
  anthropic_model: 'claude-haiku-4-5-20251001',
};

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-5">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
        <span className="material-symbols-outlined">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

export default function AISettingsPage() {
  const toast = useToast();
  const [form, setForm] = useState<AISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchAISettings()
      .then((s) => {
        if (alive) setForm({ ...emptyForm, ...s });
      })
      .catch(() => {
        if (alive) toast.error('No se pudo cargar la configuración de IA');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="p-4 text-gray-600">Cargando…</div>;
  if (!form) return <div className="p-4 text-red-700">No se pudo cargar la configuración de IA.</div>;

  const patch = (p: Partial<AISettings>) => setForm((f) => (f ? { ...f, ...p } : f));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await saveAISettings(form);
      setForm(saved);
      toast.success('Configuración de IA guardada correctamente');
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { error?: string } | undefined)?.error
        : undefined;
      toast.error(msg ?? 'No se pudo guardar la configuración de IA');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-gray-900">Configuración de IA</h2>
        <p className="mt-1 text-sm text-gray-600">
          Administra las API keys y modelos de Gemini y Anthropic. Las claves se almacenan en la base
          de datos y se enmascaran al cargarlas. Si dejas una key enmascarada sin editarla, se conserva
          el valor actual.
        </p>
      </header>

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-6">
        <Section title="Google Gemini" icon="neurology">
          <div>
            <label htmlFor="gemini-key" className="mb-1 block text-sm font-medium text-gray-700">
              API Key
            </label>
            <input
              id="gemini-key"
              type="password"
              autoComplete="off"
              className={inputClass}
              value={form.gemini_api_key}
              onChange={(e) => patch({ gemini_api_key: e.target.value })}
              placeholder="AIza…"
            />
          </div>
          <div>
            <label htmlFor="gemini-model" className="mb-1 block text-sm font-medium text-gray-700">
              Modelo
            </label>
            <input
              id="gemini-model"
              type="text"
              className={inputClass}
              value={form.gemini_model}
              onChange={(e) => patch({ gemini_model: e.target.value })}
              placeholder="gemini-1.5-flash"
            />
          </div>
        </Section>

        <Section title="Anthropic Claude" icon="smart_toy">
          <div>
            <label htmlFor="anthropic-key" className="mb-1 block text-sm font-medium text-gray-700">
              API Key
            </label>
            <input
              id="anthropic-key"
              type="password"
              autoComplete="off"
              className={inputClass}
              value={form.anthropic_api_key}
              onChange={(e) => patch({ anthropic_api_key: e.target.value })}
              placeholder="sk-ant-…"
            />
          </div>
          <div>
            <label htmlFor="anthropic-model" className="mb-1 block text-sm font-medium text-gray-700">
              Modelo
            </label>
            <input
              id="anthropic-model"
              type="text"
              className={inputClass}
              value={form.anthropic_model}
              onChange={(e) => patch({ anthropic_model: e.target.value })}
              placeholder="claude-haiku-4-5-20251001"
            />
          </div>
        </Section>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className={primaryBtn}>
            {saving ? 'Guardando…' : 'Guardar configuración'}
          </button>
        </div>
      </form>
    </div>
  );
}
