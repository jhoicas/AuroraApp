import type { ReactNode } from 'react';
import type { Product } from '../../store/catalogStore';

type ProductDetailModalProps = {
  product: Product;
  onClose: () => void;
};

function yesNo(value: boolean): string {
  return value ? 'Sí' : 'No';
}

function Field({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
  multiline?: boolean;
}) {
  const display =
    typeof value === 'boolean'
      ? yesNo(value)
      : value == null || String(value).trim() === ''
        ? '—'
        : String(value);

  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-[#6f7979]">{label}</dt>
      <dd
        className={`mt-1 text-sm text-[#121c2c] break-words ${
          multiline ? 'whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto pr-1' : ''
        }`}
      >
        {display}
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

export default function ProductDetailModal({ product, onClose }: ProductDetailModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-3xl rounded-xl bg-white shadow-xl border border-[#bec9c8] max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#bec9c8] px-6 py-4 shrink-0">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#006162]">
              Ficha técnica MGA
            </p>
            <h3
              id="product-detail-title"
              className="mt-1 text-lg font-semibold text-[#121c2c] break-words"
            >
              {product.producto || 'Producto sin nombre'}
            </h3>
            <p className="mt-0.5 text-sm text-[#3f4949] font-mono">
              {product.codigo_del_producto || '—'}
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
          <Section title="Información general" icon="info">
            <Field label="Código del producto" value={product.codigo_del_producto} />
            <Field label="Nombre / Producto" value={product.producto} multiline />
            <div className="sm:col-span-2">
              <Field label="Descripción" value={product.descripcion} multiline />
            </div>
          </Section>

          <Section title="Clasificación" icon="account_tree">
            <Field label="Sector (código)" value={product.sector} />
            <Field label="Nombre del sector" value={product.nombre_del_sector} />
            <Field label="Código del programa" value={product.codigo_del_programa} />
            <Field label="Nombre del programa" value={product.nombre_del_programa} multiline />
            <Field label="Es nacional" value={product.es_nacional} />
            <Field label="Es territorial" value={product.es_territorial} />
          </Section>

          <Section title="Indicadores" icon="monitoring">
            <Field label="Medido a través de" value={product.medido_a_traves_de} multiline />
            <Field
              label="Código del indicador de producto"
              value={product.codigo_del_indicador_de_producto}
            />
            <div className="sm:col-span-2">
              <Field label="Indicador de producto" value={product.indicador_de_producto} multiline />
            </div>
            <Field label="Unidad de medida" value={product.unidad_de_medida} />
            <Field label="Indicador principal" value={product.indicador_principal} />
          </Section>

          <Section title="Metas globales (ODS)" icon="public">
            <div className="sm:col-span-2">
              <Field
                label="Objetivos de Desarrollo Sostenible — ODS"
                value={product.objetivos_de_desarrollo_sostenible_ods}
                multiline
              />
            </div>
            <div className="sm:col-span-2">
              <Field label="Meta ODS" value={product.meta_ods} multiline />
            </div>
          </Section>

          <Section title="SUIFP" icon="account_balance">
            <div className="sm:col-span-2">
              <Field
                label="Tipología General SUIFP"
                value={product.tipologia_general_suifp}
                multiline
              />
            </div>
            <Field label="Tipología D" value={product.tipologia_d} />
            <Field label="Tipología E" value={product.tipologia_e} />
          </Section>

          <Section title="PIIP" icon="engineering">
            <Field label="Tipología A" value={product.tipologia_a} />
            <Field label="Tipología B" value={product.tipologia_b} />
            <Field label="Tipología C" value={product.tipologia_c} />
            <Field label="Tiene EDT" value={product.tiene_edt} />
            <div className="sm:col-span-2">
              <Field label="EDT" value={product.edt} multiline />
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
