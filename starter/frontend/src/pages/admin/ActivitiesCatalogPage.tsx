import { useEffect, useState } from 'react';
import CatalogImporter from '../../components/CatalogImporter';
import CatalogPagination from '../../components/admin/CatalogPagination';
import ActivityDetailModal from '../../components/admin/ActivityDetailModal';
import { useCatalogStore, type CatalogActivity } from '../../store/catalogStore';
import { useCopilotSearchSync } from '../../store/auroraCopilotStore';

const LIMIT_OPTIONS = [5, 10, 20] as const;

function cellText(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  if (!v || v === '0') return '—';
  return v;
}

export default function ActivitiesCatalogPage() {
  const catalogActivities = useCatalogStore((s) => s.catalogActivities);
  const catalogActivitiesMeta = useCatalogStore((s) => s.catalogActivitiesMeta);
  const isLoadingActivities = useCatalogStore((s) => s.isLoadingActivities);
  const error = useCatalogStore((s) => s.error);
  const fetchCatalogActivities = useCatalogStore((s) => s.fetchCatalogActivities);
  const clearError = useCatalogStore((s) => s.clearError);

  const [query, setQuery] = useState('');
  useCopilotSearchSync('activities', setQuery);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(10);
  const [searchFocused, setSearchFocused] = useState(false);
  const [viewing, setViewing] = useState<CatalogActivity | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, limit]);

  useEffect(() => {
    void fetchCatalogActivities({ page, limit, search: debouncedQuery });
  }, [page, limit, debouncedQuery, fetchCatalogActivities]);

  const refreshList = () => {
    void fetchCatalogActivities({ page: 1, limit, search: debouncedQuery });
    setPage(1);
  };

  return (
    <div className="-m-6 font-body text-[#121c2c]">
      <div className="p-6 md:p-12 max-w-[1280px] mx-auto space-y-8">
        <div>
          <h3 className="font-headline text-2xl font-semibold text-[#121c2c] mb-1">
            Lista de actividades
          </h3>
          <p className="text-base text-[#3f4949]">
            Lista oficial de actividades DNP. Unicidad por código actividad (preserva ceros a la
            izquierda).
          </p>
        </div>

        <CatalogImporter
          variant="activities"
          onImported={(result) => {
            const msg =
              'message' in result && result.message
                ? `${result.message}${
                    'inserted' in result
                      ? `: ${result.inserted ?? 0} nuevos, ${result.updated ?? 0} actualizados`
                      : ''
                  }`
                : 'Importación de actividades completada.';
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
              placeholder="Buscar por código, listado o unidad de medida..."
              className="w-full bg-transparent border-none outline-none focus:ring-0 text-lg text-[#121c2c] placeholder:text-[#6f7979]"
            />
          </div>
          <div className="md:col-span-4 glass-card bg-white/95 p-5 rounded-xl border border-[#E2E8F0] flex items-center justify-between gap-3">
            <label
              htmlFor="activities-limit"
              className="font-semibold text-lg text-[#3f4949] shrink-0"
            >
              Por página
            </label>
            <select
              id="activities-limit"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full max-w-[120px] bg-transparent border border-[#bec9c8] rounded-lg px-3 py-2 text-lg text-[#3f4949] font-semibold"
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(error || flash) && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              error && !flash
                ? 'border-red-200 bg-red-50 text-red-700'
                : flash?.toLowerCase().includes('error') ||
                    flash?.toLowerCase().includes('no se pudo')
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-teal-200 bg-teal-50 text-teal-800'
            }`}
          >
            {flash || error}
            {flash && (
              <button
                type="button"
                className="ml-3 underline font-semibold"
                onClick={() => setFlash(null)}
              >
                Cerrar
              </button>
            )}
          </div>
        )}

        <div className="glass-card bg-white/95 rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm">
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[900px] text-left border-collapse table-auto">
              <thead className="bg-[#2c7a7b] text-[#c1ffff]">
                <tr>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-xs whitespace-nowrap">
                    Código actividad
                  </th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-xs whitespace-nowrap min-w-[320px]">
                    Listado de actividades
                  </th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-xs whitespace-nowrap">
                    Unidad de medida
                  </th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-xs whitespace-nowrap text-right sticky right-0 z-20 bg-[#2c7a7b] shadow-[-6px_0_8px_-4px_rgba(0,0,0,0.15)]">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm text-[#121c2c]">
                {isLoadingActivities && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-[#3f4949] whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <span className="material-symbols-outlined animate-spin text-[#006162]">
                          progress_activity
                        </span>
                        Cargando lista de actividades…
                      </span>
                    </td>
                  </tr>
                )}
                {!isLoadingActivities && catalogActivities.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-[#3f4949] whitespace-nowrap">
                      No hay actividades. Importe el CSV de la lista oficial.
                    </td>
                  </tr>
                )}
                {!isLoadingActivities &&
                  catalogActivities.map((row) => (
                    <tr
                      key={row.id}
                      className="even:bg-[#E6FFFA] odd:bg-white hover:bg-[#e7eeff] transition-colors group"
                    >
                      <td className="px-4 py-3 font-bold whitespace-nowrap font-mono">
                        {cellText(row.codigo_actividad)}
                      </td>
                      <td
                        className="px-4 py-3 whitespace-nowrap min-w-[320px] max-w-[480px] truncate"
                        title={row.listado_de_actividades}
                      >
                        {cellText(row.listado_de_actividades)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {cellText(row.unidad_de_medida)}
                      </td>
                      <td className="px-4 py-3 sticky right-0 z-10 whitespace-nowrap text-right border-l border-[#E2E8F0] bg-white group-even:bg-[#E6FFFA] group-hover:bg-[#e7eeff] shadow-[-6px_0_8px_-4px_rgba(0,0,0,0.08)]">
                        <button
                          type="button"
                          onClick={() => setViewing(row)}
                          className="h-9 px-3 rounded-lg border border-[#006a68] text-[#006a68] text-xs font-bold inline-flex items-center gap-1 hover:bg-[#E6FFFA]"
                          title="Ver ficha"
                        >
                          <span className="material-symbols-outlined text-sm">visibility</span>
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <CatalogPagination
            meta={{
              total: catalogActivitiesMeta?.total ?? 0,
              page,
              limit,
              last_page: catalogActivitiesMeta?.last_page ?? 1,
            }}
            shown={catalogActivities.length}
            onPageChange={setPage}
          />
        </div>
      </div>

      {viewing && (
        <ActivityDetailModal activity={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}
