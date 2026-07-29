import type { CatalogActivity } from '../../store/catalogStore';

type ActivityDetailModalProps = {
  activity: CatalogActivity;
  onClose: () => void;
};

function displayValue(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  if (!v || v === '0') return '—';
  return v;
}

function Field({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string | null | undefined;
  multiline?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-[#6f7979]">{label}</dt>
      <dd
        className={`mt-1 text-sm text-[#121c2c] break-words ${
          multiline ? 'whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto pr-1' : ''
        }`}
      >
        {displayValue(value)}
      </dd>
    </div>
  );
}

export default function ActivityDetailModal({ activity, onClose }: ActivityDetailModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-xl rounded-xl bg-white shadow-xl border border-[#bec9c8] max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#bec9c8] px-6 py-4 shrink-0">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#006162]">
              Ficha actividad
            </p>
            <h3
              id="activity-detail-title"
              className="mt-1 text-lg font-semibold text-[#121c2c] break-words"
            >
              {displayValue(activity.listado_de_actividades)}
            </h3>
            <p className="mt-0.5 text-sm text-[#3f4949] font-mono">
              {displayValue(activity.codigo_actividad)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-[#6f7979] hover:text-[#006162] rounded-lg p-1"
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          <section className="rounded-xl border border-[#E2E8F0] bg-[#f8faf9]/80 p-4 sm:p-5">
            <h4 className="mb-4 flex items-center gap-2 text-base font-semibold text-[#006162]">
              <span className="material-symbols-outlined text-[20px]">task_alt</span>
              Actividad
            </h4>
            <dl className="grid grid-cols-1 gap-y-4">
              <Field label="Código actividad" value={activity.codigo_actividad} />
              <Field label="Unidad de medida" value={activity.unidad_de_medida} />
              <Field
                label="Listado de actividades"
                value={activity.listado_de_actividades}
                multiline
              />
            </dl>
          </section>
        </div>

        <div className="border-t border-[#bec9c8] px-6 py-4 flex justify-end shrink-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-5 rounded-lg bg-[#006162] text-white font-semibold hover:opacity-90 transition-opacity"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
