import React from 'react';
import type { Product } from '../../store/catalogStore';

type ProductDetailModalProps = {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  onSelect: (productId: string) => void;
};

export default function ProductDetailModal({ open, onClose, product, onSelect }: ProductDetailModalProps) {
  if (!open || !product) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-detail-title"
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl border border-gray-100"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 sticky top-0 bg-white z-10">
          <h3 id="product-detail-title" className="text-lg font-semibold text-gray-800">
            Detalle Técnico del Producto
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800"
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Producto MGA
            </h4>
            <div className="text-lg font-medium text-gray-900">
              <span className="text-emerald-700 font-semibold mr-2">{product.codigo_del_producto}</span>
              {product.producto}
            </div>
            {product.descripcion && (
              <p className="mt-2 text-sm text-gray-600">{product.descripcion}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Sector</h4>
              <p className="text-sm text-gray-800">{product.sector} — {product.nombre_del_sector}</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Programa</h4>
              <p className="text-sm text-gray-800">{product.codigo_del_programa} — {product.nombre_del_programa}</p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Indicadores Asociados
            </h4>
            <div className="bg-white rounded border border-gray-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 font-medium">Código</th>
                    <th className="px-4 py-2 font-medium">Indicador</th>
                    <th className="px-4 py-2 font-medium">Medido a través de</th>
                    <th className="px-4 py-2 font-medium">Unidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      {product.codigo_del_indicador_de_producto}
                      {product.indicador_principal && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
                          Principal
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{product.indicador_de_producto}</td>
                    <td className="px-4 py-3 text-gray-700">{product.medido_a_traves_de}</td>
                    <td className="px-4 py-3 text-gray-700">{product.unidad_de_medida}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
             <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Tipologías SUIFP Disponibles
            </h4>
            <div className="flex flex-wrap gap-2">
              {product.tipologia_a && <span className="inline-flex items-center rounded bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">A - PIIP</span>}
              {product.tipologia_b && <span className="inline-flex items-center rounded bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">B - SGP</span>}
              {product.tipologia_c && <span className="inline-flex items-center rounded bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">C - SGR</span>}
              {product.tipologia_d && <span className="inline-flex items-center rounded bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">D - PGN</span>}
              {product.tipologia_e && <span className="inline-flex items-center rounded bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">E - Pueblos Indígenas</span>}
              {!product.tipologia_a && !product.tipologia_b && !product.tipologia_c && !product.tipologia_d && !product.tipologia_e && (
                <span className="text-sm text-gray-500 italic">No especificado</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 bg-gray-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => {
              onSelect(product.codigo_del_producto);
              onClose();
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2 text-sm font-medium shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined text-sm">check_circle</span>
            Seleccionar Producto
          </button>
        </div>
      </div>
    </div>
  );
}
