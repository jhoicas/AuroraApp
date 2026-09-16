import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AIAssistedField from '../AuroraAsistente/AIAssistedField';

import { useProjectStore } from '../../store/projectStore';
import {
  useLocationStore,
  generateProjectName,
  type LocationSelection,
} from '../../store/locationStore';
import {
  CATALOG_FULL_LIST_LIMIT,
  useCatalogStore,
  type CatalogSector,
} from '../../store/catalogStore';

type CreateProjectModalProps = {
  open: boolean;
  onClose: () => void;
};

// ─── Constantes MGA ────────────────────────────────────────────────

const TIPOS_INVERSION = [
  { value: 'Territorial', label: 'Territorial', disabled: false },
  { value: 'Nacional', label: 'Nacional', disabled: true },
] as const;

const TIPOLOGIAS_PROYECTO = [
  "General - Esquemas SUIFP's",
  "E - Esquemas SUIFP's - Pueblos y comunidades étnicas",
  'A - PIIP - Bienes y Servicios',
  'E - PIIP - Pueblos y Comunidades Indígenas',
] as const;

const EMPTY_LOCATION: LocationSelection = {
  regionId: null,
  departamentoId: null,
  municipioId: null,
};

// ─── Componente principal ──────────────────────────────────────────

export default function CreateProjectModal({ open, onClose }: CreateProjectModalProps) {
  const navigate = useNavigate();
  const createProject = useProjectStore((s) => s.createProject);
  const isLoading = useProjectStore((s) => s.isLoading);

  // Stores externos
  const regions = useLocationStore((s) => s.regions);
  const procesos = useLocationStore((s) => s.procesos);
  const fetchLocations = useLocationStore((s) => s.fetchLocations);
  const fetchProcesos = useLocationStore((s) => s.fetchProcesos);

  const sectors = useCatalogStore((s) => s.sectors);
  const fetchSectors = useCatalogStore((s) => s.fetchSectors);
  const catalogProducts = useCatalogStore((s) => s.catalogProducts);
  const isLoadingProducts = useCatalogStore((s) => s.isLoadingProducts);
  const fetchCatalogProducts = useCatalogStore((s) => s.fetchCatalogProducts);

  // ─── Estado del formulario ──────────────────
  const [proceso, setProceso] = useState('');
  const [objeto, setObjeto] = useState('');
  const [localizaciones, setLocalizaciones] = useState<LocationSelection[]>([{ ...EMPTY_LOCATION }]);
  const [tipoInversion, setTipoInversion] = useState('Territorial');
  const [tipologiaProyecto, setTipologiaProyecto] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [productoPrincipal, setProductoPrincipal] = useState('');
  const [codeBpin, setCodeBpin] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // ─── Cargar datos al abrir ──────────────────
  useEffect(() => {
    if (!open) return;
    void fetchLocations();
    void fetchProcesos();
    void fetchSectors({ page: 1, limit: CATALOG_FULL_LIST_LIMIT });
  }, [open, fetchLocations, fetchProcesos, fetchSectors]);

  // ─── Nombre auto-generado ──────────────────
  const procesoName = useMemo(
    () => procesos.find((p) => String(p.id) === proceso)?.name ?? '',
    [procesos, proceso],
  );

  const generatedName = useMemo(
    () => generateProjectName(procesoName, objeto, localizaciones, regions),
    [procesoName, objeto, localizaciones, regions],
  );

  // ─── Sectores filtrados por tipología ──────────────────
  const filteredSectors = useMemo(() => {
    if (tipologiaProyecto === 'A - PIIP - Bienes y Servicios') {
      return sectors.filter(
        (s) => s.application && s.application.toUpperCase().includes('TERRITORIO'),
      );
    }
    return sectors;
  }, [sectors, tipologiaProyecto]);

  // ─── Productos del sector seleccionado ──────────────────
  const selectedSector: CatalogSector | undefined = useMemo(
    () => sectors.find((s) => s.id === sectorId),
    [sectors, sectorId],
  );

  useEffect(() => {
    if (!sectorId || !selectedSector) {
      setProductoPrincipal('');
      return;
    }
    void fetchCatalogProducts({
      page: 1,
      limit: CATALOG_FULL_LIST_LIMIT,
      search: selectedSector.code,
    });
  }, [sectorId, selectedSector, fetchCatalogProducts]);

  // ─── Handlers de localización ──────────────────
  const updateLocation = useCallback(
    (index: number, field: keyof LocationSelection, value: number | null) => {
      setLocalizaciones((prev) => {
        const copy = [...prev];
        const item = { ...copy[index] };
        item[field] = value;
        // Limpiar niveles inferiores al cambiar un superior
        if (field === 'regionId') {
          item.departamentoId = null;
          item.municipioId = null;
        }
        if (field === 'departamentoId') {
          item.municipioId = null;
        }
        copy[index] = item;
        return copy;
      });
    },
    [],
  );

  const addLocation = useCallback(() => {
    setLocalizaciones((prev) => [...prev, { ...EMPTY_LOCATION }]);
  }, []);

  const removeLocation = useCallback((index: number) => {
    setLocalizaciones((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ─── Helpers de resolución ──────────────────
  const getDepartamentos = useCallback(
    (regionId: number | null) => {
      if (regionId === null) return [];
      return regions.find((r) => r.id === regionId)?.departamentos ?? [];
    },
    [regions],
  );

  const getMunicipios = useCallback(
    (regionId: number | null, depId: number | null) => {
      if (regionId === null || depId === null) return [];
      const dep = regions
        .find((r) => r.id === regionId)
        ?.departamentos.find((d) => d.id === depId);
      return dep?.municipios ?? [];
    },
    [regions],
  );

  // ─── Reset ──────────────────
  const reset = () => {
    setProceso('');
    setObjeto('');
    setLocalizaciones([{ ...EMPTY_LOCATION }]);
    setTipoInversion('Territorial');
    setTipologiaProyecto('');
    setSectorId('');
    setProductoPrincipal('');
    setCodeBpin('');
    setDescription('');
    setFormError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleTipologiaChange = (value: string) => {
    setTipologiaProyecto(value);
    // Si cambió la tipología, verificar que el sector sigue siendo válido
    setSectorId('');
    setProductoPrincipal('');
  };

  // ─── Submit ──────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!proceso) {
      setFormError('El proceso es obligatorio.');
      return;
    }
    if (!objeto.trim()) {
      setFormError('El objeto del proyecto es obligatorio.');
      return;
    }
    if (localizaciones.length === 0 || !localizaciones.some(l => l.regionId)) {
      setFormError('Debe seleccionar al menos una localización con su respectiva región.');
      return;
    }
    if (!tipologiaProyecto) {
      setFormError('La tipología de proyecto es obligatoria.');
      return;
    }
    if (!sectorId) {
      setFormError('Selecciona un sector.');
      return;
    }
    if (!productoPrincipal) {
      setFormError('El producto principal es obligatorio.');
      return;
    }

    try {
      const project = await createProject({
        name: generatedName,
        sector: selectedSector?.name ?? '',
        sector_id: sectorId,
        description: description || undefined,
        code_bpin: codeBpin || undefined,
        product_code: productoPrincipal || undefined,
        proceso_id: parseInt(proceso, 10),
        objeto: objeto.trim(),
        localizaciones: localizaciones,
        tipo_inversion: tipoInversion,
        tipologia: tipologiaProyecto,
      });
      handleClose();
      navigate(`/tenant/projects/${project.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al crear el proyecto');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-title"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-lg border border-gray-100"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 sticky top-0 bg-white z-10">
          <h3 id="create-project-title" className="text-lg font-semibold text-gray-800">
            Nuevo proyecto MGA
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-800"
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* ── Nombre auto-generado (readonly) ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del proyecto
              <span className="ml-1 text-xs text-gray-400">(auto-generado)</span>
            </label>
            <div
              id="project-generated-name"
              className="w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 min-h-[40px]"
            >
              {generatedName || (
                <span className="italic text-gray-400">
                  Se generará a partir de proceso + objeto + localizaciones
                </span>
              )}
            </div>
          </div>

          {/* ── Proceso ── */}
          <AIAssistedField
            label="Proceso"
            htmlFor="project-proceso"
            required
            guidance="Verbo rector que define el tipo de intervención del proyecto según la MGA (ej: Construcción, Adquisición, Dotación)."
            askPrompt="¿Qué es el proceso en la formulación MGA y cómo elijo el verbo rector correcto para mi proyecto?"
          >
            <select
              id="project-proceso"
              required
              value={proceso}
              onChange={(e) => setProceso(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="">Selecciona un proceso</option>
              {procesos.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          </AIAssistedField>

          {/* ── Objeto ── */}
          <AIAssistedField
            label="Objeto"
            htmlFor="project-objeto"
            required
            guidance="Describa brevemente qué se entrega (bien o servicio público). Máximo 1000 caracteres. Este texto es parte del nombre oficial del proyecto."
            askPrompt="¿Cómo redacto el objeto de un proyecto MGA? Dame ejemplos de buena y mala redacción."
          >
            <textarea
              id="project-objeto"
              required
              maxLength={1000}
              rows={3}
              value={objeto}
              onChange={(e) => setObjeto(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-none"
              placeholder="Ej: acueducto rural para mejorar acceso a agua potable en veredas del municipio"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{objeto.length}/1000</p>
          </AIAssistedField>

          {/* ── Localizaciones ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Localizaciones <span className="text-red-500">*</span>
            </label>
            <div className="space-y-3">
              {localizaciones.map((loc, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    {/* Región */}
                    <select
                      value={loc.regionId ?? ''}
                      onChange={(e) =>
                        updateLocation(idx, 'regionId', e.target.value ? Number(e.target.value) : null)
                      }
                      className="rounded border border-gray-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      aria-label={`Región ${idx + 1}`}
                    >
                      <option value="">Región</option>
                      {regions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>

                    {/* Departamento */}
                    <select
                      value={loc.departamentoId ?? ''}
                      onChange={(e) =>
                        updateLocation(
                          idx,
                          'departamentoId',
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                      disabled={!loc.regionId}
                      className="rounded border border-gray-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-gray-50 disabled:text-gray-400"
                      aria-label={`Departamento ${idx + 1}`}
                    >
                      <option value="">Departamento</option>
                      {getDepartamentos(loc.regionId).map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>

                    {/* Municipio */}
                    <select
                      value={loc.municipioId ?? ''}
                      onChange={(e) =>
                        updateLocation(
                          idx,
                          'municipioId',
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                      disabled={!loc.departamentoId}
                      className="rounded border border-gray-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-gray-50 disabled:text-gray-400"
                      aria-label={`Municipio ${idx + 1}`}
                    >
                      <option value="">Municipio (opc.)</option>
                      {getMunicipios(loc.regionId, loc.departamentoId).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {localizaciones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLocation(idx)}
                      className="mt-1 text-red-400 hover:text-red-600 shrink-0"
                      aria-label={`Quitar localización ${idx + 1}`}
                    >
                      <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addLocation}
              className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-medium"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Agregar localización
            </button>
          </div>

          <hr className="border-gray-100" />

          {/* ── Tipo de inversión ── */}
          <div>
            <label htmlFor="project-tipo-inversion" className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de inversión <span className="text-red-500">*</span>
            </label>
            <select
              id="project-tipo-inversion"
              value={tipoInversion}
              onChange={(e) => setTipoInversion(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              {TIPOS_INVERSION.map((t) => (
                <option key={t.value} value={t.value} disabled={t.disabled}>
                  {t.label}
                  {t.disabled ? ' (no disponible)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* ── Tipología de proyecto ── */}
          <AIAssistedField
            label="Tipología de proyecto"
            htmlFor="project-tipologia"
            required
            guidance="La tipología determina la estructura de productos del catálogo MGA disponible para este proyecto."
            askPrompt="¿Cuáles son las tipologías de proyecto MGA y cómo afectan la formulación?"
          >
            <select
              id="project-tipologia"
              required
              value={tipologiaProyecto}
              onChange={(e) => handleTipologiaChange(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="">Selecciona una tipología</option>
              {TIPOLOGIAS_PROYECTO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </AIAssistedField>

          {/* ── Sector (filtrado por tipología) ── */}
          <AIAssistedField
            label="Sector"
            htmlFor="project-sector"
            required
            guidance="El sector define la clasificación programática DNP. Cuando la tipología es 'A - PIIP', solo se muestran los sectores con ámbito territorial."
            askPrompt="¿Cómo elijo el sector correcto del catálogo DNP para mi proyecto de inversión? Explica el criterio de clasificación programática."
          >
            <select
              id="project-sector"
              required
              value={sectorId}
              onChange={(e) => {
                setSectorId(e.target.value);
                setProductoPrincipal('');
              }}
              disabled={!tipologiaProyecto}
              className="w-full rounded border border-gray-300 px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">
                {!tipologiaProyecto
                  ? 'Selecciona primero una tipología'
                  : 'Selecciona un sector'}
              </option>
              {filteredSectors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code ? `${s.code} — ${s.name}` : s.name}
                </option>
              ))}
            </select>
          </AIAssistedField>

          {/* ── Producto principal (habilitado tras sector) ── */}
          <AIAssistedField
            label="Producto principal del proyecto"
            htmlFor="project-producto-principal"
            required
            guidance="El producto principal es el bien o servicio público que el proyecto entregará. Se habilita tras seleccionar el sector."
            askPrompt="¿Cómo identifico el producto principal de mi proyecto MGA en el catálogo DNP?"
          >
            <select
              id="project-producto-principal"
              required
              value={productoPrincipal}
              onChange={(e) => setProductoPrincipal(e.target.value)}
              disabled={!sectorId || isLoadingProducts}
              className="w-full rounded border border-gray-300 px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">
                {!sectorId
                  ? 'Selecciona primero un sector'
                  : isLoadingProducts
                    ? 'Cargando productos…'
                    : 'Selecciona un producto'}
              </option>
              {catalogProducts.map((p) => (
                <option key={p.id} value={p.codigo_del_producto}>
                  {p.codigo_del_producto} — {p.producto}
                </option>
              ))}
            </select>
          </AIAssistedField>

          {/* ── Código BPIN (opcional) ── */}
          <AIAssistedField
            label="Código BPIN"
            htmlFor="project-bpin"
            guidance="El BPIN identifica el proyecto en el Banco de Programas y Proyectos. Si aún no lo tiene, déjelo vacío y regístrelo cuando la entidad lo asigne."
            askPrompt="¿Qué es el código BPIN y cuándo debo registrarlo en la formulación de un proyecto MGA?"
          >
            <input
              id="project-bpin"
              value={codeBpin}
              onChange={(e) => setCodeBpin(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              placeholder="2024000123456 (opcional)"
            />
          </AIAssistedField>

          {/* ── Descripción (opcional) ── */}
          <AIAssistedField
            label="Descripción"
            htmlFor="project-desc"
            guidance="Resuma en pocas líneas el alcance del proyecto: qué se construye o implementa, para quién y en qué territorio."
            askPrompt="¿Cómo redacto una descripción breve y clara de un proyecto de inversión pública para el MGA?"
          >
            <textarea
              id="project-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-none"
              placeholder="Breve descripción del proyecto de inversión"
            />
          </AIAssistedField>

          {formError && (
            <div
              role="alert"
              className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-1 rounded bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white px-4 py-2 text-sm font-medium"
            >
              <span className="material-symbols-outlined text-base">add</span>
              {isLoading ? 'Creando…' : 'Crear proyecto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
