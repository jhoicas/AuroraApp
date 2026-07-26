import { useEffect, useMemo, useState } from 'react';
import {
  useCatalogStore,
  type CatalogProduct,
} from '../../store/catalogStore';

export type SelectedDNPProduct = {
  product_id: string;
  name: string;
  code_bpin?: string | null;
  code: string;
};

type DNPExplorerModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (product: SelectedDNPProduct) => void;
};

export default function DNPExplorerModal({ open, onClose, onSelect }: DNPExplorerModalProps) {
  const sectors = useCatalogStore((s) => s.sectors);
  const programs = useCatalogStore((s) => s.programs);
  const products = useCatalogStore((s) => s.products);
  const isLoading = useCatalogStore((s) => s.isLoading);
  const error = useCatalogStore((s) => s.error);
  const fetchSectors = useCatalogStore((s) => s.fetchSectors);
  const fetchPrograms = useCatalogStore((s) => s.fetchProgramsBySector);
  const searchProducts = useCatalogStore((s) => s.searchProducts);
  const clearPrograms = useCatalogStore((s) => s.clearPrograms);
  const clearProducts = useCatalogStore((s) => s.clearProducts);

  const [query, setQuery] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [programId, setProgramId] = useState('');
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!open) return;
    void fetchSectors();
  }, [open, fetchSectors]);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => {
      setSearched(true);
      void searchProducts(query);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [query, open, searchProducts]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSectorId('');
      setProgramId('');
      setSearched(false);
      clearPrograms();
      clearProducts();
    }
  }, [open, clearPrograms, clearProducts]);

  const filteredProducts = useMemo(() => {
    if (!programId) return products;
    return products.filter((p) => p.program_id === programId);
  }, [products, programId]);

  if (!open) return null;

  const handleSectorChange = (value: string) => {
    setSectorId(value);
    setProgramId('');
    if (value) {
      void fetchPrograms(value);
    } else {
      clearPrograms();
    }
  };

  const handleSelect = (product: CatalogProduct) => {
    onSelect({
      product_id: product.id,
      name: product.name,
      code: product.code,
      code_bpin: product.code_bpin,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dnp-explorer-title"
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-lg bg-white shadow-lg border border-gray-100"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex items-center gap-2 text-[#006162]">
            <span className="material-symbols-outlined">library_books</span>
            <h3 id="dnp-explorer-title" className="text-lg font-semibold text-gray-800">
              Explorador Catálogo DNP
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800"
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="px-6 py-4 space-y-3 border-b border-gray-50 shrink-0">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">
              search
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o código BPIN…"
              className="w-full rounded border border-gray-300 pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006162]"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="dnp-sector" className="block text-xs font-medium text-gray-600 mb-1">
                Sector
              </label>
              <select
                id="dnp-sector"
                value={sectorId}
                onChange={(e) => handleSectorChange(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#006162]"
              >
                <option value="">Todos los sectores</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="dnp-program" className="block text-xs font-medium text-gray-600 mb-1">
                Programa
              </label>
              <select
                id="dnp-program"
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
                disabled={!sectorId}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#006162] disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">Todos los programas</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading && (
            <div className="px-6 py-10 text-center text-sm text-gray-500">
              <span className="material-symbols-outlined animate-spin text-[#006162] mb-2">
                progress_activity
              </span>
              <p>Buscando productos…</p>
            </div>
          )}

          {!isLoading && searched && filteredProducts.length === 0 && (
            <div className="px-6 py-12 text-center text-gray-500">
              <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">search_off</span>
              <p className="font-medium text-gray-700">No se encontraron productos</p>
              <p className="text-sm mt-1">Prueba con otro término o ajusta los filtros.</p>
            </div>
          )}

          {!isLoading && filteredProducts.length > 0 && (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Código / BPIN</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Nombre del producto</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 w-28">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700 font-mono text-xs">
                      {product.code_bpin || product.code}
                    </td>
                    <td className="px-4 py-3 text-gray-800">{product.name}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleSelect(product)}
                        className="inline-flex items-center gap-1 rounded bg-[#006162] hover:bg-[#004f50] text-white px-3 py-1.5 text-xs font-medium"
                      >
                        <span className="material-symbols-outlined text-sm">check</span>
                        Seleccionar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
