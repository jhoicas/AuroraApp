import { useState, useEffect, useRef } from 'react';
import { HelpCircle, Plus, Trash2, MapPin, AlertCircle, CheckCircle2, Users, CheckSquare } from 'lucide-react';
import { useProjectStore, type Project } from '../../../store/projectStore';
import { useProjectMgaStore, parsePopulationLocations, type ProjectMgaLocalizationItem } from '../../../store/projectMgaStore';
import { useLocationStore, type Region, type Departamento, type Municipio, type TipoAgrupacion, type Agrupacion } from '../../../store/locationStore';
import MgaAlert from './MgaAlert';

export const FACTORES_ANALIZADOS_MGA = [
  'Aspectos administrativos y políticos',
  'Cercanía a la población objetivo',
  'Cercanía de fuentes de abastecimiento',
  'Comunicaciones',
  'Costo y disponibilidad de terrenos',
  'Disponibilidad de servicios públicos domiciliarios (Agua, energía y otros)',
  'Disponibilidad y costo de mano de obra',
  'Estructura impositiva y legal',
  'Factores ambientales',
  'Impacto para la Equidad de Género',
  'Medios y costos de transporte',
  'Orden público',
  'Otros',
  'Topografía',
] as const;

interface LocalizacionRow {
  region_id: number | null;
  departamento_id: number | null;
  municipio_id: number | null;
  tipo_agrupacion_id: number | null;
  agrupacion_id: number | null;
}

export default function LocalizacionTab({ project }: { project: Project }) {
  const currentProject = useProjectStore((state) => state.currentProject);
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));
  const saveLocalizacion = useProjectMgaStore((s) => s.saveLocalizacion);
  const isSaving = useProjectMgaStore((s) => s.isSaving);

  const {
    regions,
    tiposAgrupacion,
    agrupaciones,
    isLoadingLocations,
    fetchLocations,
    fetchTiposAgrupacion,
    fetchAgrupaciones,
  } = useLocationStore();

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<LocalizacionRow[]>([]);
  const [factores, setFactores] = useState<string[]>(() => {
    const saved =
      formulation.factores_analizados ||
      formulation.localizaciones_factores ||
      (formulation.localizacion as any)?.factores_analizados ||
      (project.mga_formulation_data as any)?.factores_analizados;
    return Array.isArray(saved) ? saved : [];
  });
  const isUserEditedRef = useRef(false);

  // Proyecto activo con prioridad al del store
  const activeProject = (currentProject && currentProject.id === project.id ? currentProject : null) || currentProject || project;

  // Tipología del proyecto para lógica étnica condicional
  const tipologia =
    project.mga_formulation_data?.tipologia ||
    activeProject?.mga_formulation_data?.tipologia ||
    (formulation as any)?.tipologia ||
    (activeProject as any)?.tipologia ||
    '';
  const isEthnic =
    tipologia === "E - Esquemas SUIFP's - Pueblos y comunidades étnicas" ||
    tipologia === "E - PIIP - Pueblos y Comunidades Indígenas";

  // Carga inicial de catálogos
  useEffect(() => {
    fetchLocations(false);
    if (isEthnic) {
      fetchTiposAgrupacion(false);
      fetchAgrupaciones();
    }
  }, [fetchLocations, fetchTiposAgrupacion, fetchAgrupaciones, isEthnic]);

  // Helper de casteo ultra-seguro (string o number -> number | null)
  const toNumOrNull = (val: unknown): number | null => {
    if (val === null || val === undefined || val === '') return null;
    const num = Number(val);
    return Number.isNaN(num) ? null : num;
  };

  // Inicialización y sincronización con datos base del proyecto
  useEffect(() => {
    // Si el usuario ya interactuó o editó manualmente, respetamos sus cambios y no sobreescribimos
    if (isUserEditedRef.current) return;

    // Verificar si actualmente rows ya tiene datos cargados válidos
    const hasValidCurrentRow =
      rows.length > 0 &&
      rows.some((r) => r.region_id !== null || r.departamento_id !== null || r.municipio_id !== null);

    // Si ya tiene datos válidos y el usuario agregó filas adicionales, no sobreescribir
    if (hasValidCurrentRow && rows.length > 1) {
      return;
    }

    let initialRows: LocalizacionRow[] = [];

    // 1. Verificar si ya existen localizaciones guardadas en la formulación MGA o en el proyecto
    const existing =
      formulation.localizaciones ||
      (formulation.localizacion?.localizaciones as any[]) ||
      (project.mga_formulation_data?.localizaciones as any[]) ||
      (activeProject?.mga_formulation_data?.localizaciones as any[]) ||
      ((activeProject?.mga_formulation_data?.identificacion as any)?.localizaciones as any[]) ||
      ((project.mga_formulation_data?.identificacion as any)?.localizaciones as any[]) ||
      (activeProject?.localizaciones as any[]) ||
      (project.localizaciones as any[]);

    if (existing && Array.isArray(existing) && existing.length > 0) {
      initialRows = existing
        .map((loc: any) => ({
          region_id: toNumOrNull(loc.region_id ?? loc.regionId),
          departamento_id: toNumOrNull(loc.departamento_id ?? loc.departamentoId),
          municipio_id: toNumOrNull(loc.municipio_id ?? loc.municipioId),
          tipo_agrupacion_id: toNumOrNull(loc.tipo_agrupacion_id ?? loc.tipoAgrupacionId),
          agrupacion_id: toNumOrNull(loc.agrupacion_id ?? loc.agrupacionId),
        }))
        .filter((r) => r.region_id !== null || r.departamento_id !== null || r.municipio_id !== null);
    }

    // 2. Si no hay localizaciones en array o quedaron vacías, pre-poblar con la localización base del proyecto
    if (initialRows.length === 0) {
      const baseRegion = toNumOrNull(
        activeProject?.region_id ??
        activeProject?.regionId ??
        project.region_id ??
        project.regionId ??
        currentProject?.region_id ??
        currentProject?.regionId ??
        activeProject?.mga_formulation_data?.region_id ??
        activeProject?.mga_formulation_data?.regionId ??
        (activeProject?.mga_formulation_data?.identificacion as any)?.region_id ??
        (activeProject?.mga_formulation_data?.identificacion as any)?.regionId ??
        (activeProject?.mga_formulation_data?.localizacion as any)?.region_id ??
        (activeProject?.mga_formulation_data?.localizacion as any)?.regionId ??
        project.mga_formulation_data?.region_id ??
        project.mga_formulation_data?.regionId ??
        (project.mga_formulation_data?.identificacion as any)?.region_id ??
        (project.mga_formulation_data?.identificacion as any)?.regionId
      );

      const baseDepto = toNumOrNull(
        activeProject?.departamento_id ??
        activeProject?.departamentoId ??
        project.departamento_id ??
        project.departamentoId ??
        currentProject?.departamento_id ??
        currentProject?.departamentoId ??
        activeProject?.mga_formulation_data?.departamento_id ??
        activeProject?.mga_formulation_data?.departamentoId ??
        (activeProject?.mga_formulation_data?.identificacion as any)?.departamento_id ??
        (activeProject?.mga_formulation_data?.identificacion as any)?.departamentoId ??
        (activeProject?.mga_formulation_data?.localizacion as any)?.departamento_id ??
        (activeProject?.mga_formulation_data?.localizacion as any)?.departamentoId ??
        project.mga_formulation_data?.departamento_id ??
        project.mga_formulation_data?.departamentoId ??
        (project.mga_formulation_data?.identificacion as any)?.departamento_id ??
        (project.mga_formulation_data?.identificacion as any)?.departamentoId
      );

      const baseMun = toNumOrNull(
        activeProject?.municipio_id ??
        activeProject?.municipioId ??
        project.municipio_id ??
        project.municipioId ??
        currentProject?.municipio_id ??
        currentProject?.municipioId ??
        activeProject?.mga_formulation_data?.municipio_id ??
        activeProject?.mga_formulation_data?.municipioId ??
        (activeProject?.mga_formulation_data?.identificacion as any)?.municipio_id ??
        (activeProject?.mga_formulation_data?.identificacion as any)?.municipioId ??
        (activeProject?.mga_formulation_data?.localizacion as any)?.municipio_id ??
        (activeProject?.mga_formulation_data?.localizacion as any)?.municipioId ??
        project.mga_formulation_data?.municipio_id ??
        project.mga_formulation_data?.municipioId ??
        (project.mga_formulation_data?.identificacion as any)?.municipio_id ??
        (project.mga_formulation_data?.identificacion as any)?.municipioId
      );

      const baseTipoAgrup = toNumOrNull(
        activeProject?.tipo_agrupacion_id ??
        activeProject?.tipoAgrupacionId ??
        project.tipo_agrupacion_id ??
        project.tipoAgrupacionId ??
        currentProject?.tipo_agrupacion_id ??
        currentProject?.tipoAgrupacionId ??
        activeProject?.mga_formulation_data?.tipo_agrupacion_id ??
        (activeProject?.mga_formulation_data?.identificacion as any)?.tipo_agrupacion_id ??
        project.mga_formulation_data?.tipo_agrupacion_id ??
        (project.mga_formulation_data?.identificacion as any)?.tipo_agrupacion_id
      );

      const baseAgrup = toNumOrNull(
        activeProject?.agrupacion_id ??
        activeProject?.agrupacionId ??
        project.agrupacion_id ??
        project.agrupacionId ??
        currentProject?.agrupacion_id ??
        currentProject?.agrupacionId ??
        activeProject?.mga_formulation_data?.agrupacion_id ??
        (activeProject?.mga_formulation_data?.identificacion as any)?.agrupacion_id ??
        project.mga_formulation_data?.agrupacion_id ??
        (project.mga_formulation_data?.identificacion as any)?.agrupacion_id
      );

      if (baseRegion !== null || baseDepto !== null || baseMun !== null) {
        initialRows = [
          {
            region_id: baseRegion,
            departamento_id: baseDepto,
            municipio_id: baseMun,
            tipo_agrupacion_id: baseTipoAgrup,
            agrupacion_id: baseAgrup,
          },
        ];
      }
    }

    // 3. Si sigue vacío, inyectar una fila vacía por defecto
    if (initialRows.length === 0) {
      if (rows.length === 0) {
        setRows([
          {
            region_id: null,
            departamento_id: null,
            municipio_id: null,
            tipo_agrupacion_id: null,
            agrupacion_id: null,
          },
        ]);
      }
      return;
    }

    setRows(initialRows);
  }, [
    formulation.localizaciones,
    formulation.localizacion,
    project.id,
    project.region_id,
    project.departamento_id,
    project.municipio_id,
    (project as any).regionId,
    (project as any).departamentoId,
    (project as any).municipioId,
    project.mga_formulation_data,
    project.localizaciones,
    currentProject?.id,
    currentProject?.region_id,
    currentProject?.departamento_id,
    currentProject?.municipio_id,
    (currentProject as any)?.regionId,
    (currentProject as any)?.departamentoId,
    (currentProject as any)?.municipioId,
    currentProject?.mga_formulation_data,
    currentProject?.localizaciones,
    activeProject?.id,
    activeProject?.region_id,
    activeProject?.departamento_id,
    activeProject?.municipio_id,
    (activeProject as any)?.regionId,
    (activeProject as any)?.departamentoId,
    (activeProject as any)?.municipioId,
    activeProject?.mga_formulation_data,
    activeProject?.localizaciones,
    rows.length,
  ]);

  // Sincronización reactiva de factores analizados si se cargan asíncronamente
  useEffect(() => {
    const saved =
      formulation.factores_analizados ||
      formulation.localizaciones_factores ||
      (formulation.localizacion as any)?.factores_analizados ||
      (project.mga_formulation_data as any)?.factores_analizados ||
      (activeProject?.mga_formulation_data as any)?.factores_analizados;
    if (Array.isArray(saved) && saved.length > 0 && factores.length === 0) {
      setFactores(saved);
    }
  }, [
    formulation.factores_analizados,
    formulation.localizaciones_factores,
    formulation.localizacion,
    project.mga_formulation_data,
    activeProject?.mga_formulation_data,
    factores.length,
  ]);

  // Manejadores de selección de factores analizados
  const toggleFactor = (factor: string) => {
    setFactores((prev) =>
      prev.includes(factor) ? prev.filter((f) => f !== factor) : [...prev, factor]
    );
  };

  const handleSelectAllFactores = () => {
    setFactores([...FACTORES_ANALIZADOS_MGA]);
  };

  const handleDeselectAllFactores = () => {
    setFactores([]);
  };

  // Sincronización o copia rápida desde la población objetivo
  const handleSyncFromPoblacionObjetivo = () => {
    const populations = formulation.populations || [];
    const popObjetivo = populations.find((p) => p.population_type === 'objetivo');

    if (!popObjetivo) {
      setMessage('No se ha registrado aún la población objetivo en la pestaña Población.');
      return;
    }

    const parsed = parsePopulationLocations(popObjetivo.locations);
    const munNames = (parsed.municipalities || []).map((m) => m.toLowerCase().trim());
    const deptoNames = (parsed.departments || []).map((d) => d.toLowerCase().trim());

    let matchedRow: LocalizacionRow | null = null;

    for (const reg of regions) {
      for (const dep of reg.departamentos || []) {
        const depMatches = deptoNames.includes(dep.name.toLowerCase().trim());
        for (const mun of dep.municipios || []) {
          const munMatches = munNames.includes(mun.name.toLowerCase().trim());
          if (munMatches || (depMatches && munNames.length === 0)) {
            matchedRow = {
              region_id: Number(reg.id),
              departamento_id: Number(dep.id),
              municipio_id: Number(mun.id),
              tipo_agrupacion_id: null,
              agrupacion_id: null,
            };
            break;
          }
        }
        if (matchedRow) break;
      }
      if (matchedRow) break;
    }

    if (matchedRow) {
      isUserEditedRef.current = true;
      setRows([matchedRow]);
      setMessage('Localización sincronizada desde la población objetivo.');
    } else if (parsed.localization || (parsed.municipalities && parsed.municipalities.length > 0)) {
      const detail = [parsed.localization, parsed.departments?.join(', '), parsed.municipalities?.join(', ')]
        .filter(Boolean)
        .join(' - ');
      setMessage(`Localización de población objetivo referenciada (${detail}). Seleccione los valores equivalentes en el catálogo.`);
    } else {
      setMessage('La población objetivo no cuenta con datos de localización estructurados.');
    }
  };

  // Manejadores para modificar cada fila con filtros en cascada
  const updateRow = (index: number, field: keyof LocalizacionRow, value: number | null) => {
    isUserEditedRef.current = true;
    setRows((prev) => {
      const next = [...prev];
      const currentRow = { ...next[index] };

      if (field === 'region_id') {
        currentRow.region_id = value;
        currentRow.departamento_id = null;
        currentRow.municipio_id = null;
        currentRow.agrupacion_id = null;
      } else if (field === 'departamento_id') {
        currentRow.departamento_id = value;
        currentRow.municipio_id = null;
        currentRow.agrupacion_id = null;
      } else if (field === 'municipio_id') {
        currentRow.municipio_id = value;
        currentRow.agrupacion_id = null;
      } else if (field === 'tipo_agrupacion_id') {
        currentRow.tipo_agrupacion_id = value;
        currentRow.agrupacion_id = null;
      } else {
        currentRow[field] = value;
      }

      next[index] = currentRow;
      return next;
    });
  };

  const addRow = () => {
    isUserEditedRef.current = true;
    setRows((prev) => [
      ...prev,
      {
        region_id: null,
        departamento_id: null,
        municipio_id: null,
        tipo_agrupacion_id: null,
        agrupacion_id: null,
      },
    ]);
  };

  const removeRow = (index: number) => {
    isUserEditedRef.current = true;
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setError(null);
    setMessage(null);

    // Validación básica de completitud
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.region_id || !r.departamento_id || !r.municipio_id) {
        setError(`Fila #${i + 1}: Debe seleccionar Región, Departamento y Municipio.`);
        return;
      }
      if (isEthnic && (!r.tipo_agrupacion_id || !r.agrupacion_id)) {
        setError(`Fila #${i + 1}: Por la tipología étnica del proyecto, debe seleccionar el Tipo de Agrupación y la Agrupación.`);
        return;
      }
    }

    try {
      const payload: ProjectMgaLocalizationItem[] = rows.map((r) => ({
        region_id: r.region_id,
        departamento_id: r.departamento_id,
        municipio_id: r.municipio_id,
        ...(isEthnic ? { tipo_agrupacion_id: r.tipo_agrupacion_id, agrupacion_id: r.agrupacion_id } : {}),
      }));

      await saveLocalizacion(project.id, {
        localizaciones: payload,
        factores_analizados: factores,
        localizaciones_factores: factores,
      });
      setMessage('Localizaciones y factores analizados guardados exitosamente.');
    } catch (err) {
      setError('Error al guardar las localizaciones. Por favor intente nuevamente.');
    }
  };

  return (
    <div className="space-y-6 bg-white p-6 border rounded-xl shadow-sm text-sm">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-4 gap-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-6 h-6 text-[#006162]" />
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Localización MGA</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Defina las áreas geográficas y territoriales de intervención del proyecto.
            </p>
          </div>
        </div>

        {/* Badge condicional de tipología */}
        {isEthnic ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-amber-600" />
            <span>Tipología Étnica: Requiere Agrupación Étnica</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-xs font-medium">
            <HelpCircle className="w-4 h-4 text-slate-400" />
            <span>Tipología Estándar Territorial</span>
          </div>
        )}
      </div>

      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}
      {message && <MgaAlert message={message} variant="success" onDismiss={() => setMessage(null)} />}

      {/* Sub-encabezado y botón de acceso rápido */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
        <div>
          <span className="font-semibold text-slate-800 text-xs uppercase tracking-wider block">
            01 - Georreferenciación y Ubicación Territorial
          </span>
          <span className="text-[11px] text-slate-500">
            Especifique las regiones, departamentos y municipios de cobertura del proyecto.
          </span>
        </div>
        <button
          type="button"
          onClick={handleSyncFromPoblacionObjetivo}
          className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors text-xs font-medium shadow-sm"
          title="Copiar o sincronizar localización desde la población objetivo"
        >
          <Users className="w-4 h-4 text-[#006162]" />
          <span>Utilizar localización de la población objetivo</span>
        </button>
      </div>

      {/* Listado de Localizaciones */}
      <div className="space-y-4">
        {rows.map((row, index) => {
          // Filtrado en cascada con normalización numérica
          const selectedRegion = regions.find((r) => Number(r.id) === Number(row.region_id));
          const deptosDisponibles = selectedRegion?.departamentos ?? [];

          const selectedDepto = deptosDisponibles.find((d) => Number(d.id) === Number(row.departamento_id));
          const municipiosDisponibles = selectedDepto?.municipios ?? [];

          // Filtrado estricto de agrupaciones étnicas:
          // Depende estrictamente del Municipio seleccionado y del Tipo de Agrupación
          const agrupacionesDisponibles = agrupaciones.filter(
            (a) =>
              Number(a.municipio_id) === Number(row.municipio_id) &&
              Number(a.tipo_agrupacion_id) === Number(row.tipo_agrupacion_id)
          );

          return (
            <div
              key={index}
              className="p-5 border border-slate-200 rounded-xl bg-slate-50/60 space-y-4 transition-all hover:border-slate-300"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-semibold text-slate-700 text-sm flex items-center gap-1.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#006162] text-white text-xs font-bold">
                    {index + 1}
                  </span>
                  Localización {index === 0 ? '(Principal / Base)' : `#${index + 1}`}
                </span>

                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1 text-xs font-medium"
                    title="Eliminar localización"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Eliminar</span>
                  </button>
                )}
              </div>

              {/* Grid de Selectores Geográficos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Región */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Región <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={row.region_id !== null && row.region_id !== undefined ? String(row.region_id) : ''}
                    onChange={(e) => updateRow(index, 'region_id', e.target.value ? Number(e.target.value) : null)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 text-xs focus:ring-2 focus:ring-[#006162] focus:border-transparent outline-none"
                    disabled={isLoadingLocations}
                  >
                    <option value="">Seleccione Región...</option>
                    {regions.map((reg: Region) => (
                      <option key={reg.id} value={String(reg.id)}>
                        {reg.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Departamento */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Departamento <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={row.departamento_id !== null && row.departamento_id !== undefined ? String(row.departamento_id) : ''}
                    onChange={(e) => updateRow(index, 'departamento_id', e.target.value ? Number(e.target.value) : null)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 text-xs focus:ring-2 focus:ring-[#006162] focus:border-transparent outline-none disabled:bg-slate-100 disabled:text-slate-400"
                    disabled={!row.region_id || deptosDisponibles.length === 0}
                  >
                    <option value="">
                      {!row.region_id ? 'Seleccione primero región...' : 'Seleccione Departamento...'}
                    </option>
                    {deptosDisponibles.map((dep: Departamento) => (
                      <option key={dep.id} value={String(dep.id)}>
                        {dep.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Municipio */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Municipio <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={row.municipio_id !== null && row.municipio_id !== undefined ? String(row.municipio_id) : ''}
                    onChange={(e) => updateRow(index, 'municipio_id', e.target.value ? Number(e.target.value) : null)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 text-xs focus:ring-2 focus:ring-[#006162] focus:border-transparent outline-none disabled:bg-slate-100 disabled:text-slate-400"
                    disabled={!row.departamento_id || municipiosDisponibles.length === 0}
                  >
                    <option value="">
                      {!row.departamento_id ? 'Seleccione primero departamento...' : 'Seleccione Municipio...'}
                    </option>
                    {municipiosDisponibles.map((mun: Municipio) => (
                      <option key={mun.id} value={String(mun.id)}>
                        {mun.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Lógica Condicional Étnica */}
              {isEthnic && (
                <div className="pt-3 border-t border-slate-200 mt-2">
                  <div className="mb-2 text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                    <span>Caracterización Étnica Territorial (SUIFP / PIIP)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Tipo de Agrupación */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Tipo de Agrupación <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={row.tipo_agrupacion_id !== null && row.tipo_agrupacion_id !== undefined ? String(row.tipo_agrupacion_id) : ''}
                        onChange={(e) =>
                          updateRow(index, 'tipo_agrupacion_id', e.target.value ? Number(e.target.value) : null)
                        }
                        className="w-full p-2.5 border border-amber-300 rounded-lg bg-white text-slate-800 text-xs focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                      >
                        <option value="">Seleccione Tipo de Agrupación...</option>
                        {tiposAgrupacion.map((t: TipoAgrupacion) => (
                          <option key={t.id} value={String(t.id)}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Agrupación (filtrada por municipio_id y tipo_agrupacion_id) */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Agrupación Étnica <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={row.agrupacion_id !== null && row.agrupacion_id !== undefined ? String(row.agrupacion_id) : ''}
                        onChange={(e) =>
                          updateRow(index, 'agrupacion_id', e.target.value ? Number(e.target.value) : null)
                        }
                        className="w-full p-2.5 border border-amber-300 rounded-lg bg-white text-slate-800 text-xs focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none disabled:bg-slate-100 disabled:text-slate-400"
                        disabled={!row.municipio_id || !row.tipo_agrupacion_id}
                      >
                        <option value="">
                          {!row.municipio_id || !row.tipo_agrupacion_id
                            ? 'Seleccione primero municipio y tipo de agrupación...'
                            : agrupacionesDisponibles.length === 0
                            ? 'Sin agrupaciones registradas para este municipio y tipo'
                            : 'Seleccione Agrupación...'}
                        </option>
                        {agrupacionesDisponibles.map((a: Agrupacion) => (
                          <option key={a.id} value={String(a.id)}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Botón para agregar otra localización */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-[#006162] text-[#006162] rounded-lg hover:bg-teal-50 transition-colors text-xs font-medium"
        >
          <Plus className="w-4 h-4" />
          <span>Agregar otra localización</span>
        </button>
      </div>

      {/* Sección 02 - Factores analizados */}
      <div className="mt-8 pt-6 border-t border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-[#006162]" />
            <div>
              <h2 className="text-base font-semibold text-slate-800">02 - Factores analizados</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Indique los criterios y factores que justifican la selección de la localización según la metodología MGA.
              </p>
            </div>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            {`${factores.length} de ${FACTORES_ANALIZADOS_MGA.length} seleccionados`}
          </div>
        </div>

        <div className="p-4 bg-slate-50/60 border border-slate-200 rounded-xl space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FACTORES_ANALIZADOS_MGA.map((factor) => {
              const isChecked = factores.includes(factor);
              return (
                <label
                  key={factor}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer text-xs select-none ${
                    isChecked
                      ? 'bg-teal-50/70 border-[#006162]/40 text-slate-800 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleFactor(factor)}
                    className="mt-0.5 rounded border-slate-300 text-[#006162] focus:ring-[#006162] w-4 h-4 cursor-pointer"
                  />
                  <span className="font-medium leading-relaxed">{factor}</span>
                </label>
              );
            })}
          </div>

          {/* Botones de Acción Global */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={handleSelectAllFactores}
              className="px-3 py-1.5 text-xs font-medium text-[#006162] hover:bg-teal-50 border border-[#006162]/30 rounded-lg transition-colors"
            >
              Seleccionar todo
            </button>
            <button
              type="button"
              onClick={handleDeselectAllFactores}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
            >
              Deseleccionar todo
            </button>
          </div>
        </div>
      </div>

      {/* Botón Guardar */}
      <div className="mt-8 pt-4 border-t border-slate-200 flex justify-end">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="px-6 py-2.5 bg-[#006162] text-white font-medium rounded-lg hover:bg-teal-800 flex items-center gap-2 transition-colors disabled:opacity-50 text-sm shadow-sm"
        >
          {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
          Guardar Localización
        </button>
      </div>
    </div>
  );
}
