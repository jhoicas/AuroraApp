import { useState, useEffect, useRef, useCallback } from 'react';
import { HelpCircle, Plus, Trash2, MapPin } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore, debouncedPatchProject, type PoblacionJson, type PoblacionDetalleJson, type UbicacionJson } from '../../../store/projectMgaStore';
import MgaAccordion from './MgaAccordion';
import MgaAlert from './MgaAlert';
import MgaActionButtons from './MgaActionButtons';
import { CountedTextarea } from '../../ui/CountedTextarea';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';
import BaseLocationFields from './BaseLocationFields';
import { useProjectBaseLocation, type ProjectBaseLocationInfo } from '../../../lib/useProjectBaseLocation';
import {
  fetchMgaRegions,
  fetchMgaDepartments,
  fetchMgaMunicipalities,
  fetchMgaGroupings,
  type MgaRegion,
  type MgaDepartment,
  type MgaMunicipality,
  type MgaGrouping,
} from '../../../lib/mgaApi';

const EMPTY_POBLACION_DETALLE: PoblacionDetalleJson = {
  tipoPoblacion: 'Personas',
  numero: 0,
  fuenteInformacion: '',
  localizaciones: [],
};

type PoblacionTabProps = {
  project: Project;
};

export default function PoblacionTab({ project }: PoblacionTabProps) {
  const [error, setError] = useState<string | null>(null);
  // Regla de localización estricta: solo el departamento base del proyecto.
  const baseInfo = useProjectBaseLocation(project);

  const [openSections, setOpenSections] = useState({
    afectada: true,
    objetivo: true,
  });

  const [poblacion, setPoblacion] = useState<PoblacionJson>({
    afectada: { ...EMPTY_POBLACION_DETALLE },
    objetivo: { ...EMPTY_POBLACION_DETALLE },
  });

  const prevProjectIdRef = useRef(project.id);
  const isFirstMount = useRef(true);
  const lastSavedRef = useRef<string>('');

  const storePoblacion = useProjectMgaStore((s) => s.getFormulation(project.id)?.identificacion?.poblacion);

  useEffect(() => {
    if (storePoblacion) {
      const dataToCompare = {
        afectada: storePoblacion.afectada || { ...EMPTY_POBLACION_DETALLE },
        objetivo: storePoblacion.objetivo || { ...EMPTY_POBLACION_DETALLE }
      };
      const serialized = JSON.stringify(dataToCompare);
      if (serialized !== lastSavedRef.current) {
        setPoblacion(dataToCompare);
        lastSavedRef.current = serialized;
      }
    }
  }, [storePoblacion]);

  useEffect(() => {
    if (prevProjectIdRef.current !== project.id) {
      prevProjectIdRef.current = project.id;
      isFirstMount.current = true;
    }
  }, [project.id]);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    const serialized = JSON.stringify(poblacion);
    if (serialized === lastSavedRef.current) return;
    lastSavedRef.current = serialized;

    const curData = useProjectMgaStore.getState().getFormulation(project.id)?.identificacion;
    
    useProjectMgaStore.setState((state) => ({
      byProjectId: {
        ...state.byProjectId,
        [project.id]: {
          ...(state.byProjectId[project.id] ?? {}),
          identificacion: {
            ...curData,
            poblacion,
          }
        }
      }
    }));

    debouncedPatchProject(project.id, {
      identificacion: {
        ...curData,
        poblacion,
      }
    });
  }, [poblacion, project.id]);

  const copyAfectadaToObjetivo = () => {
    setPoblacion((prev) => ({
      ...prev,
      objetivo: {
        ...prev.afectada,
        localizaciones: [...prev.afectada.localizaciones],
      },
    }));
  };

  const renderSection = (
    key: 'afectada' | 'objetivo',
    title: string,
    numberStr: string
  ) => {
    const data = poblacion[key];
    const updateData = (patch: Partial<PoblacionDetalleJson>) => {
      setPoblacion((prev) => ({
        ...prev,
        [key]: { ...prev[key], ...patch },
      }));
    };

    return (
      <MgaAccordion 
        title={title} 
        number={numberStr} 
        open={openSections[key]} 
        onToggle={() => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))}
      >
        <div className="space-y-6 p-1">
          {key === 'objetivo' && (
            <div className="flex justify-end">
              <button
                onClick={copyAfectadaToObjetivo}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 flex items-center gap-2 transition-colors text-sm"
              >
                <MapPin className="w-4 h-4" />
                Utilizar población afectada
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Tipo de población *</label>
              <select
                value={data.tipoPoblacion}
                onChange={(e) => updateData({ tipoPoblacion: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#006162] outline-none text-sm bg-white"
              >
                <option value="Personas">Personas</option>
                <option value="Familias">Familias</option>
                <option value="Empresas">Empresas</option>
                <option value="Hectáreas">Hectáreas</option>
                <option value="Instituciones">Instituciones</option>
                <option value="Municipios">Municipios</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Número *</label>
              <input
                type="number"
                min="0"
                value={data.numero}
                onChange={(e) => updateData({ numero: parseInt(e.target.value) || 0 })}
                className="w-full p-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#006162] outline-none text-sm"
              />
            </div>
            <div>
              <AIAssistedField label="Fuente de la información" htmlFor={`poblacion-fuente-${key}`} required fieldHelpKey={`poblacion_${key}_fuente`} projectContext={{ projectName: project.name, sector: project.sector }} reactiveContext={{ tipoPoblacion: data.tipoPoblacion }} onAutoFill={(value) => updateData({ fuenteInformacion: value })} guidance="Indique la fuente oficial utilizada para caracterizar la población." askPrompt="Ayúdame a redactar la fuente de información demográfica de una población MGA.">
                <CountedTextarea id={`poblacion-fuente-${key}`} spellCheck maxLength={500} rows={3} value={data.fuenteInformacion} onChange={(e) => updateData({ fuenteInformacion: e.target.value.substring(0, 500) })} className="w-full resize-y rounded border-slate-300 p-2.5 text-sm outline-none focus:ring-1 focus:ring-[#006162]" />
              </AIAssistedField>
            </div>
          </div>
          
          <LocalizacionSubSection
            idPrefix={`poblacion-${key}`}
            baseInfo={baseInfo}
            localizaciones={data.localizaciones}
            onChange={(locs) => updateData({ localizaciones: locs })}
          />
        </div>
      </MgaAccordion>
    );
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-12">
      <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">Población</h1>
        <HelpCircle className="h-5 w-5 text-[#3498db]" aria-hidden />
      </div>

      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}

      <div className="space-y-4 mt-6">
        {renderSection('afectada', 'Población afectada por el problema', '01')}
        {renderSection('objetivo', 'Población objetivo de la intervención', '02')}
      </div>
      
      <div className="mt-8">
        <MgaActionButtons project={project} onSave={async () => {
          await useProjectMgaStore.getState().savePoblacion(project.id);
        }} />
      </div>
    </div>
  );
}

// ─── Cascading Dropdown Form State ─────────────────────────────────────
type CascadeFormState = {
  regionId: number | null;
  departamentoId: number | null;
  municipioId: number | null;
  tipoAgrupacionId: number | null;
  agrupacionId: number | null;
  especifica: string;
};

const EMPTY_FORM: CascadeFormState = {
  regionId: null,
  departamentoId: null,
  municipioId: null,
  tipoAgrupacionId: null,
  agrupacionId: null,
  especifica: '',
};

// ─── Localization Sub-Section with API Cascading Dropdowns ──────────────
function LocalizacionSubSection({
  idPrefix,
  baseInfo,
  localizaciones,
  onChange,
}: {
  idPrefix: string;
  baseInfo: ProjectBaseLocationInfo;
  localizaciones: UbicacionJson[];
  onChange: (l: UbicacionJson[]) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawForm, setForm] = useState<CascadeFormState>({ ...EMPTY_FORM });

  const [regions, setRegions] = useState<MgaRegion[]>([]);
  const [departments, setDepartments] = useState<MgaDepartment[]>([]);
  const [municipalities, setMunicipalities] = useState<MgaMunicipality[]>([]);
  const [groupings, setGroupings] = useState<MgaGrouping[]>([]);

  // Con departamento base, Región y Departamento quedan fijos (solo lectura) y no se pueden cambiar.
  const { base } = baseInfo;
  const form: CascadeFormState = base
    ? { ...rawForm, regionId: base.regionId, departamentoId: base.departamentoId }
    : rawForm;

  useEffect(() => {
    fetchMgaRegions().then(setRegions).catch(console.error);
  }, []);

  useEffect(() => {
    if (form.regionId) {
      fetchMgaDepartments(form.regionId).then(setDepartments).catch(console.error);
    } else {
      setDepartments([]);
    }
  }, [form.regionId]);

  useEffect(() => {
    if (form.departamentoId) {
      fetchMgaMunicipalities(form.departamentoId).then(setMunicipalities).catch(console.error);
    } else {
      setMunicipalities([]);
    }
  }, [form.departamentoId]);

  useEffect(() => {
    if (form.municipioId) {
      fetchMgaGroupings(form.municipioId).then(setGroupings).catch(console.error);
    } else {
      setGroupings([]);
    }
  }, [form.municipioId]);

  const groupingTypesMap = new Map<number, { id: number; name: string }>();
  groupings.forEach((g) => {
    groupingTypesMap.set(g.tipo_agrupacion_id, { id: g.tipo_agrupacion_id, name: g.tipo_agrupacion });
  });
  const groupingTypes = Array.from(groupingTypesMap.values());
  const filteredGroupings = form.tipoAgrupacionId 
    ? groupings.filter(g => g.tipo_agrupacion_id === form.tipoAgrupacionId) 
    : [];
  
  const hasGroupingTypes = groupingTypes.length > 0;

  // ─── Cascade onChange handlers ─────────────────────────────────────
  const handleRegionChange = useCallback((value: string) => {
    const regionId = value ? Number(value) : null;
    setForm({
      regionId,
      departamentoId: null,
      municipioId: null,
      tipoAgrupacionId: null,
      agrupacionId: null,
      especifica: form.especifica,
    });
  }, [form.especifica]);

  const handleDepartamentoChange = useCallback((value: string) => {
    const departamentoId = value ? Number(value) : null;
    setForm((prev) => ({
      ...prev,
      departamentoId,
      municipioId: null,
      tipoAgrupacionId: null,
      agrupacionId: null,
    }));
  }, []);

  const handleMunicipioChange = useCallback((value: string) => {
    const municipioId = value ? Number(value) : null;
    setForm((prev) => ({
      ...prev,
      municipioId,
      tipoAgrupacionId: null,
      agrupacionId: null,
    }));
  }, []);

  const handleTipoAgrupacionChange = useCallback((value: string) => {
    const tipoAgrupacionId = value ? Number(value) : null;
    setForm((prev) => ({
      ...prev,
      tipoAgrupacionId,
      agrupacionId: null,
    }));
  }, []);

  const handleAgrupacionChange = useCallback((value: string) => {
    const agrupacionId = value ? Number(value) : null;
    setForm((prev) => ({
      ...prev,
      agrupacionId,
    }));
  }, []);

  // ─── Resolve display names from IDs ────────────────────────────────
  const resolveNames = (state: CascadeFormState) => {
    const region = regions.find((r) => r.id === state.regionId);
    const department = departments.find((d) => d.id === state.departamentoId);
    const municipality = municipalities.find((m) => m.id === state.municipioId);
    const groupingType = groupingTypes.find((gt) => gt.id === state.tipoAgrupacionId);
    const grouping = groupings.find((g) => g.id === state.agrupacionId);

    return {
      regionNombre: region?.name ?? baseInfo.regionName ?? '',
      departamentoNombre: department?.name ?? baseInfo.departamentoName ?? '',
      municipioNombre: municipality?.name ?? '',
      tipoAgrupacionNombre: groupingType?.name ?? '',
      agrupacionNombre: grouping?.name ?? '',
    };
  };

  // ─── Submit (Adicionar) ────────────────────────────────────────────
  const handleAddSubmit = () => {
    if (base) {
      if (!form.municipioId) {
        setError('Seleccione un Municipio del departamento base del proyecto.');
        return;
      }
    } else if (!form.regionId || !form.departamentoId || !form.municipioId) {
      setError('Región, Departamento y Municipio son obligatorios.');
      return;
    }

    const names = resolveNames(form);

    const newUbicacion: UbicacionJson = {
      id: crypto.randomUUID(),
      region: names.regionNombre,
      departamento: names.departamentoNombre,
      municipio: names.municipioNombre,
      tipoAgrupacion: names.tipoAgrupacionNombre || '',
      agrupacion: names.agrupacionNombre || '',
      especifica: form.especifica || '',
      latitud: '',
      longitud: '',
      georeferenciada: false,
      // Persist numeric IDs for potential re-editing
      regionId: form.regionId ?? undefined,
      departamentoId: form.departamentoId ?? undefined,
      municipioId: form.municipioId ?? undefined,
      tipoAgrupacionId: form.tipoAgrupacionId ?? undefined,
      agrupacionId: form.agrupacionId ?? undefined,
    };

    onChange([...localizaciones, newUbicacion]);
    // Reset form for next entry
    setForm({ ...EMPTY_FORM });
    setIsAdding(false);
    setError(null);
  };

  // ─── Delete row ────────────────────────────────────────────────────
  const handleDelete = (id: string) => {
    onChange(localizaciones.filter((u) => u.id !== id));
  };

  // ─── Shared select styles ─────────────────────────────────────────
  const selectClass = 'w-full p-2 border rounded focus:ring-1 focus:ring-[#006162] outline-none text-sm bg-white';
  const selectDisabledClass = `${selectClass} bg-slate-100 text-slate-400 cursor-not-allowed`;
  const labelClass = 'block text-xs font-semibold text-slate-700 mb-1';

  return (
    <div className="space-y-4 mt-6 border-t pt-4">
      <h4 className="text-sm font-semibold text-slate-700">Localización</h4>
      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}
      
      {!isAdding ? (
        <div className="space-y-4">
          {/* ─── Results Table ─────────────────────────────────────── */}
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b text-slate-600">
                  <th className="p-2 font-medium">Región</th>
                  <th className="p-2 font-medium">Departamento</th>
                  <th className="p-2 font-medium">Municipio</th>
                  <th className="p-2 font-medium">Tipo Agrupación</th>
                  <th className="p-2 font-medium">Agrupación</th>
                  <th className="p-2 font-medium">Específica</th>
                  <th className="p-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {localizaciones.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-slate-500">
                      No hay localizaciones registradas.
                    </td>
                  </tr>
                ) : (
                  localizaciones.map((ub) => (
                    <tr key={ub.id} className="border-b hover:bg-slate-50">
                      <td className="p-2">{ub.region || '-'}</td>
                      <td className="p-2">{ub.departamento}</td>
                      <td className="p-2">{ub.municipio}</td>
                      <td className="p-2">{ub.tipoAgrupacion || '-'}</td>
                      <td className="p-2">{ub.agrupacion || '-'}</td>
                      <td className="p-2 truncate max-w-[150px]" title={ub.especifica}>{ub.especifica || '-'}</td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => handleDelete(ub.id)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <button
            onClick={() => setIsAdding(true)}
            className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 border border-slate-300 rounded hover:bg-slate-200 flex items-center gap-1.5 transition-colors font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar Ubicación
          </button>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
          <h5 className="font-medium text-slate-700 text-sm">Agregar Localización</h5>
          
          {/* ─── Row 1: Región, Departamento, Municipio ───────────── */}
          {base ? (
            <BaseLocationFields
              idPrefix={idPrefix}
              base={base}
              regionName={regions.find((r) => r.id === base.regionId)?.name ?? baseInfo.regionName}
              departamentoName={departments.find((d) => d.id === base.departamentoId)?.name ?? baseInfo.departamentoName}
              municipioOptions={municipalities.map((m) => ({ id: m.id, label: m.name }))}
              municipioId={form.municipioId}
              onMunicipioChange={(id) => handleMunicipioChange(id === null ? '' : String(id))}
              labels={{ region: 'Región *', departamento: 'Departamento *', municipio: 'Municipio *' }}
              selectClassName={selectClass}
              labelClassName={labelClass}
            />
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Región */}
            <AIAssistedField
              label="Región"
              htmlFor="poblacion-region"
              required
              compact
              fieldHelpKey="poblacion_region"
              onAutoFill={handleRegionChange}
              guidance="Seleccione la región del país donde se localiza la población."
              askPrompt="Ayúdame a elegir la región de localización de una población MGA."
            >
              <select
                id="poblacion-region"
                value={form.regionId !== null ? String(form.regionId) : ''}
                onChange={(e) => handleRegionChange(e.target.value)}
                className={selectClass}
              >
                <option value="">Seleccione Región...</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </AIAssistedField>

            {/* Departamento */}
            <AIAssistedField
              label="Departamento"
              htmlFor="poblacion-departamento"
              required
              compact
              fieldHelpKey="poblacion_departamento"
              reactiveContext={{ regionId: form.regionId }}
              onAutoFill={handleDepartamentoChange}
              guidance="Seleccione el departamento de la región elegida donde se localiza la población."
              askPrompt="Ayúdame a elegir el departamento de localización de una población MGA."
            >
              <select
                id="poblacion-departamento"
                value={form.departamentoId !== null ? String(form.departamentoId) : ''}
                onChange={(e) => handleDepartamentoChange(e.target.value)}
                disabled={!form.regionId}
                className={form.regionId ? selectClass : selectDisabledClass}
              >
                <option value="">
                  {form.regionId ? 'Seleccione Departamento...' : 'Primero seleccione Región...'}
                </option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </AIAssistedField>

            {/* Municipio */}
            <div>
              <label className={labelClass}>Municipio *</label>
              <select
                value={form.municipioId !== null ? String(form.municipioId) : ''}
                onChange={(e) => handleMunicipioChange(e.target.value)}
                disabled={!form.departamentoId}
                className={form.departamentoId ? selectClass : selectDisabledClass}
              >
                <option value="">
                  {form.departamentoId ? 'Seleccione Municipio...' : 'Primero seleccione Departamento...'}
                </option>
                {municipalities.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
          )}

          {/* ─── Row 2: Tipo Agrupación, Agrupación ───────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Tipo de Agrupación */}
            <div>
              <label className={labelClass}>
                Tipo de Agrupación
                {!hasGroupingTypes && form.municipioId && (
                  <span className="ml-1 text-[10px] text-slate-400 font-normal">(No aplica para este municipio)</span>
                )}
              </label>
              <select
                value={form.tipoAgrupacionId !== null ? String(form.tipoAgrupacionId) : ''}
                onChange={(e) => handleTipoAgrupacionChange(e.target.value)}
                disabled={!form.municipioId || !hasGroupingTypes}
                className={form.municipioId && hasGroupingTypes ? selectClass : selectDisabledClass}
              >
                <option value="">
                  {!form.municipioId
                    ? 'Primero seleccione Municipio...'
                    : !hasGroupingTypes
                      ? 'No disponible para este municipio'
                      : 'Seleccione Tipo de Agrupación...'}
                </option>
                {groupingTypes.map((gt) => (
                  <option key={gt.id} value={gt.id}>{gt.name}</option>
                ))}
              </select>
            </div>

            {/* Agrupación */}
            <div>
              <label className={labelClass}>
                Agrupación
                {!hasGroupingTypes && form.municipioId && (
                  <span className="ml-1 text-[10px] text-slate-400 font-normal">(No aplica)</span>
                )}
              </label>
              <select
                value={form.agrupacionId !== null ? String(form.agrupacionId) : ''}
                onChange={(e) => handleAgrupacionChange(e.target.value)}
                disabled={!form.tipoAgrupacionId || !hasGroupingTypes}
                className={form.tipoAgrupacionId && hasGroupingTypes ? selectClass : selectDisabledClass}
              >
                <option value="">
                  {!form.tipoAgrupacionId
                    ? 'Primero seleccione Tipo de Agrupación...'
                    : groupings.length === 0
                      ? 'Sin agrupaciones para este tipo'
                      : 'Seleccione Agrupación...'}
                </option>
                {filteredGroupings.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ─── Row 3: Localización Específica ────────────────────── */}
          <div>
            <AIAssistedField label="Localización Específica" htmlFor="poblacion-localizacion-especifica" fieldHelpKey="poblacion_localizacion_especifica" reactiveContext={{ municipio: form.municipioId, localizacion: form.especifica }} onAutoFill={(value) => setForm((prev) => ({ ...prev, especifica: value }))} guidance="Precise el lugar o referencia territorial asociada a esta población." askPrompt="Ayúdame a describir una localización específica de población para un proyecto MGA.">
              <CountedTextarea id="poblacion-localizacion-especifica" value={form.especifica} onChange={(e) => setForm((prev) => ({ ...prev, especifica: e.target.value }))} rows={2} maxLength={500} placeholder="Descripción libre de la localización específica..." className="w-full rounded border p-2 text-sm outline-none focus:ring-1 focus:ring-[#006162]" />
            </AIAssistedField>
          </div>

          {/* ─── Action Buttons ────────────────────────────────────── */}
          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-200">
            <button
              onClick={() => {
                setIsAdding(false);
                setForm({ ...EMPTY_FORM });
                setError(null);
              }}
              className="px-3 py-1.5 border text-slate-600 rounded hover:bg-slate-100 transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleAddSubmit}
              className="px-3 py-1.5 bg-[#006162] text-white rounded hover:bg-[#004d4e] transition-colors text-sm flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
