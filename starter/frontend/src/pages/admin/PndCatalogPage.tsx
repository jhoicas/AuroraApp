import { useEffect, useState } from 'react';
import CatalogImporter from '../../components/CatalogImporter';
import CatalogPagination from '../../components/admin/CatalogPagination';
import { useCopilotSearchSync } from '../../store/auroraCopilotStore';
import { useCatalogStore, type CatalogPnd } from '../../store/catalogStore';

const LIMIT_OPTIONS = [5, 10, 20] as const;

function cellText(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  if (!v || v === '0') return '—';
  return v;
}

export default function PndCatalogPage() {
  const catalogPnd = useCatalogStore((s) => s.catalogPnd);
  const catalogPndMeta = useCatalogStore((s) => s.catalogPndMeta);
  const isLoadingPnd = useCatalogStore((s) => s.isLoadingPnd);
  const error = useCatalogStore((s) => s.error);
  const fetchCatalogPnd = useCatalogStore((s) => s.fetchCatalogPnd);
  const clearError = useCatalogStore((s) => s.clearError);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(10);
  const [searchFocused, setSearchFocused] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useCopilotSearchSync('pnd', setQuery);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, limit]);

  useEffect(() => {
    void fetchCatalogPnd({ page, limit, search: debouncedQuery });
  }, [page, limit, debouncedQuery, fetchCatalogPnd]);

  const refreshList = () => {
    void fetchCatalogPnd({ page: 1, limit, search: debouncedQuery });
    setPage(1);
  };

  return (
    <div className="-m-6 font-body text-[#121c2c]">
      <div className="p-6 md:p-12 max-w-[1280px] mx-auto space-y-8">
        <div>
          <h3 className="font-headline text-2xl font-semibold text-[#121c2c] mb-1">Plan Nacional de Desarrollo (PND)</h3>
          <p className="text-base text-[#3f4949]">
            Catálogo del PND estructurado en Transformación, Pilar, Catalizador y Componente.
          </p>
        </div>

        <CatalogImporter
          variant="pnd"
          onImported={(result) => {
            const msg =
              'message' in result && result.message
                ? `${result.message}${
                    'inserted' in result
                      ? `: ${result.inserted ?? 0} importados.`
                      : ''
                  }`
                : 'Importación PND completada.';
            setFlash(msg);
            clearError();
            refreshList();
          }}
        />

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div
            className={`md:col-span-8 glass-card bg-white/95 p-5 rounded-xl border border-[#E2E8F0] flex items-center gap-4 transition-all duration-300 hover:border-[#319795] ${
              searchFocused ? 'ring-2 ring-[#006162] ring-offset-2' : ''
            }`}
          >
            <span className="material-symbols-outlined text-[#6f7979]">search</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Buscar por transformación, pilar, catalizador o componente..."
              className="w-full bg-transparent border-none outline-none focus:ring-0 text-lg text-[#121c2c] placeholder:text-[#6f7979]"
            />
          </div>
          <div className="md:col-span-4 glass-card bg-white/95 p-5 rounded-xl border border-[#E2E8F0] flex items-center justify-between gap-3">
            <label htmlFor="pnd-limit" className="font-semibold text-lg text-[#3f4949] shrink-0">
              Por página
            </label>
            <select
              id="pnd-limit"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="form-select w-full border-[#E2E8F0] rounded-lg shadow-sm focus:border-[#006162] focus:ring-[#006162] text-lg bg-white/50 backdrop-blur-sm"
            >
              {LIMIT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-[#FFF5F5] border-l-4 border-[#E53E3E] text-[#C53030] p-4 rounded-r shadow-sm">
            <p className="font-semibold">Error al cargar listado</p>
            <p className="text-sm">{error}</p>
          </div>
        )}
        {flash && (
          <div className="bg-[#F0FFF4] border-l-4 border-[#38A169] text-[#2F855A] p-4 rounded-r shadow-sm flex items-center justify-between">
            <div>
              <p className="font-semibold">Éxito</p>
              <p className="text-sm">{flash}</p>
            </div>
            <button
              onClick={() => setFlash(null)}
              className="text-[#2F855A] hover:text-[#22543D] p-1 rounded-md transition-colors hover:bg-[#C6F6D5]"
              title="Cerrar"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        )}

        <div className="glass-card bg-white/90 border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto min-h-[400px] relative">
            {isLoadingPnd && catalogPnd.length === 0 ? (
              <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#E2E8F0] border-t-[#006162]"></div>
              </div>
            ) : null}

            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#3f4949]">
                <tr>
                  <th className="p-4 font-semibold w-16">ID</th>
                  <th className="p-4 font-semibold min-w-[200px] whitespace-normal">Transformación</th>
                  <th className="p-4 font-semibold min-w-[200px] whitespace-normal">Pilar</th>
                  <th className="p-4 font-semibold min-w-[200px] whitespace-normal">Catalizador</th>
                  <th className="p-4 font-semibold min-w-[200px] whitespace-normal">Componente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {catalogPnd.length === 0 && !isLoadingPnd && !error ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-[#6f7979]">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <span className="material-symbols-outlined text-5xl text-[#CBD5E0]">
                          find_in_page
                        </span>
                        <p className="text-lg">No se encontraron registros de PND</p>
                        <p className="text-sm">Importa un archivo CSV o ajusta tu búsqueda.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  catalogPnd.map((item: CatalogPnd) => (
                    <tr
                      key={item.id}
                      className="hover:bg-[#F0FDF4] transition-colors group"
                    >
                      <td className="p-4 align-top text-[#6f7979] font-mono text-xs pt-5">
                        #{item.id}
                      </td>
                      <td className="p-4 align-top whitespace-normal">
                        <div className="text-[#121c2c] font-medium leading-relaxed">
                          {cellText(item.PillarDescription)}
                        </div>
                      </td>
                      <td className="p-4 align-top whitespace-normal">
                        <div className="text-[#121c2c] font-medium leading-relaxed">
                          {cellText(item.ObjectiveDescription)}
                        </div>
                      </td>
                      <td className="p-4 align-top whitespace-normal">
                        <div className="text-[#121c2c] leading-relaxed">
                          {cellText(item.StrategyDescription)}
                        </div>
                      </td>
                      <td className="p-4 align-top whitespace-normal">
                        <div className="text-[#121c2c] leading-relaxed">
                          {cellText(item.ComponentDescription)}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {catalogPndMeta && catalogPnd.length > 0 && (
            <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC]">
              <CatalogPagination
                meta={catalogPndMeta}
                onPageChange={setPage}
                isLoading={isLoadingPnd}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
