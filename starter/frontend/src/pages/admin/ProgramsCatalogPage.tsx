import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import CatalogPagination from '../../components/admin/CatalogPagination';
import { api } from '../../lib/api';
import {
  useCatalogStore,
  type CatalogSector,
  type CreateProgramInput,
} from '../../store/catalogStore';
import { useCopilotSearchSync } from '../../store/auroraCopilotStore';

const LIMIT_OPTIONS = [5, 10, 20] as const;

const emptyForm: CreateProgramInput = {
  codigo_sector: '',
  nombre_sector: '',
  codigo_programa: '',
  nombre_programa: '',
  ambito_aplicacion: '',
  codigo_subprograma: '',
  nombre_subprograma: '',
  observaciones: '',
};

async function loadAllSectors(): Promise<CatalogSector[]> {
  const all: CatalogSector[] = [];
  let page = 1;
  let lastPage = 1;
  do {
    const { data } = await api.get<{ data: CatalogSector[]; meta: { last_page: number } }>(
      '/catalog/sectors',
      { params: { page, limit: 20 } },
    );
    all.push(...(data.data ?? []));
    lastPage = data.meta?.last_page ?? 1;
    page += 1;
  } while (page <= lastPage);
  return all;
}

function formatCodeName(code: string, name: string): string {
  const c = code?.trim() || '—';
  const n = name?.trim() || '—';
  return `${c} — ${n}`;
}

export default function ProgramsCatalogPage() {
  const [searchParams] = useSearchParams();
  const initialQ = searchParams.get('q') ?? '';

  const programSubprograms = useCatalogStore((s) => s.programSubprograms);
  const programsMeta = useCatalogStore((s) => s.programsMeta);
  const isLoadingPrograms = useCatalogStore((s) => s.isLoadingPrograms);
  const error = useCatalogStore((s) => s.error);
  const fetchPrograms = useCatalogStore((s) => s.fetchPrograms);
  const createProgram = useCatalogStore((s) => s.createProgram);
  const importPrograms = useCatalogStore((s) => s.importPrograms);
  const clearError = useCatalogStore((s) => s.clearError);

  const [query, setQuery] = useState(initialQ);
  useCopilotSearchSync('programs', setQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQ.trim());
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(10);
  const [searchFocused, setSearchFocused] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CreateProgramInput>(emptyForm);
  const [sectorOptions, setSectorOptions] = useState<CatalogSector[]>([]);
  const [loadingSectors, setLoadingSectors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
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

  const handleDownloadTemplate = () => {
    const csv =
      'codigo_sector,nombre_sector,codigo_programa,nombre_programa,ambito_aplicacion,codigo_subprograma,nombre_subprograma,observaciones\n"01","Sector Ejemplo","0101","Programa Ejemplo","Nacional","010101","Subprograma Ejemplo","Ninguna"';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla_programas.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

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

  const openModal = () => {
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
    setLoadingSectors(true);
    void loadAllSectors()
      .then((list) => setSectorOptions(list))
      .catch(() => setSectorOptions([]))
      .finally(() => setLoadingSectors(false));
  };

  const handleSectorChange = (code: string) => {
    const sector = sectorOptions.find((s) => s.code === code);
    setForm((f) => ({
      ...f,
      codigo_sector: code,
      nombre_sector: sector?.name ?? '',
    }));
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (
      !form.codigo_sector.trim() ||
      !form.codigo_programa.trim() ||
      !form.nombre_programa.trim() ||
      !form.codigo_subprograma.trim() ||
      !form.nombre_subprograma.trim()
    ) {
      setFormError('Sector, programa (código y nombre) y subprograma (código y nombre) son obligatorios.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await createProgram(form);
      setModalOpen(false);
      setFlash(
        `Registro «${form.codigo_programa.trim()} / ${form.codigo_subprograma.trim()}» guardado correctamente.`,
      );
      setPage(1);
      void fetchPrograms({ page: 1, limit, search: debouncedQuery });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
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
              Catálogo maestro DNP. Alta manual o carga masiva CSV/XLSX.
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
              onClick={handleDownloadTemplate}
              className="h-12 px-4 py-2 bg-gray-100/50 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors font-medium inline-flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">download</span>
              Descargar Plantilla
            </button>
            <button
              type="button"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
              className="h-12 px-6 bg-white text-[#006a68] font-bold rounded-lg border border-[#006a68] inline-flex items-center gap-2 hover:bg-[#E6FFFA] transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">
                {importing ? 'hourglass_top' : 'upload_file'}
              </span>
              {importing ? 'Importando…' : 'Importar Archivo'}
            </button>
            <button
              type="button"
              onClick={openModal}
              className="h-12 px-6 bg-[#006162] text-white font-bold rounded-lg inline-flex items-center gap-2 shadow-sm hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              Añadir Registro
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
              placeholder="Buscar por programa, subprograma o sector..."
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
                  <th className="px-6 py-5 font-semibold uppercase tracking-wider">
                    Sector (Cód-Nombre)
                  </th>
                  <th className="px-6 py-5 font-semibold uppercase tracking-wider">
                    Programa (Cód-Nombre)
                  </th>
                  <th className="px-6 py-5 font-semibold uppercase tracking-wider">Ámbito</th>
                  <th className="px-6 py-5 font-semibold uppercase tracking-wider">
                    Subprograma (Cód-Nombre)
                  </th>
                  <th className="px-6 py-5 font-semibold uppercase tracking-wider">
                    Observaciones
                  </th>
                </tr>
              </thead>
              <tbody className="text-base md:text-lg text-[#121c2c]">
                {isLoadingPrograms && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-[#3f4949]">
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
                    <td colSpan={5} className="px-6 py-10 text-center text-[#3f4949]">
                      No hay registros. Añade un programa o importa un archivo.
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
                        <span className="block text-[#3f4949] text-sm mt-1">
                          {row.nombre_sector || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="font-bold">{row.codigo_programa}</span>
                        <span className="block text-[#3f4949] text-sm mt-1">
                          {row.nombre_programa}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-[#3f4949]">
                        {row.ambito_aplicacion || '—'}
                      </td>
                      <td className="px-6 py-5">
                        <span className="font-bold">{row.codigo_subprograma}</span>
                        <span className="block text-[#3f4949] text-sm mt-1">
                          {row.nombre_subprograma}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-[#3f4949] text-sm max-w-xs truncate">
                        {row.observaciones || '—'}
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-2xl rounded-xl bg-white shadow-xl border border-[#bec9c8] max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-program-title"
          >
            <div className="flex items-center justify-between border-b border-[#bec9c8] px-6 py-4">
              <h3 id="add-program-title" className="text-lg font-semibold text-[#121c2c]">
                Añadir Programa / Subprograma
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-[#6f7979] hover:text-[#006162]"
                aria-label="Cerrar"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={(e) => void handleCreate(e)} className="p-6 space-y-4">
              <div>
                <label htmlFor="program-sector" className="block text-sm font-semibold text-[#3f4949] mb-1">
                  Sector
                </label>
                <select
                  id="program-sector"
                  required
                  value={form.codigo_sector}
                  onChange={(e) => handleSectorChange(e.target.value)}
                  disabled={loadingSectors}
                  className="w-full rounded-lg border border-[#bec9c8] px-3 py-2.5 text-[#121c2c] focus:outline-none focus:ring-2 focus:ring-[#006162]"
                >
                  <option value="">
                    {loadingSectors ? 'Cargando sectores…' : 'Seleccione un sector'}
                  </option>
                  {sectorOptions.map((s) => (
                    <option key={s.id} value={s.code}>
                      {formatCodeName(s.code, s.name)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="program-code"
                    className="block text-sm font-semibold text-[#3f4949] mb-1"
                  >
                    Código Programa
                  </label>
                  <input
                    id="program-code"
                    required
                    value={form.codigo_programa}
                    onChange={(e) => setForm((f) => ({ ...f, codigo_programa: e.target.value }))}
                    className="w-full rounded-lg border border-[#bec9c8] px-3 py-2.5 text-[#121c2c] focus:outline-none focus:ring-2 focus:ring-[#006162]"
                    placeholder="Ej. 0101"
                  />
                </div>
                <div>
                  <label
                    htmlFor="program-name"
                    className="block text-sm font-semibold text-[#3f4949] mb-1"
                  >
                    Nombre Programa
                  </label>
                  <input
                    id="program-name"
                    required
                    value={form.nombre_programa}
                    onChange={(e) => setForm((f) => ({ ...f, nombre_programa: e.target.value }))}
                    className="w-full rounded-lg border border-[#bec9c8] px-3 py-2.5 text-[#121c2c] focus:outline-none focus:ring-2 focus:ring-[#006162]"
                    placeholder="Nombre del programa"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="program-ambito"
                  className="block text-sm font-semibold text-[#3f4949] mb-1"
                >
                  Ámbito de Aplicación
                </label>
                <input
                  id="program-ambito"
                  value={form.ambito_aplicacion}
                  onChange={(e) => setForm((f) => ({ ...f, ambito_aplicacion: e.target.value }))}
                  className="w-full rounded-lg border border-[#bec9c8] px-3 py-2.5 text-[#121c2c] focus:outline-none focus:ring-2 focus:ring-[#006162]"
                  placeholder="Ámbito de aplicación"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="subprogram-code"
                    className="block text-sm font-semibold text-[#3f4949] mb-1"
                  >
                    Código Subprograma
                  </label>
                  <input
                    id="subprogram-code"
                    required
                    value={form.codigo_subprograma}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, codigo_subprograma: e.target.value }))
                    }
                    className="w-full rounded-lg border border-[#bec9c8] px-3 py-2.5 text-[#121c2c] focus:outline-none focus:ring-2 focus:ring-[#006162]"
                    placeholder="Ej. 010101"
                  />
                </div>
                <div>
                  <label
                    htmlFor="subprogram-name"
                    className="block text-sm font-semibold text-[#3f4949] mb-1"
                  >
                    Nombre Subprograma
                  </label>
                  <input
                    id="subprogram-name"
                    required
                    value={form.nombre_subprograma}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, nombre_subprograma: e.target.value }))
                    }
                    className="w-full rounded-lg border border-[#bec9c8] px-3 py-2.5 text-[#121c2c] focus:outline-none focus:ring-2 focus:ring-[#006162]"
                    placeholder="Nombre del subprograma"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="program-observations"
                  className="block text-sm font-semibold text-[#3f4949] mb-1"
                >
                  Observaciones
                </label>
                <textarea
                  id="program-observations"
                  rows={3}
                  value={form.observaciones}
                  onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
                  className="w-full rounded-lg border border-[#bec9c8] px-3 py-2.5 text-[#121c2c] focus:outline-none focus:ring-2 focus:ring-[#006162] resize-y"
                  placeholder="Notas opcionales"
                />
              </div>

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {formError}
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-11 px-5 rounded-lg border border-[#bec9c8] font-semibold text-[#3f4949] hover:bg-[#f0f3ff]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || loadingSectors}
                  className="h-11 px-6 rounded-lg bg-[#006162] text-white font-bold hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
