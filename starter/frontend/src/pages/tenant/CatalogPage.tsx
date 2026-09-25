import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchableCombobox, {
  type ComboboxOption,
} from '../../components/Catalog/SearchableCombobox';
import {
  CATALOG_FULL_LIST_LIMIT,
  formatCatalogProductOptionTitle,
  useCatalogStore,
  type CatalogProgram,
  type CatalogSector,
  type Product,
} from '../../store/catalogStore';

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

  const [sectorId, setSectorId] = useState('');
  const [programCode, setProgramCode] = useState('');
  const [productId, setProductId] = useState('');

  useEffect(() => {
    void fetchSectors({ page: 1, limit: CATALOG_FULL_LIST_LIMIT });
  }, [fetchSectors]);

  const handleSectorChange = useCallback(
    (nextSectorId: string) => {
      setSectorId(nextSectorId);
      setProgramCode('');
      setProductId('');
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
      setProductId('');
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

  const handleProductChange = useCallback((nextProductId: string) => {
    setProductId(nextProductId);
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
    () => filteredProducts.find((p) => p.id === productId),
    [filteredProducts, productId],
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
        value: product.id,
        code: product.codigo_del_producto,
        label: product.producto,
        indicatorCode: product.codigo_del_indicador_de_producto,
        indicatorLabel: product.indicador_de_producto,
        hint: product.descripcion?.trim() || undefined,
      })),
    [filteredProducts],
  );

  const handleFormularProyecto = () => {
    if (!selectedSector || !selectedProduct) return;
    const sectorCode = selectedSector.code || (selectedSector as any).codigo || '';
    const productCode = selectedProduct.codigo_del_producto || (selectedProduct as any).codigo_producto || '';
    navigate('/tenant/projects', {
      state: {
        openIdeation: true,
        preselectedSectorCode: sectorCode,
        preselectedProductCode: productCode,
      },
    });
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
          {catalogError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {catalogError}
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
                  programCode
                    ? 'Buscar por producto o indicador (código o nombre)…'
                    : 'Primero elija un programa'
                }
                options={productOptions}
                value={productId}
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
                <p className="font-semibold text-gray-900">
                  {formatCatalogProductOptionTitle(selectedProduct)}
                </p>
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
                    <dt className="font-medium text-gray-500">Indicador</dt>
                    <dd>
                      {selectedProduct.codigo_del_indicador_de_producto} —{' '}
                      {selectedProduct.indicador_de_producto}
                    </dd>
                  </div>
                </dl>

                <button
                  type="button"
                  onClick={handleFormularProyecto}
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
    </div>
  );
}
