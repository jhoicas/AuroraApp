import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  activateDocumentTemplate,
  createDocumentTemplate,
  listDocumentTemplates,
  type DocumentTemplate,
} from '../../lib/documentTemplatesApi';

export default function DocumentTemplatesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await listDocumentTemplates());
      setError(null);
    } catch {
      setError('No se pudieron cargar las plantillas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hasActive = items.some((t) => t.is_active);
  const defaultInUse = hasActive ? null : items.find((t) => t.is_system_default)?.id ?? null;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      setError('La operación falló. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    run(async () => {
      const t = await createDocumentTemplate({ name: 'Nueva plantilla' });
      navigate(`/tenant/settings/templates/${t.id}`);
    });

  const edit = (t: DocumentTemplate) =>
    run(async () => {
      if (t.is_system_default) {
        const copy = await createDocumentTemplate({ name: `${t.name} (copia)`, clone_from_id: t.id });
        navigate(`/tenant/settings/templates/${copy.id}`);
      } else {
        navigate(`/tenant/settings/templates/${t.id}`);
      }
    });

  const activate = (t: DocumentTemplate) =>
    run(async () => {
      await activateDocumentTemplate(t.id);
      await load();
    });

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Plantillas del Documento Técnico</h1>
          <p className="text-sm text-gray-500">Solo una plantilla está activa. Sin plantilla activa se usa la del sistema.</p>
        </div>
        <button type="button" onClick={create} disabled={busy} className="rounded-lg bg-[#006162] px-4 py-2 text-white disabled:opacity-50">
          Crear nueva
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {loading ? (
        <p className="text-gray-600">Cargando…</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white" aria-label="Plantillas">
          {items.map((t) => {
            const inUse = t.is_active || t.id === defaultInUse;
            return (
              <li key={t.id} className="flex items-center gap-3 p-3">
                <input
                  type="radio"
                  name="active-template"
                  aria-label={`Activar ${t.name}`}
                  checked={inUse}
                  disabled={busy || t.is_active}
                  onChange={() => activate(t)}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{t.name}</p>
                  <p className="text-xs text-gray-500">
                    {t.is_system_default ? 'Plantilla del sistema' : 'Plantilla de la entidad'}
                    {inUse && ' · En uso'}
                  </p>
                </div>
                <button type="button" onClick={() => edit(t)} disabled={busy} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
                  {t.is_system_default ? 'Clonar y editar' : 'Editar'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
