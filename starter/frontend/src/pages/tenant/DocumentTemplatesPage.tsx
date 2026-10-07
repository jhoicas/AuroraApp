import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Trash2, X } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { renderPreview } from '../../lib/mgaVariables';
import {
  activateDocumentTemplate,
  createDocumentTemplate,
  deleteDocumentTemplate,
  getDocumentTemplate,
  listDocumentTemplates,
  type DocumentTemplate,
} from '../../lib/documentTemplatesApi';

export default function DocumentTemplatesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [previewing, setPreviewing] = useState<{ name: string; html: string } | null>(null);
  const [deleting, setDeleting] = useState<DocumentTemplate | null>(null);
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

  const preview = (t: DocumentTemplate) =>
    run(async () => {
      const full = await getDocumentTemplate(t.id);
      setPreviewing({ name: t.name, html: full.html_content ?? '' });
    });

  const confirmDelete = () => {
    const t = deleting;
    if (!t) return;
    setDeleting(null);
    void run(async () => {
      await deleteDocumentTemplate(t.id);
      toast.success(`Plantilla "${t.name}" eliminada.`);
      await load();
    });
  };

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
                <button
                  type="button"
                  onClick={() => preview(t)}
                  disabled={busy}
                  aria-label={`Vista previa ${t.name}`}
                  title="Vista previa"
                  className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50"
                >
                  <Eye size={16} aria-hidden="true" />
                </button>
                {!t.is_system_default && (
                  <button
                    type="button"
                    onClick={() => setDeleting(t)}
                    disabled={busy}
                    aria-label={`Eliminar ${t.name}`}
                    title="Eliminar"
                    className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                )}
                <button type="button" onClick={() => edit(t)} disabled={busy} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
                  {t.is_system_default ? 'Clonar y editar' : 'Editar'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {previewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div role="dialog" aria-modal="true" aria-label={`Vista previa de ${previewing.name}`} className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
              <h2 className="font-semibold text-gray-800">{previewing.name} <span className="text-xs font-normal text-gray-500">(datos simulados)</span></h2>
              <button type="button" onClick={() => setPreviewing(null)} aria-label="Cerrar vista previa" className="rounded p-1 text-gray-500 hover:bg-gray-100">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              <div className="tpl-prose" data-testid="template-preview-modal" dangerouslySetInnerHTML={{ __html: renderPreview(previewing.html) }} />
            </div>
          </div>
        </div>
      )}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="del-tpl-title" aria-describedby="del-tpl-desc" className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 id="del-tpl-title" className="mb-2 text-lg font-semibold text-gray-900">Eliminar plantilla</h2>
            <p id="del-tpl-desc" className="mb-6 text-sm text-gray-600">
              ¿Estás seguro de que deseas eliminar esta plantilla? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setDeleting(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Cancelar</button>
              <button type="button" onClick={confirmDelete} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
