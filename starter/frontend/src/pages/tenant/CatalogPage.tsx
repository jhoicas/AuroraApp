import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchableCombobox, {
  type ComboboxOption,
} from '../../components/Catalog/SearchableCombobox';
import {
  CATALOG_FULL_LIST_LIMIT,
  useCatalogStore,
  type CatalogProgram,
  type CatalogSector,
  type Product,
} from '../../store/catalogStore';
import { useProjectStore } from '../../store/projectStore';

const inputClass =
  'w-full h-12 px-3 rounded-lg border-2 border-gray-200 bg-white text-gray-900 focus:outline-none focus:border-[#006162] focus:ring-4 focus:ring-[#006162]/10 transition-all disabled:bg-gray-50 disabled:text-gray-400';

/**
 * Catálogo DNP tenant: wizard en cascada Sector → Programa → Producto
 * y creación de proyecto según clasificación programática del manual DNP.
 */
export default function CatalogPage() {
  const navigate = useNavigate();
  const sectors = useCatalogStore((s) => s.sectors);
  const programs = useCatalogStore((s) => s.programs);
  const programsSectorId = useCatalogStore((s) => s.programsSectorId);
  const catalogProducts = useCatalogStore((s) => s.catalogProducts);
  const catalogProductsProgramCode = useCatalogStore((s) => s.catalogProductsProgramCode);
  const isLoadingSectors = useCatalogStore((s) => s.isLoading);
  const isLoadingSectorPrograms = useCatalogStore((s) => s.isLoadingSectorPrograms);
  const isLoadingProducts = useCatalogStore((s) => s.isLoadingProducts);
  const catalogError = useCatalogStore((s) => s.error);
  const fetchSectors = useCatalogStore((s) => s.fetchSectors);
  const fetchPrograms = useCatalogStore((s) => s.fetchProgramsBySector);
  const fetchCatalogProducts = useCatalogStore((s) => s.fetchCatalogProducts);
  const clearPrograms = useCatalogStore((s) => s.clearPrograms);
  const clearProducts = useCatalogStore((s) => s.clearProducts);

  const createProject = useProjectStore((s) => s.createProject);
  const projectError = useProjectStore((s) => s.error);
  const clearProjectError = useProjectStore((s) => s.clearError);
  const isCreating = useProjectStore((s) => s.isLoading);

  const [sectorId, setSectorId] = useState('');
  const [programCode, setProgramCode] = useState('');
  const [productCode, setProductCode] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void fetchSectors({ page: 1, limit: CATALOG_FULL_LIST_LIMIT });
  }, [fetchSectors]);

  const handleSectorChange = useCallback(
    (nextSectorId: string) => {
      setSectorId(nextSectorId);
      setProgramCode('');
      setProductCode('');
      clearProducts();

      if (!nextSectorId) {
        clearPrograms();
        return;
      }

      void fetchPrograms(nextSectorId);
    },
    [clearProducts, clearPrograms, fetchPrograms],
  );

  const handleProgramChange = useCallback(
    (nextProgramCode: string) => {
      setProgramCode(nextProgramCode);
      setProductCode('');
      clearProducts();

      if (!nextProgramCode) {
        return;
      }

      void fetchCatalogProducts({
        page: 1,
        limit: CATALOG_FULL_LIST_LIMIT,
        search: nextProgramCode,
      });
    },
    [clearProducts, fetchCatalogProducts],
  );

  const handleProductChange = useCallback((nextProductCode: string) => {
    setProductCode(nextProductCode);
  }, []);

  const selectedSector: CatalogSector | undefined = useMemo(
    () => sectors.find((s) => s.id === sectorId),
    [sectors, sectorId],
  );

  const sectorPrograms: CatalogProgram[] = useMemo(() => {
    if (!sectorId || programsSectorId !== sectorId) {
      return [];
    }
    return programs.filter((p) => p.sector_id === sectorId);
  }, [programs, programsSectorId, sectorId]);

  const selectedProgram: CatalogProgram | undefined = useMemo(
    () => sectorPrograms.find((p) => p.code === programCode),
    [sectorPrograms, programCode],
  );

  const filteredProducts: Product[] = useMemo(() => {
    if (!programCode || catalogProductsProgramCode !== programCode) {
      return [];
    }
    return catalogProducts.filter(
      (p) =>
        p.codigo_del_programa === programCode ||
        p.codigo_del_programa.startsWith(programCode),
    );
  }, [catalogProducts, catalogProductsProgramCode, programCode]);

  const selectedProduct: Product | undefined = useMemo(
    () => filteredProducts.find((p) => p.codigo_del_producto === productCode),
    [filteredProducts, productCode],
  );

  const sectorOptions: ComboboxOption[] = useMemo(
    () =>
      sectors.map((sector) => ({
        value: sector.id,
        code: sector.code,
        label: sector.name,
      })),
    [sectors],
  );

  const programOptions: ComboboxOption[] = useMemo(
    () =>
      sectorPrograms.map((program) => ({
        value: program.code,
        code: program.code,
        label: program.name,
      })),
    [sectorPrograms],
  );

  const productOptions: ComboboxOption[] = useMemo(
    () =>
      filteredProducts.map((product) => ({
        value: product.codigo_del_producto,
        code: product.codigo_del_producto,
        label: product.producto,
        hint: product.descripcion,
      })),
    [filteredProducts],
  );

  const openModal = () => {
    if (!selectedSector || !selectedProgram || !selectedProduct) return;
    clearProjectError();
    setFormError(null);
    setProjectName(
      `${selectedProduct.producto}`.slice(0, 120).trim() ||
        `Proyecto ${selectedProduct.codigo_del_producto}`,
    );
    setModalOpen(true);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const name = projectName.trim();
    if (name.length < 3) {
      setFormError('El nombre debe tener al menos 3 caracteres.');
      return;
    }
    if (!selectedSector || !selectedProgram || !selectedProduct) {
      setFormError('Seleccione sector, programa y producto.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const project = await createProject({
        name,
        sector: selectedSector.name,
        sector_id: selectedSector.id,
        program_code: selectedProgram.code,
        product_code: selectedProduct.codigo_del_producto,
        description: `Clasificación DNP · Sector ${selectedSector.code} · Programa ${selectedProgram.code} · Producto ${selectedProduct.codigo_del_producto}`,
        code_bpin: selectedProduct.codigo_del_producto,
      });
      setModalOpen(false);
      navigate(`/tenant/projects/${project.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo crear el proyecto');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="-m-6">
      <section className="px-6 py-8 md:px-10 bg-gray-50 border-b border-gray-200">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-4xl font-bold text-[#006162] mb-3">
            Catálogo DNP · Formulación
          </h2>
          <p className="text-base md:text-lg text-gray-600 mb-2 max-w-3xl">
            Clasificación programática según el manual de procedimientos de inversión pública del DNP:
            Sector → Programa → Producto.
          </p>
        </div>
      </section>

      <section className="px-6 py-8 md:px-10">
        <div className="max-w-4xl mx-auto space-y-6">
          {(catalogError || projectError) && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {catalogError || projectError}
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#006162]/10 flex items-center justify-center text-[#006162]">
                <span className="material-symbols-outlined">account_tree</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Wizard de clasificación</h3>
                <p className="text-sm text-gray-500">
                  Busque por código (ej. 11, 17) o por nombre (ej. RELACIONES, AGRICULTURA)
                </p>
              </div>
            </div>

            <div className="grid gap-5">
              <SearchableCombobox
                label="1. Seleccionar Sector"
                placeholder="Buscar sector por código o nombre…"
                options={sectorOptions}
                value={sectorId}
                onChange={handleSectorChange}
                disabled={isLoadingSectors && sectors.length === 0}
                loading={isLoadingSectors && sectors.length === 0}
                loadingMessage="Cargando sectores…"
                emptyMessage="No hay sectores cargados en el catálogo maestro."
              />

              <SearchableCombobox
                label="2. Seleccionar Programa"
                placeholder={
                  sectorId ? 'Buscar programa por código o nombre…' : 'Primero elija un sector'
                }
                options={programOptions}
                value={programCode}
                onChange={handleProgramChange}
                disabled={!sectorId}
                loading={Boolean(sectorId) && isLoadingSectorPrograms}
                loadingMessage="Cargando programas…"
                emptyMessage={
                  sectorId ? 'Este sector no tiene programas cargados.' : 'Seleccione un sector primero.'
                }
              />
              {sectorId && !isLoadingSectorPrograms && sectorPrograms.length === 0 && (
                <p className="-mt-3 text-xs text-amber-700">Este sector no tiene programas cargados.</p>
              )}

              <SearchableCombobox
                label="3. Seleccionar Producto"
                placeholder={
                  programCode ? 'Buscar producto por código o nombre…' : 'Primero elija un programa'
                }
                options={productOptions}
                value={productCode}
                onChange={handleProductChange}
                disabled={!sectorId || !programCode}
                loading={Boolean(programCode) && isLoadingProducts}
                loadingMessage="Cargando productos…"
                emptyMessage={
                  programCode
                    ? 'No hay productos asociados a este programa en el catálogo maestro.'
                    : 'Seleccione un programa primero.'
                }
              />
              {programCode && !isLoadingProducts && filteredProducts.length === 0 && (
                <p className="-mt-3 text-xs text-amber-700">
                  No hay productos asociados a este programa en el catálogo maestro.
                </p>
              )}
            </div>

            {selectedProduct && (
              <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#006162]">
                  Producto seleccionado
                </p>
                <p className="font-semibold text-gray-900">{selectedProduct.producto}</p>
                <p className="text-sm text-gray-600 line-clamp-3">{selectedProduct.descripcion}</p>
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-600">
                  <div>
                    <dt className="font-medium text-gray-500">Sector</dt>
                    <dd>{selectedSector?.name}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Programa</dt>
                    <dd>
                      {selectedProgram?.code} — {selectedProgram?.name}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Código producto</dt>
                    <dd>{selectedProduct.codigo_del_producto}</dd>
                  </div>
                </dl>

                <button
                  type="button"
                  onClick={openModal}
                  className="w-full sm:w-auto h-12 px-6 inline-flex items-center justify-center gap-2 bg-[#006162] hover:bg-[#004f50] text-white font-semibold rounded-lg shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#006162] transition-all"
                >
                  <span className="material-symbols-outlined">rocket_launch</span>
                  Formular Proyecto con este Producto
                </button>
              </div>
            )}
          </div>

          <div className="bg-[#006162]/5 rounded-xl p-8 border border-[#006162]/20 text-center">
            <span className="material-symbols-outlined text-[#006162] text-4xl mb-2">menu_book</span>
            <p className="text-gray-600 max-w-lg mx-auto text-sm">
              La jerarquía Sector → Programa → Producto alinea la formulación con los lineamientos del
              Departamento Nacional de Planeación.
            </p>
          </div>
        </div>
      </section>

      {modalOpen && selectedSector && selectedProgram && selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-project-title"
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="create-project-title" className="text-lg font-bold text-gray-900">
                  Nombre del Proyecto
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Se creará en su entidad con la clasificación DNP seleccionada.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Cerrar"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-gray-700">Nombre</span>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className={inputClass}
                  placeholder="Ej. Construcción de acueducto rural…"
                  autoFocus
                  required
                  minLength={3}
                  maxLength={500}
                />
              </label>

              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600 space-y-1">
                <p>
                  <strong>Sector:</strong> {selectedSector.code} — {selectedSector.name}
                </p>
                <p>
                  <strong>Programa:</strong> {selectedProgram.code} — {selectedProgram.name}
                </p>
                <p>
                  <strong>Producto:</strong> {selectedProduct.codigo_del_producto} —{' '}
                  {selectedProduct.producto}
                </p>
              </div>

              {(formError || projectError) && (
                <p role="alert" className="text-sm text-red-700">
                  {formError || projectError}
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-11 px-4 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                  disabled={submitting || isCreating}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || isCreating}
                  className="h-11 px-5 rounded-lg bg-[#006162] text-white font-semibold hover:bg-[#004f50] disabled:opacity-60 inline-flex items-center gap-2"
                >
                  {(submitting || isCreating) && (
                    <span className="material-symbols-outlined animate-spin text-base">
                      progress_activity
                    </span>
                  )}
                  Crear proyecto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
