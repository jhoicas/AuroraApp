import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useCatalogStore,
  type CatalogProgram,
  type CatalogSector,
  type Product,
} from '../../store/catalogStore';
import { useProjectStore } from '../../store/projectStore';

const selectClass =
  'w-full h-12 px-3 rounded-lg border-2 border-gray-200 bg-white text-gray-900 focus:outline-none focus:border-[#006162] focus:ring-4 focus:ring-[#006162]/10 transition-all disabled:bg-gray-50 disabled:text-gray-400';

/**
 * Catálogo DNP tenant: wizard en cascada Sector → Programa → Producto
 * y creación de proyecto según clasificación programática del manual DNP.
 */
export default function CatalogPage() {
  const navigate = useNavigate();
  const sectors = useCatalogStore((s) => s.sectors);
  const programs = useCatalogStore((s) => s.programs);
  const catalogProducts = useCatalogStore((s) => s.catalogProducts);
  const isLoading = useCatalogStore((s) => s.isLoading);
  const isLoadingProducts = useCatalogStore((s) => s.isLoadingProducts);
  const catalogError = useCatalogStore((s) => s.error);
  const fetchSectors = useCatalogStore((s) => s.fetchSectors);
  const fetchPrograms = useCatalogStore((s) => s.fetchProgramsBySector);
  const fetchCatalogProducts = useCatalogStore((s) => s.fetchCatalogProducts);

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
    void fetchSectors({ page: 1, limit: 100 });
  }, [fetchSectors]);

  useEffect(() => {
    if (!sectorId) {
      setProgramCode('');
      setProductCode('');
      return;
    }
    setProgramCode('');
    setProductCode('');
    void fetchPrograms(sectorId);
  }, [sectorId, fetchPrograms]);

  useEffect(() => {
    if (!programCode) {
      setProductCode('');
      return;
    }
    setProductCode('');
    void fetchCatalogProducts({ page: 1, limit: 100, search: programCode });
  }, [programCode, fetchCatalogProducts]);

  const selectedSector: CatalogSector | undefined = useMemo(
    () => sectors.find((s) => s.id === sectorId),
    [sectors, sectorId],
  );

  const sectorPrograms: CatalogProgram[] = useMemo(
    () => programs.filter((p) => p.sector_id === sectorId),
    [programs, sectorId],
  );

  const selectedProgram: CatalogProgram | undefined = useMemo(
    () => sectorPrograms.find((p) => p.code === programCode),
    [sectorPrograms, programCode],
  );

  const filteredProducts: Product[] = useMemo(() => {
    if (!programCode) return [];
    return catalogProducts.filter(
      (p) =>
        p.codigo_del_programa === programCode ||
        p.codigo_del_programa.startsWith(programCode),
    );
  }, [catalogProducts, programCode]);

  const selectedProduct: Product | undefined = useMemo(
    () => filteredProducts.find((p) => p.codigo_del_producto === productCode),
    [filteredProducts, productCode],
  );

  const loadingCascade = isLoading || isLoadingProducts;

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
                <p className="text-sm text-gray-500">Seleccione en cascada para formular un proyecto</p>
              </div>
            </div>

            <div className="grid gap-5">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-gray-700">1. Seleccionar Sector</span>
                <select
                  className={selectClass}
                  value={sectorId}
                  onChange={(e) => setSectorId(e.target.value)}
                  disabled={loadingCascade && sectors.length === 0}
                >
                  <option value="">— Elija un sector DNP —</option>
                  {sectors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-gray-700">2. Seleccionar Programa</span>
                <select
                  className={selectClass}
                  value={programCode}
                  onChange={(e) => setProgramCode(e.target.value)}
                  disabled={!sectorId || isLoading}
                >
                  <option value="">
                    {!sectorId ? '— Primero elija un sector —' : '— Elija un programa —'}
                  </option>
                  {sectorPrograms.map((p) => (
                    <option key={p.id} value={p.code}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
                {sectorId && !isLoading && sectorPrograms.length === 0 && (
                  <p className="text-xs text-amber-700">Este sector no tiene programas cargados.</p>
                )}
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-gray-700">3. Seleccionar Producto</span>
                <select
                  className={selectClass}
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                  disabled={!programCode || isLoadingProducts}
                >
                  <option value="">
                    {!programCode ? '— Primero elija un programa —' : '— Elija un producto —'}
                  </option>
                  {filteredProducts.map((p) => (
                    <option key={p.id} value={p.codigo_del_producto}>
                      {p.codigo_del_producto} — {p.producto}
                    </option>
                  ))}
                </select>
                {programCode && !isLoadingProducts && filteredProducts.length === 0 && (
                  <p className="text-xs text-amber-700">
                    No hay productos asociados a este programa en el catálogo maestro.
                  </p>
                )}
              </label>
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

            {(isLoading || isLoadingProducts) && (
              <p className="text-sm text-gray-500 inline-flex items-center gap-2">
                <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                Cargando catálogo…
              </p>
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
                  className={selectClass}
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
