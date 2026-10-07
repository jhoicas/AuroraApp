import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TemplateEditor from '../../components/Tenant/templates/TemplateEditor';
import {
  createDocumentTemplate,
  getDocumentTemplate,
  patchDocumentTemplate,
  type DocumentTemplate,
} from '../../lib/documentTemplatesApi';
import { renderPreview } from '../../lib/mgaVariables';
import { autosaveLabel, useAutosave } from '../../lib/useAutosave';

type Draft = { name: string; html: string };

export default function DocumentTemplateEditorPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [tpl, setTpl] = useState<DocumentTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: '', html: '' });
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getDocumentTemplate(id)
      .then((t) => {
        if (cancelled) return;
        setTpl(t);
        setDraft({ name: t.name, html: t.html_content ?? '' });
      })
      .catch(() => !cancelled && setError('No se pudo cargar la plantilla.'));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const readOnly = tpl?.tenant_id == null && tpl !== null;

  const save = useCallback(
    (d: Draft) => patchDocumentTemplate(id, { name: d.name, html_content: d.html }),
    [id],
  );
  const { status, savedAt, flush, reset } = useAutosave<Draft>({
    value: draft,
    onSave: save,
    delayMs: 3000,
    enabled: !!tpl && !readOnly,
  });

  // Carga inicial: lo cargado ya está persistido.
  const loadedId = tpl?.id;
  useEffect(() => {
    if (tpl) reset({ name: tpl.name, html: tpl.html_content ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedId]);

  // Refresca la etiqueta relativa ("hace N min").
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const preview = useMemo(() => renderPreview(draft.html), [draft.html]);

  const saveAndBack = async () => {
    try {
      await flush();
      navigate('/tenant/settings/templates');
    } catch {
      setError('No se pudo guardar. Intenta de nuevo antes de salir.');
    }
  };

  const cloneAndEdit = async () => {
    if (!tpl) return;
    const copy = await createDocumentTemplate({ name: `${tpl.name} (copia)`, clone_from_id: tpl.id });
    navigate(`/tenant/settings/templates/${copy.id}`, { replace: true });
  };

  if (error && !tpl) return <div role="alert" className="text-red-700">{error}</div>;
  if (!tpl) return <div className="text-gray-600">Cargando plantilla…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          aria-label="Nombre de la plantilla"
          value={draft.name}
          disabled={readOnly}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          className="flex-1 min-w-[12rem] rounded-lg border border-gray-300 px-3 py-2 text-lg font-semibold disabled:bg-gray-100"
        />
        <span role="status" aria-live="polite" className="text-xs text-gray-500 min-w-[10rem] text-right">
          {autosaveLabel(status, savedAt)}
        </span>
        {readOnly ? (
          <button type="button" onClick={cloneAndEdit} className="rounded-lg bg-[#006162] px-4 py-2 text-white">
            Clonar y editar
          </button>
        ) : (
          <button type="button" onClick={saveAndBack} className="rounded-lg bg-[#006162] px-4 py-2 text-white">
            Guardar y Regresar
          </button>
        )}
      </div>
      {readOnly && (
        <p className="text-sm text-amber-700">Las plantillas del sistema son de solo lectura. Clónala para personalizarla.</p>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <div className="grid gap-4 xl:grid-cols-2">
        <section aria-label="Editor">
          <TemplateEditor
            key={tpl.id}
            initialHtml={tpl.html_content ?? ''}
            readOnly={readOnly}
            onChange={(html) => setDraft((d) => (d.html === html ? d : { ...d, html }))}
          />
        </section>
        <section aria-label="Vista previa" className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Vista previa (datos simulados)</h3>
          <div className="tpl-prose" data-testid="template-preview" dangerouslySetInnerHTML={{ __html: preview }} />
        </section>
      </div>
    </div>
  );
}
