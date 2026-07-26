import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CatalogPagination from '../../components/admin/CatalogPagination';
import { useCatalogStore } from '../../store/catalogStore';

const LIMIT_OPTIONS = [5, 10, 20] as const;

export default function ProgramsCatalogPage() {
  const [searchParams] = useSearchParams();
  const initialQ = searchParams.get('q') ?? '';

  const programSubprograms = useCatalogStore((s) => s.programSubprograms);
  const programsMeta = useCatalogStore((s) => s.programsMeta);
  const isLoadingPrograms = useCatalogStore((s) => s.isLoadingPrograms);
  const error = useCatalogStore((s) => s.error);
  const fetchPrograms = useCatalogStore((s) => s.fetchPrograms);
  const importPrograms = useCatalogStore((s) => s.importPrograms);
  const clearError = useCatalogStore((s) => s.clearError);

  const [query, setQuery] = useState(initialQ);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQ.trim());
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(10);
  const [searchFocused, setSearchFocused] = useState(false);
  const [importing, setImporting] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, limit]);

  useEffect(() => {
    void fetchPrograms({ page, limit, search: debouncedQuery });
  }, [page, limit, debouncedQuery, fetchPrograms]);

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    setImporting(true);
    setFlash(null);
    clearError();
    try {
      const result = await importPrograms(file);
      setFlash(
        `${result.message}: ${result.inserted} nuevos, ${result.updated} actualizados, ${result.skipped} omitidos.`,
      );
      setPage(1);
      void fetchPrograms({ page: 1, limit, search: debouncedQuery });
    } catch (err) {
      setFlash(err instanceof Error ? err.message : 'Error al importar');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="-m-6 font-body text-[#121c2c]">
      <div className="p-6 md:p-12 max-w-[1280px] mx-auto">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-8">
          <div>
            <h3 className="font-headline text-2xl font-semibold text-[#121c2c] mb-1">
              Programas / Subprogramas
            </h3>
            <p className="text-base text-[#3f4949]">
              Catálogo maestro de programas y subprogramas vinculados a sectores.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => void handleImportFile(e.target.files?.[0])}
            />
            <button
              type="button"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
              className="h-12 px-6 bg-[#006a68] text-white font-bold rounded-lg inline-flex items-center gap-2 shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">
                {importing ? 'hourglass_top' : 'upload_file'}
              </span>
              {importing ? 'Importando…' : 'Importar Archivo'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
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
              placeholder="Buscar programa, subprograma o sector..."
              className="w-full bg-transparent border-none outline-none focus:ring-0 text-lg text-[#121c2c] placeholder:text-[#6f7979]"
            />
          </div>
          <div className="md:col-span-4 glass-card bg-white/95 p-5 rounded-xl border border-[#E2E8F0] flex items-center justify-between gap-3">
            <label htmlFor="programs-limit" className="font-semibold text-lg text-[#3f4949] shrink-0">
              Por página
            </label>
            <select
              id="programs-limit"
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
            className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
              error && !flash
                ? 'border-red-200 bg-red-50 text-red-700'
                : flash?.toLowerCase().includes('error') || flash?.toLowerCase().includes('no se pudo')
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

        <div className="glass-card bg-white/95 rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm transition-all duration-300 hover:border-[#319795]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#2c7a7b] text-[#c1ffff]">
                <tr>
                  <th className="px-6 py-5 font-semibold uppercase tracking-wider">Sector</th>
                  <th className="px-6 py-5 font-semibold uppercase tracking-wider">Programa</th>
                  <th className="px-6 py-5 font-semibold uppercase tracking-wider">Subprograma</th>
                  <th className="px-6 py-5 font-semibold uppercase tracking-wider">
                    Ámbito Aplicación
                  </th>
                </tr>
              </thead>
              <tbody className="text-base md:text-lg text-[#121c2c]">
                {isLoadingPrograms && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-[#3f4949]">
                      <span className="inline-flex items-center gap-2">
                        <span className="material-symbols-outlined animate-spin text-[#006162]">
                          progress_activity
                        </span>
                        Cargando programas…
                      </span>
                    </td>
                  </tr>
                )}
                {!isLoadingPrograms && programSubprograms.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-[#3f4949]">
                      No hay programas/subprogramas. Importe un archivo CSV/XLSX.
                    </td>
                  </tr>
                )}
                {!isLoadingPrograms &&
                  programSubprograms.map((row) => (
                    <tr
                      key={row.id}
                      className="even:bg-[#E6FFFA] hover:bg-[#e7eeff] transition-colors align-top"
                    >
                      <td className="px-6 py-5">
                        <span className="font-bold">{row.codigo_sector}</span>
                        <span className="block text-[#3f4949] text-sm mt-1">{row.nombre_sector}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="font-bold">{row.codigo_programa}</span>
                        <span className="block text-[#3f4949] text-sm mt-1">
                          {row.nombre_programa}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="font-bold">{row.codigo_subprograma}</span>
                        <span className="block text-[#3f4949] text-sm mt-1">
                          {row.nombre_subprograma}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-[#3f4949]">
                        {row.ambito_aplicacion || '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <CatalogPagination
            meta={{
              total: programsMeta?.total ?? 0,
              page,
              limit,
              last_page: programsMeta?.last_page ?? 1,
            }}
            shown={programSubprograms.length}
            onPageChange={setPage}
          />
        </div>
      </div>

      {importing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 pointer-events-none">
          <div className="bg-white rounded-xl shadow-lg px-6 py-4 flex items-center gap-3 border border-[#bec9c8]">
            <span className="material-symbols-outlined animate-spin text-[#006162]">
              progress_activity
            </span>
            <span className="font-semibold text-[#121c2c]">Importando archivo…</span>
          </div>
        </div>
      )}
    </div>
  );
}
