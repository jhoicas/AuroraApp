import type { ReactNode } from 'react';
import type { CatalogOds } from '../../store/catalogStore';

type OdsDetailModalProps = {
  ods: CatalogOds;
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

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#E2E8F0] bg-[#f8faf9]/80 p-4 sm:p-5">
      <h4 className="mb-4 flex items-center gap-2 text-base font-semibold text-[#006162]">
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
        {title}
      </h4>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">{children}</dl>
    </section>
  );
}

export default function OdsDetailModal({ ods, onClose }: OdsDetailModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-2xl rounded-xl bg-white shadow-xl border border-[#bec9c8] max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ods-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#bec9c8] px-6 py-4 shrink-0">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#006162]">
              Ficha ODS
            </p>
            <h3
              id="ods-detail-title"
              className="mt-1 text-lg font-semibold text-[#121c2c] break-words"
            >
              {displayValue(ods.descripcion_meta_ods) !== '—'
                ? ods.descripcion_meta_ods
                : displayValue(ods.descripcion_objetivo_ods)}
            </h3>
            <p className="mt-0.5 text-sm text-[#3f4949] font-mono">
              Obj. {displayValue(ods.cod_objetivo_ods)} · Meta {displayValue(ods.codigo_meta_ods)}
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

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <Section title="Objetivo ODS" icon="public">
            <Field label="Código objetivo ODS" value={ods.cod_objetivo_ods} />
            <div className="sm:col-span-2">
              <Field
                label="Descripción objetivo ODS"
                value={ods.descripcion_objetivo_ods}
                multiline
              />
            </div>
          </Section>

          <Section title="Meta ODS" icon="flag">
            <Field label="Código meta ODS" value={ods.codigo_meta_ods} />
            <div className="sm:col-span-2">
              <Field label="Descripción meta ODS" value={ods.descripcion_meta_ods} multiline />
            </div>
          </Section>
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
