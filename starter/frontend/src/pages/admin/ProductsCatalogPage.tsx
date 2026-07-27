import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import CatalogPagination from '../../components/admin/CatalogPagination';
import { api } from '../../lib/api';
import {
  useCatalogStore,
  type CatalogProgramSubprogram,
  type CatalogSector,
  type CreateProductInput,
  type Product,
} from '../../store/catalogStore';

const LIMIT_OPTIONS = [5, 10, 20] as const;
type ModalSection = 'A' | 'B' | 'C';

const emptyForm: CreateProductInput = {
  sector: '',
  nombre_del_sector: '',
  codigo_del_programa: '',
  nombre_del_programa: '',
  codigo_del_producto: '',
  producto: '',
  descripcion: '',
  medido_a_traves_de: '',
  codigo_del_indicador_de_producto: '',
  indicador_de_producto: '',
  unidad_de_medida: '',
  indicador_principal: false,
  es_nacional: false,
  es_territorial: false,
  objetivos_de_desarrollo_sostenible_ods: '',
  meta_ods: '',
  tipologia_general_suifp: '',
  tipologia_d: '',
  tipologia_e: '',
  tipologia_a: '',
  tipologia_b: '',
  tipologia_c: '',
  tiene_edt: false,
  edt: '',
};

const TABLE_COLUMNS: { key: keyof CreateProductInput; label: string }[] = [
  { key: 'sector', label: 'Sector' },
  { key: 'nombre_del_sector', label: 'Nombre Sector' },
  { key: 'codigo_del_programa', label: 'Cód. Programa' },
  { key: 'nombre_del_programa', label: 'Nombre Programa' },
  { key: 'codigo_del_producto', label: 'Cód. Producto' },
  { key: 'producto', label: 'Producto' },
  { key: 'descripcion', label: 'Descripción' },
  { key: 'medido_a_traves_de', label: 'Medido a través de' },
  { key: 'codigo_del_indicador_de_producto', label: 'Cód. Indicador' },
  { key: 'indicador_de_producto', label: 'Indicador' },
  { key: 'unidad_de_medida', label: 'Unidad' },
  { key: 'indicador_principal', label: 'Ind. Principal' },
  { key: 'es_nacional', label: 'Nacional' },
  { key: 'es_territorial', label: 'Territorial' },
  { key: 'objetivos_de_desarrollo_sostenible_ods', label: 'ODS' },
  { key: 'meta_ods', label: 'Meta ODS' },
  { key: 'tipologia_general_suifp', label: 'Tip. General' },
  { key: 'tipologia_d', label: 'Tip. D' },
  { key: 'tipologia_e', label: 'Tip. E' },
  { key: 'tipologia_a', label: 'Tip. A' },
  { key: 'tipologia_b', label: 'Tip. B' },
  { key: 'tipologia_c', label: 'Tip. C' },
  { key: 'tiene_edt', label: 'Tiene EDT' },
  { key: 'edt', label: 'EDT' },
];

const inputClass =
  'w-full rounded-lg border border-[#bec9c8] px-3 py-2.5 text-[#121c2c] focus:outline-none focus:ring-2 focus:ring-[#006162]';
const labelClass = 'block text-sm font-semibold text-[#3f4949] mb-1';

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

async function loadAllPrograms(): Promise<CatalogProgramSubprogram[]> {
  const all: CatalogProgramSubprogram[] = [];
  let page = 1;
  let lastPage = 1;
  do {
    const { data } = await api.get<{
      data: CatalogProgramSubprogram[];
      meta: { last_page: number };
    }>('/catalog/programs', { params: { page, limit: 20 } });
    all.push(...(data.data ?? []));
    lastPage = data.meta?.last_page ?? 1;
    page += 1;
  } while (page <= lastPage);
  return all;
}

function productToForm(row: Product): CreateProductInput {
  return {
    sector: row.sector,
    nombre_del_sector: row.nombre_del_sector,
    codigo_del_programa: row.codigo_del_programa,
    nombre_del_programa: row.nombre_del_programa,
    codigo_del_producto: row.codigo_del_producto,
    producto: row.producto,
    descripcion: row.descripcion,
    medido_a_traves_de: row.medido_a_traves_de,
    codigo_del_indicador_de_producto: row.codigo_del_indicador_de_producto,
    indicador_de_producto: row.indicador_de_producto,
    unidad_de_medida: row.unidad_de_medida,
    indicador_principal: row.indicador_principal,
    es_nacional: row.es_nacional,
    es_territorial: row.es_territorial,
    objetivos_de_desarrollo_sostenible_ods: row.objetivos_de_desarrollo_sostenible_ods,
    meta_ods: row.meta_ods,
    tipologia_general_suifp: row.tipologia_general_suifp,
    tipologia_d: row.tipologia_d,
    tipologia_e: row.tipologia_e,
    tipologia_a: row.tipologia_a,
    tipologia_b: row.tipologia_b,
    tipologia_c: row.tipologia_c,
    tiene_edt: row.tiene_edt,
    edt: row.edt,
  };
}

function formatCell(value: string | boolean | undefined): string {
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  const text = (value ?? '').toString().trim();
  return text || '—';
}

export default function ProductsCatalogPage() {
  const catalogProducts = useCatalogStore((s) => s.catalogProducts);
  const catalogProductsMeta = useCatalogStore((s) => s.catalogProductsMeta);
  const isLoadingProducts = useCatalogStore((s) => s.isLoadingProducts);
  const error = useCatalogStore((s) => s.error);
  const fetchCatalogProducts = useCatalogStore((s) => s.fetchCatalogProducts);
  const createProduct = useCatalogStore((s) => s.createProduct);
  const updateProduct = useCatalogStore((s) => s.updateProduct);
  const deleteProduct = useCatalogStore((s) => s.deleteProduct);
  const importProducts = useCatalogStore((s) => s.importProducts);
  const clearError = useCatalogStore((s) => s.clearError);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(10);
  const [searchFocused, setSearchFocused] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<ModalSection>('A');
  const [form, setForm] = useState<CreateProductInput>(emptyForm);
  const [sectorOptions, setSectorOptions] = useState<CatalogSector[]>([]);
  const [programRows, setProgramRows] = useState<CatalogProgramSubprogram[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const programOptions = useMemo(() => {
    const map = new Map<string, { code: string; name: string }>();
    for (const row of programRows) {
      if (form.sector && row.codigo_sector !== form.sector) continue;
      if (!row.codigo_programa) continue;
      if (!map.has(row.codigo_programa)) {
        map.set(row.codigo_programa, {
          code: row.codigo_programa,
          name: row.nombre_programa,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [programRows, form.sector]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, limit]);

  useEffect(() => {
    void fetchCatalogProducts({ page, limit, search: debouncedQuery });
  }, [page, limit, debouncedQuery, fetchCatalogProducts]);

  const setField = <K extends keyof CreateProductInput>(key: K, value: CreateProductInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleDownloadTemplate = () => {
    const csv =
      'sector,nombre_del_sector,codigo_del_programa,nombre_del_programa,codigo_del_producto,producto,descripcion,medido_a_traves_de,codigo_del_indicador_de_producto,indicador_de_producto,unidad_de_medida,indicador_principal,es_nacional,es_territorial,objetivos_de_desarrollo_sostenible_ods,meta_ods,tipologia_general_suifp,tipologia_d,tipologia_e,tipologia_a,tipologia_b,tipologia_c,tiene_edt,edt\n"01","Sector Ejemplo","0101","Programa Ejemplo","010101","Producto Ejemplo","Descripción","Encuesta","IND01","Indicador","Porcentaje","Sí","Sí","No","ODS 1","Meta 1.1","General","Tipo D","Tipo E","Tipo A","Tipo B","Tipo C","Sí","EDT Ejemplo"';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla_productos_2.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    setImporting(true);
    setFlash(null);
    clearError();
    try {
      const result = await importProducts(file);
      setFlash(
        `${result.message}: ${result.inserted} nuevos, ${result.updated} actualizados, ${result.skipped} omitidos.`,
      );
      setPage(1);
      void fetchCatalogProducts({ page: 1, limit, search: debouncedQuery });
    } catch (err) {
      setFlash(err instanceof Error ? err.message : 'Error al importar');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const loadModalOptions = async () => {
    setLoadingOptions(true);
    try {
      const [sectors, programs] = await Promise.all([loadAllSectors(), loadAllPrograms()]);
      setSectorOptions(sectors);
      setProgramRows(programs);
    } catch {
      setSectorOptions([]);
      setProgramRows([]);
    } finally {
      setLoadingOptions(false);
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setActiveSection('A');
    setModalOpen(true);
    void loadModalOptions();
  };

  const openEditModal = (row: Product) => {
    setEditingId(row.id);
    setForm(productToForm(row));
    setFormError(null);
    setActiveSection('A');
    setModalOpen(true);
    void loadModalOptions();
  };

  const handleSectorChange = (code: string) => {
    const sector = sectorOptions.find((s) => s.code === code);
    setForm((f) => ({
      ...f,
      sector: code,
      nombre_del_sector: sector?.name ?? '',
      codigo_del_programa: '',
      nombre_del_programa: '',
    }));
  };

  const handleProgramChange = (code: string) => {
    const program = programOptions.find((p) => p.code === code);
    setForm((f) => ({
      ...f,
      codigo_del_programa: code,
      nombre_del_programa: program?.name ?? '',
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.codigo_del_producto.trim() || !form.producto.trim()) {
      setFormError('Código del producto y nombre del producto son obligatorios.');
      setActiveSection('A');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editingId) {
        await updateProduct(editingId, form);
        setFlash(`Producto «${form.codigo_del_producto.trim()}» actualizado correctamente.`);
      } else {
        await createProduct(form);
        setFlash(`Producto «${form.codigo_del_producto.trim()}» guardado correctamente.`);
      }
      setModalOpen(false);
      setPage(1);
      void fetchCatalogProducts({ page: 1, limit, search: debouncedQuery });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: Product) => {
    const ok = window.confirm(
      `¿Eliminar el producto «${row.codigo_del_producto} — ${row.producto}»?`,
    );
    if (!ok) return;
    setDeletingId(row.id);
    setFlash(null);
    clearError();
    try {
      await deleteProduct(row.id);
      setFlash(`Producto «${row.codigo_del_producto}» eliminado.`);
      void fetchCatalogProducts({ page, limit, search: debouncedQuery });
    } catch (err) {
      setFlash(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeletingId(null);
    }
  };

  const colSpan = TABLE_COLUMNS.length + 1;

  return (
    <div className="-m-6 font-body text-[#121c2c]">
      <div className="p-6 md:p-12 max-w-[1280px] mx-auto">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-8">
          <div>
            <h3 className="font-headline text-2xl font-semibold text-[#121c2c] mb-1">Productos</h3>
            <p className="text-base text-[#3f4949]">
              Catálogo maestro MGA / DNP. Alta manual o carga masiva CSV/XLSX.
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
              onClick={openCreateModal}
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
              placeholder="Buscar por producto, programa, sector o indicador..."
              className="w-full bg-transparent border-none outline-none focus:ring-0 text-lg text-[#121c2c] placeholder:text-[#6f7979]"
            />
          </div>
          <div className="md:col-span-4 glass-card bg-white/95 p-5 rounded-xl border border-[#E2E8F0] flex items-center justify-between gap-3">
            <label htmlFor="products-limit" className="font-semibold text-lg text-[#3f4949] shrink-0">
              Por página
            </label>
            <select
              id="products-limit"
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
            <table className="w-full min-w-[3200px] text-left border-collapse">
              <thead className="bg-[#2c7a7b] text-[#c1ffff]">
                <tr>
                  {TABLE_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="px-4 py-4 font-semibold uppercase tracking-wider text-xs whitespace-nowrap"
                    >
                      {col.label}
                    </th>
                  ))}
                  <th className="px-4 py-4 font-semibold uppercase tracking-wider text-xs whitespace-nowrap sticky right-0 bg-[#2c7a7b] z-10 text-right min-w-[140px]">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm text-[#121c2c]">
                {isLoadingProducts && (
                  <tr>
                    <td colSpan={colSpan} className="px-6 py-10 text-center text-[#3f4949]">
                      <span className="inline-flex items-center gap-2">
                        <span className="material-symbols-outlined animate-spin text-[#006162]">
                          progress_activity
                        </span>
                        Cargando productos…
                      </span>
                    </td>
                  </tr>
                )}
                {!isLoadingProducts && catalogProducts.length === 0 && (
                  <tr>
                    <td colSpan={colSpan} className="px-6 py-10 text-center text-[#3f4949]">
                      No hay registros. Añade un producto o importa un archivo.
                    </td>
                  </tr>
                )}
                {!isLoadingProducts &&
                  catalogProducts.map((row) => (
                    <tr
                      key={row.id}
                      className="even:bg-[#E6FFFA] hover:bg-[#e7eeff] transition-colors align-top group"
                    >
                      {TABLE_COLUMNS.map((col) => (
                        <td
                          key={col.key}
                          className="px-4 py-3 whitespace-nowrap max-w-[220px] truncate"
                          title={formatCell(row[col.key])}
                        >
                          {formatCell(row[col.key])}
                        </td>
                      ))}
                      <td className="px-4 py-3 sticky right-0 bg-inherit z-10 text-right whitespace-nowrap border-l border-[#E2E8F0]">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(row)}
                            className="h-9 px-3 rounded-lg bg-[#006a68] text-white text-xs font-bold inline-flex items-center gap-1 hover:opacity-90"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === row.id}
                            onClick={() => void handleDelete(row)}
                            className="h-9 px-3 rounded-lg border border-red-300 text-red-700 text-xs font-bold inline-flex items-center gap-1 hover:bg-red-50 disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                            {deletingId === row.id ? '…' : 'Eliminar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <CatalogPagination
            meta={{
              total: catalogProductsMeta?.total ?? 0,
              page,
              limit,
              last_page: catalogProductsMeta?.last_page ?? 1,
            }}
            shown={catalogProducts.length}
            onPageChange={setPage}
          />
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-4xl rounded-xl bg-white shadow-xl border border-[#bec9c8] max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-modal-title"
          >
            <div className="flex items-center justify-between border-b border-[#bec9c8] px-6 py-4 sticky top-0 bg-white z-10">
              <h3 id="product-modal-title" className="text-lg font-semibold text-[#121c2c]">
                {editingId ? 'Editar Producto' : 'Añadir Producto'}
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

            <div className="px-6 pt-4 flex flex-wrap gap-2 border-b border-[#E2E8F0] sticky top-[65px] bg-white z-10 pb-3">
              {(
                [
                  { id: 'A', label: 'A · Información Básica' },
                  { id: 'B', label: 'B · Indicadores y ODS' },
                  { id: 'C', label: 'C · Tipologías' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSection(tab.id)}
                  className={`h-10 px-4 rounded-lg text-sm font-semibold transition-colors ${
                    activeSection === tab.id
                      ? 'bg-[#006162] text-white'
                      : 'bg-gray-100/80 text-[#3f4949] hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-6">
              {activeSection === 'A' && (
                <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="prod-sector" className={labelClass}>
                      Sector
                    </label>
                    <select
                      id="prod-sector"
                      value={form.sector}
                      onChange={(e) => handleSectorChange(e.target.value)}
                      disabled={loadingOptions}
                      className={inputClass}
                    >
                      <option value="">
                        {loadingOptions ? 'Cargando sectores…' : 'Seleccione un sector'}
                      </option>
                      {sectorOptions.map((s) => (
                        <option key={s.id} value={s.code}>
                          {s.code} — {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="prod-programa" className={labelClass}>
                      Programa
                    </label>
                    <select
                      id="prod-programa"
                      value={form.codigo_del_programa}
                      onChange={(e) => handleProgramChange(e.target.value)}
                      disabled={loadingOptions || !form.sector}
                      className={inputClass}
                    >
                      <option value="">
                        {!form.sector
                          ? 'Seleccione primero un sector'
                          : loadingOptions
                            ? 'Cargando programas…'
                            : 'Seleccione un programa'}
                      </option>
                      {programOptions.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.code} — {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="prod-cod" className={labelClass}>
                      Código del Producto *
                    </label>
                    <input
                      id="prod-cod"
                      required
                      value={form.codigo_del_producto}
                      onChange={(e) => setField('codigo_del_producto', e.target.value)}
                      className={inputClass}
                      placeholder="Código único"
                    />
                  </div>
                  <div>
                    <label htmlFor="prod-nombre" className={labelClass}>
                      Producto *
                    </label>
                    <input
                      id="prod-nombre"
                      required
                      value={form.producto}
                      onChange={(e) => setField('producto', e.target.value)}
                      className={inputClass}
                      placeholder="Nombre del producto"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="prod-desc" className={labelClass}>
                      Descripción
                    </label>
                    <textarea
                      id="prod-desc"
                      rows={3}
                      value={form.descripcion}
                      onChange={(e) => setField('descripcion', e.target.value)}
                      className={`${inputClass} resize-y`}
                      placeholder="Descripción del producto"
                    />
                  </div>
                </section>
              )}

              {activeSection === 'B' && (
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="prod-medido" className={labelClass}>
                      Medido a través de
                    </label>
                    <input
                      id="prod-medido"
                      value={form.medido_a_traves_de}
                      onChange={(e) => setField('medido_a_traves_de', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="prod-cod-ind" className={labelClass}>
                      Código Indicador de Producto
                    </label>
                    <input
                      id="prod-cod-ind"
                      value={form.codigo_del_indicador_de_producto}
                      onChange={(e) => setField('codigo_del_indicador_de_producto', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="prod-ind" className={labelClass}>
                      Indicador de Producto
                    </label>
                    <input
                      id="prod-ind"
                      value={form.indicador_de_producto}
                      onChange={(e) => setField('indicador_de_producto', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="prod-unidad" className={labelClass}>
                      Unidad de medida
                    </label>
                    <input
                      id="prod-unidad"
                      value={form.unidad_de_medida}
                      onChange={(e) => setField('unidad_de_medida', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="prod-ods" className={labelClass}>
                      Objetivos de Desarrollo Sostenible (ODS)
                    </label>
                    <input
                      id="prod-ods"
                      value={form.objetivos_de_desarrollo_sostenible_ods}
                      onChange={(e) =>
                        setField('objetivos_de_desarrollo_sostenible_ods', e.target.value)
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="prod-meta-ods" className={labelClass}>
                      Meta ODS
                    </label>
                    <input
                      id="prod-meta-ods"
                      value={form.meta_ods}
                      onChange={(e) => setField('meta_ods', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap gap-6 pt-1">
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#3f4949] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.indicador_principal}
                        onChange={(e) => setField('indicador_principal', e.target.checked)}
                        className="rounded border-[#bec9c8] text-[#006162] focus:ring-[#006162]"
                      />
                      Indicador Principal
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#3f4949] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.es_nacional}
                        onChange={(e) => setField('es_nacional', e.target.checked)}
                        className="rounded border-[#bec9c8] text-[#006162] focus:ring-[#006162]"
                      />
                      Es Nacional
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#3f4949] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.es_territorial}
                        onChange={(e) => setField('es_territorial', e.target.checked)}
                        className="rounded border-[#bec9c8] text-[#006162] focus:ring-[#006162]"
                      />
                      Es Territorial
                    </label>
                  </div>
                </section>
              )}

              {activeSection === 'C' && (
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="prod-tip-gen" className={labelClass}>
                      Tipología General SUIFP
                    </label>
                    <input
                      id="prod-tip-gen"
                      value={form.tipologia_general_suifp}
                      onChange={(e) => setField('tipologia_general_suifp', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="prod-tip-d" className={labelClass}>
                      Tipología D
                    </label>
                    <input
                      id="prod-tip-d"
                      value={form.tipologia_d}
                      onChange={(e) => setField('tipologia_d', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="prod-tip-e" className={labelClass}>
                      Tipología E
                    </label>
                    <input
                      id="prod-tip-e"
                      value={form.tipologia_e}
                      onChange={(e) => setField('tipologia_e', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="prod-tip-a" className={labelClass}>
                      Tipología A
                    </label>
                    <input
                      id="prod-tip-a"
                      value={form.tipologia_a}
                      onChange={(e) => setField('tipologia_a', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="prod-tip-b" className={labelClass}>
                      Tipología B
                    </label>
                    <input
                      id="prod-tip-b"
                      value={form.tipologia_b}
                      onChange={(e) => setField('tipologia_b', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="prod-tip-c" className={labelClass}>
                      Tipología C
                    </label>
                    <input
                      id="prod-tip-c"
                      value={form.tipologia_c}
                      onChange={(e) => setField('tipologia_c', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#3f4949] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.tiene_edt}
                        onChange={(e) => setField('tiene_edt', e.target.checked)}
                        className="rounded border-[#bec9c8] text-[#006162] focus:ring-[#006162]"
                      />
                      Tiene EDT
                    </label>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="prod-edt" className={labelClass}>
                      EDT
                    </label>
                    <input
                      id="prod-edt"
                      value={form.edt}
                      onChange={(e) => setField('edt', e.target.value)}
                      className={inputClass}
                      placeholder="Referencia EDT"
                    />
                  </div>
                </section>
              )}

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {formError}
                </p>
              )}

              <div className="flex justify-between gap-3 pt-2 border-t border-[#E2E8F0]">
                <div className="flex gap-2">
                  {activeSection !== 'A' && (
                    <button
                      type="button"
                      onClick={() =>
                        setActiveSection(activeSection === 'C' ? 'B' : 'A')
                      }
                      className="h-11 px-4 rounded-lg border border-[#bec9c8] font-semibold text-[#3f4949] hover:bg-[#f0f3ff]"
                    >
                      Anterior
                    </button>
                  )}
                  {activeSection !== 'C' && (
                    <button
                      type="button"
                      onClick={() =>
                        setActiveSection(activeSection === 'A' ? 'B' : 'C')
                      }
                      className="h-11 px-4 rounded-lg border border-[#006a68] text-[#006a68] font-semibold hover:bg-[#E6FFFA]"
                    >
                      Siguiente
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="h-11 px-5 rounded-lg border border-[#bec9c8] font-semibold text-[#3f4949] hover:bg-[#f0f3ff]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving || loadingOptions}
                    className="h-11 px-6 rounded-lg bg-[#006162] text-white font-bold hover:opacity-90 disabled:opacity-50"
                  >
                    {saving ? 'Guardando…' : editingId ? 'Actualizar' : 'Guardar'}
                  </button>
                </div>
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
