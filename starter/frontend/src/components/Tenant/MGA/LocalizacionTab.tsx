import { useState, useEffect, useMemo } from 'react';
import { HelpCircle, Plus, Trash2, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore, type ProjectMgaLocalizationItem } from '../../../store/projectMgaStore';
import { useLocationStore, type Region, type Departamento, type Municipio, type TipoAgrupacion, type Agrupacion } from '../../../store/locationStore';
import MgaAlert from './MgaAlert';

interface LocalizacionRow {
  region_id: number | null;
  departamento_id: number | null;
  municipio_id: number | null;
  tipo_agrupacion_id: number | null;
  agrupacion_id: number | null;
}

export default function LocalizacionTab({ project }: { project: Project }) {
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
  const [initialized, setInitialized] = useState(false);

  // Tipología del proyecto para lógica étnica condicional
  const tipologia = project.mga_formulation_data?.tipologia || (formulation as any)?.tipologia || '';
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

  // Inicialización y sincronización con datos base del proyecto
  useEffect(() => {
    if (initialized) return;

    let initialRows: LocalizacionRow[] = [];

    // 1. Verificar si ya existen localizaciones guardadas en la formulación
    const existing = formulation.localizaciones || (formulation.localizacion?.localizaciones as any[]);
    if (existing && Array.isArray(existing) && existing.length > 0) {
      initialRows = existing.map((loc: any) => ({
        region_id: loc.region_id ?? loc.regionId ?? null,
        departamento_id: loc.departamento_id ?? loc.departamentoId ?? null,
        municipio_id: loc.municipio_id ?? loc.municipioId ?? null,
        tipo_agrupacion_id: loc.tipo_agrupacion_id ?? loc.tipoAgrupacionId ?? null,
        agrupacion_id: loc.agrupacion_id ?? loc.agrupacionId ?? null,
      }));
    } else {
      // 2. Si no hay localizaciones, verificar si hay localizaciones base en project.mga_formulation_data
      const projectLocs = project.mga_formulation_data?.localizaciones as any[];
      if (projectLocs && Array.isArray(projectLocs) && projectLocs.length > 0) {
        initialRows = projectLocs.map((loc: any) => ({
          region_id: loc.region_id ?? loc.regionId ?? null,
          departamento_id: loc.departamento_id ?? loc.departamentoId ?? null,
          municipio_id: loc.municipio_id ?? loc.municipioId ?? null,
          tipo_agrupacion_id: loc.tipo_agrupacion_id ?? loc.tipoAgrupacionId ?? null,
          agrupacion_id: loc.agrupacion_id ?? loc.agrupacionId ?? null,
        }));
      }
    }

    // 3. Si sigue vacío, inyectar un primer registro vacío por defecto
    if (initialRows.length === 0) {
      initialRows = [
        {
          region_id: null,
          departamento_id: null,
          municipio_id: null,
          tipo_agrupacion_id: null,
          agrupacion_id: null,
        },
      ];
    }

    setRows(initialRows);
    setInitialized(true);
  }, [formulation.localizaciones, formulation.localizacion, project.mga_formulation_data, initialized]);

  // Manejadores para modificar cada fila con filtros en cascada
  const updateRow = (index: number, field: keyof LocalizacionRow, value: number | null) => {
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

      await saveLocalizacion(project.id, { localizaciones: payload });
      setMessage('Localizaciones guardadas exitosamente.');
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

      {/* Listado de Localizaciones */}
      <div className="space-y-4">
        {rows.map((row, index) => {
          // Filtrado en cascada
          const selectedRegion = regions.find((r) => r.id === row.region_id);
          const deptosDisponibles = selectedRegion?.departamentos ?? [];

          const selectedDepto = deptosDisponibles.find((d) => d.id === row.departamento_id);
          const municipiosDisponibles = selectedDepto?.municipios ?? [];

          // Filtrado estricto de agrupaciones étnicas:
          // Depende estrictamente del Municipio seleccionado y del Tipo de Agrupación
          const agrupacionesDisponibles = agrupaciones.filter(
            (a) => a.municipio_id === row.municipio_id && a.tipo_agrupacion_id === row.tipo_agrupacion_id
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
                    value={row.region_id ?? ''}
                    onChange={(e) => updateRow(index, 'region_id', e.target.value ? Number(e.target.value) : null)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 text-xs focus:ring-2 focus:ring-[#006162] focus:border-transparent outline-none"
                    disabled={isLoadingLocations}
                  >
                    <option value="">Seleccione Región...</option>
                    {regions.map((reg: Region) => (
                      <option key={reg.id} value={reg.id}>
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
                    value={row.departamento_id ?? ''}
                    onChange={(e) => updateRow(index, 'departamento_id', e.target.value ? Number(e.target.value) : null)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 text-xs focus:ring-2 focus:ring-[#006162] focus:border-transparent outline-none disabled:bg-slate-100 disabled:text-slate-400"
                    disabled={!row.region_id || deptosDisponibles.length === 0}
                  >
                    <option value="">
                      {!row.region_id ? 'Seleccione primero región...' : 'Seleccione Departamento...'}
                    </option>
                    {deptosDisponibles.map((dep: Departamento) => (
                      <option key={dep.id} value={dep.id}>
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
                    value={row.municipio_id ?? ''}
                    onChange={(e) => updateRow(index, 'municipio_id', e.target.value ? Number(e.target.value) : null)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 text-xs focus:ring-2 focus:ring-[#006162] focus:border-transparent outline-none disabled:bg-slate-100 disabled:text-slate-400"
                    disabled={!row.departamento_id || municipiosDisponibles.length === 0}
                  >
                    <option value="">
                      {!row.departamento_id ? 'Seleccione primero departamento...' : 'Seleccione Municipio...'}
                    </option>
                    {municipiosDisponibles.map((mun: Municipio) => (
                      <option key={mun.id} value={mun.id}>
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
                        value={row.tipo_agrupacion_id ?? ''}
                        onChange={(e) =>
                          updateRow(index, 'tipo_agrupacion_id', e.target.value ? Number(e.target.value) : null)
                        }
                        className="w-full p-2.5 border border-amber-300 rounded-lg bg-white text-slate-800 text-xs focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                      >
                        <option value="">Seleccione Tipo de Agrupación...</option>
                        {tiposAgrupacion.map((t: TipoAgrupacion) => (
                          <option key={t.id} value={t.id}>
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
                        value={row.agrupacion_id ?? ''}
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
                          <option key={a.id} value={a.id}>
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
