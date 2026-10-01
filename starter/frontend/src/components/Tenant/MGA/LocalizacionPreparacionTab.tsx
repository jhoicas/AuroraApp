import { useState, useEffect, useRef } from 'react';
import { HelpCircle, Plus, Trash2, MapPin, AlertTriangle } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore, type UbicacionJson } from '../../../store/projectMgaStore';
import { useCatalogStore } from '../../../store/catalogStore';
import MgaAlert from './MgaAlert';
import MgaAccordion from './MgaAccordion';
import MgaActionButtons from './MgaActionButtons';
import { CountedTextarea } from '../../ui/CountedTextarea';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';

const FACTORES_ANALIZADOS_MGA = [
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

type LocalizacionPreparacionTabProps = {
  project: Project;
};

export default function LocalizacionPreparacionTab({ project }: LocalizacionPreparacionTabProps) {
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));
  const saveLocalizacionPreparacion = useProjectMgaStore((s) => s.saveLocalizacionPreparacion);
  const alternativasAll = formulation.identificacion?.alternativas || [];
  const alternatives = alternativasAll.filter((a: any) => a.pasaPreparacion === true);

  const { departments, municipalitiesByDept, fetchDepartments, fetchMunicipalities } = useCatalogStore();

  const [selectedAlternativeId, setSelectedAlternativeId] = useState<string>('');
  const [ubicaciones, setUbicaciones] = useState<UbicacionJson[]>([]);
  const [factoresAnalizados, setFactoresAnalizados] = useState<string[]>([]);
  
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prevProjectIdRef = useRef(project.id);
  const isFirstMount = useRef(true);
  
  // Track currently selected alt to avoid infinite save loops
  const lastSavedRef = useRef<string>(''); 
  
  // Form state
  const [formData, setFormData] = useState<Partial<UbicacionJson>>({ georeferenciada: false });

  // Load DIVIPOLA departments
  useEffect(() => {
    void fetchDepartments();
  }, [fetchDepartments]);

  // Handle project change
  useEffect(() => {
    if (prevProjectIdRef.current !== project.id) {
      prevProjectIdRef.current = project.id;
      isFirstMount.current = true;
    }

    const currentFormulation = useProjectMgaStore.getState().getFormulation(project.id);
    const altsAll = currentFormulation.identificacion?.alternativas || [];
    const alts = altsAll.filter((a: any) => a.pasaPreparacion === true);
    
    if (alts.length > 0) {
      const altIdToSelect = selectedAlternativeId && alts.some((a: any) => a.id === selectedAlternativeId) 
        ? selectedAlternativeId 
        : alts[0].id;
        
      setSelectedAlternativeId(altIdToSelect);
      const data = currentFormulation.localizacionPreparacion?.[altIdToSelect];
      const initialUbis = data?.ubicaciones || [];
      const initialFact = data?.factoresAnalizados || [];
      
      setUbicaciones(initialUbis);
      setFactoresAnalizados(initialFact);
      
      lastSavedRef.current = JSON.stringify({ ubicaciones: initialUbis, factoresAnalizados: initialFact });
    } else {
      setSelectedAlternativeId('');
      setUbicaciones([]);
      setFactoresAnalizados([]);
      lastSavedRef.current = '';
    }
  }, [project.id]);

  // Handle alternative change
  const handleAlternativeChange = (newAltId: string) => {
    setSelectedAlternativeId(newAltId);
    const currentFormulation = useProjectMgaStore.getState().getFormulation(project.id);
    const data = currentFormulation.localizacionPreparacion?.[newAltId];
    
    const newUbis = data?.ubicaciones || [];
    const newFact = data?.factoresAnalizados || [];
    
    setUbicaciones(newUbis);
    setFactoresAnalizados(newFact);
    setIsAdding(false);
    
    lastSavedRef.current = JSON.stringify({ ubicaciones: newUbis, factoresAnalizados: newFact });
    isFirstMount.current = true;
  };

  const storeLocalizacion = useProjectMgaStore((s) => s.getFormulation(project.id)?.localizacionPreparacion);

  useEffect(() => {
    if (storeLocalizacion && selectedAlternativeId) {
      const data = storeLocalizacion[selectedAlternativeId];
      const dataToCompare = {
        ubicaciones: data?.ubicaciones || [],
        factoresAnalizados: data?.factoresAnalizados || []
      };
      const serialized = JSON.stringify(dataToCompare);
      if (serialized !== lastSavedRef.current) {
        setUbicaciones(dataToCompare.ubicaciones);
        setFactoresAnalizados(dataToCompare.factoresAnalizados);
        lastSavedRef.current = serialized;
      }
    }
  }, [storeLocalizacion, selectedAlternativeId]);

  // Auto-save effect
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    if (!selectedAlternativeId) return;

    const currentPayload = JSON.stringify({ ubicaciones, factoresAnalizados });
    if (currentPayload === lastSavedRef.current) return;
    
    lastSavedRef.current = currentPayload;
    void saveLocalizacionPreparacion(project.id, selectedAlternativeId, { ubicaciones, factoresAnalizados });
  }, [ubicaciones, factoresAnalizados, selectedAlternativeId, project.id, saveLocalizacionPreparacion]);

  // Handle Divipola department change
  const handleDepartmentChange = (deptId: string) => {
    setFormData((prev) => ({ ...prev, departamento: deptId, municipio: '' }));
    if (deptId) {
      void fetchMunicipalities(Number(deptId));
    }
  };

  const handleAddSubmit = () => {
    if (!formData.departamento || !formData.municipio) {
      setError("Departamento y Municipio son obligatorios");
      return;
    }

    const deptObj = departments.find(d => d.id.toString() === formData.departamento);
    const munObj = municipalitiesByDept[Number(formData.departamento)]?.find(m => m.id.toString() === formData.municipio);

    const newUbicacion: UbicacionJson = {
      id: crypto.randomUUID(),
      region: 'N/A', // Assuming region isn't strictly requested by divipola
      departamento: deptObj?.name || formData.departamento || '',
      municipio: munObj?.name || formData.municipio || '',
      tipoAgrupacion: formData.tipoAgrupacion || '',
      agrupacion: formData.agrupacion || '',
      especifica: formData.especifica || '',
      latitud: formData.latitud || '',
      longitud: formData.longitud || '',
      georeferenciada: formData.georeferenciada || false,
    };

    setUbicaciones((prev) => [...prev, newUbicacion]);
    setIsAdding(false);
    setFormData({ georeferenciada: false });
    setError(null);
  };

  const handleDeleteUbicacion = (id: string) => {
    setUbicaciones((prev) => prev.filter((u) => u.id !== id));
  };

  const handleFactorToggle = (factor: string) => {
    setFactoresAnalizados((prev) => 
      prev.includes(factor) ? prev.filter((f) => f !== factor) : [...prev, factor]
    );
  };

  const handleCopyPoblacionObjetivo = () => {
    const currentFormulation = useProjectMgaStore.getState().getFormulation(project.id);
    const localizacionesPO = currentFormulation.identificacion?.poblacion?.objetivo?.localizaciones || [];
    if (localizacionesPO.length === 0) {
      setError('La población objetivo no tiene localizaciones registradas en la pestaña de Identificación.');
      return;
    }
    setUbicaciones(localizacionesPO);
    setError(null);
  };

  const handleSelectAllFactores = () => {
    setFactoresAnalizados([...FACTORES_ANALIZADOS_MGA]);
  };

  const handleDeselectAllFactores = () => {
    setFactoresAnalizados([]);
  };

  if (alternatives.length === 0) {
    return (
      <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
        <div className="flex items-center gap-2 border-b pb-3">
          <h1 className="text-xl font-normal text-[#2980b9]">Localización</h1>
          <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
        </div>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md flex gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
          <div className="text-yellow-700">
            <p className="font-bold">No hay alternativas que pasen a preparación.</p>
            <p>Por favor, diríjase a la pestaña de "Identificación", módulo "Alternativas", y asegúrese de que al menos una alternativa tenga habilitada la opción "Pasa a preparación".</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">Localización</h1>
        <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
      </div>

      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}

      <div className="flex items-center gap-4 bg-slate-50 p-3 rounded border mb-6">
        <label className="font-semibold text-slate-700 whitespace-nowrap">Alternativa:</label>
        <select
          value={selectedAlternativeId}
          onChange={(e) => handleAlternativeChange(e.target.value)}
          className="flex-1 p-2 border border-slate-300 rounded bg-white focus:border-[#2980b9] focus:ring-[#2980b9] outline-none"
        >
          {alternatives.map((alt: any) => (
            <option key={alt.id} value={alt.id}>
              {alt.nombre}
            </option>
          ))}
        </select>
      </div>

      <MgaAccordion 
        title="01 - Localización de la alternativa"
        number="01"
        open={true}
        onToggle={() => {}}
      >
        <div className="space-y-4 p-2">
        
        <div className="flex justify-start">
          <button
            onClick={handleCopyPoblacionObjetivo}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 flex items-center gap-2 transition-colors font-medium shadow-sm text-sm"
          >
            <MapPin className="w-4 h-4 text-[#2980b9]" />
            Utilizar localización de la población objetivo
          </button>
        </div>

        {!isAdding ? (
          <div className="space-y-4">
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b text-slate-600">
                    <th className="p-3 font-medium">Región</th>
                    <th className="p-3 font-medium">Departamento</th>
                    <th className="p-3 font-medium">Municipio</th>
                    <th className="p-3 font-medium">Tipo Agrupación</th>
                    <th className="p-3 font-medium">Agrupación</th>
                    <th className="p-3 font-medium">Específica</th>
                    <th className="p-3 font-medium">Latitud</th>
                    <th className="p-3 font-medium">Longitud</th>
                    <th className="p-3 font-medium w-16">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ubicaciones.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-slate-500">
                        No hay localizaciones registradas.
                      </td>
                    </tr>
                  ) : (
                    ubicaciones.map((ub) => (
                      <tr key={ub.id} className="border-b hover:bg-slate-50 transition-colors">
                        <td className="p-3">{ub.region}</td>
                        <td className="p-3">{ub.departamento}</td>
                        <td className="p-3">{ub.municipio}</td>
                        <td className="p-3">{ub.tipoAgrupacion || '-'}</td>
                        <td className="p-3">{ub.agrupacion || '-'}</td>
                        <td className="p-3 truncate max-w-[150px]" title={ub.especifica}>{ub.especifica || '-'}</td>
                        <td className="p-3">{ub.latitud || '-'}</td>
                        <td className="p-3">{ub.longitud || '-'}</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleDeleteUbicacion(ub.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
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
              className="px-4 py-2 bg-[#006162] text-white rounded hover:bg-[#004d4e] flex items-center gap-2 transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>
        ) : (
          <div className="bg-slate-50 border rounded-lg p-5 space-y-4">
            <h3 className="font-medium text-slate-700">Agregar Localización</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Departamento *</label>
                <select
                  value={formData.departamento || ''}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                  className="w-full p-2 border rounded focus:ring-1 focus:ring-[#006162] outline-none"
                >
                  <option value="">Seleccione...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Municipio *</label>
                <select
                  value={formData.municipio || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, municipio: e.target.value }))}
                  disabled={!formData.departamento}
                  className="w-full p-2 border rounded focus:ring-1 focus:ring-[#006162] outline-none"
                >
                  <option value="">Seleccione...</option>
                  {formData.departamento && municipalitiesByDept[Number(formData.departamento)]?.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Agrupación</label>
                <input
                  type="text"
                  value={formData.tipoAgrupacion || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, tipoAgrupacion: e.target.value }))}
                  placeholder="Ej. Resguardo, Vereda"
                  className="w-full p-2 border rounded focus:ring-1 focus:ring-[#006162] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Agrupación</label>
                <input
                  type="text"
                  value={formData.agrupacion || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, agrupacion: e.target.value }))}
                  className="w-full p-2 border rounded focus:ring-1 focus:ring-[#006162] outline-none"
                />
              </div>
              
              <div className="md:col-span-2">
                <AIAssistedField label="Localización Específica" htmlFor="localizacion-preparacion-especifica" guidance="Precise el lugar, sector o referencia territorial donde se ejecutará la intervención." askPrompt="Ayúdame a describir una localización específica para un proyecto MGA.">
                  <CountedTextarea id="localizacion-preparacion-especifica" value={formData.especifica || ''} onChange={(e) => setFormData(prev => ({ ...prev, especifica: e.target.value }))} rows={2} maxLength={500} className="w-full rounded border p-2 outline-none focus:ring-1 focus:ring-[#006162]" />
                </AIAssistedField>
              </div>

              <div className="md:col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="geo-checkbox"
                  checked={formData.georeferenciada || false}
                  onChange={(e) => setFormData(prev => ({ ...prev, georeferenciada: e.target.checked }))}
                  className="w-4 h-4 text-[#006162] rounded border-slate-300 focus:ring-[#006162]"
                />
                <label htmlFor="geo-checkbox" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Georreferenciar
                </label>
              </div>

              {formData.georeferenciada && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Latitud</label>
                    <input
                      type="text"
                      value={formData.latitud || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, latitud: e.target.value }))}
                      className="w-full p-2 border rounded focus:ring-1 focus:ring-[#006162] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Longitud</label>
                    <input
                      type="text"
                      value={formData.longitud || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, longitud: e.target.value }))}
                      className="w-full p-2 border rounded focus:ring-1 focus:ring-[#006162] outline-none"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-200">
              <button
                onClick={() => {
                  setIsAdding(false);
                  setFormData({ georeferenciada: false });
                  setError(null);
                }}
                className="px-4 py-2 border text-slate-600 rounded hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddSubmit}
                className="px-4 py-2 bg-[#006162] text-white rounded hover:bg-[#004d4e] transition-colors"
              >
                Guardar Localización
              </button>
            </div>
          </div>
        )}
        </div>
      </MgaAccordion>

      {/* Seccion 2: Factores Analizados */}
      <MgaAccordion 
        title="02 - Factores analizados"
        number="02"
        open={true}
        onToggle={() => {}}
      >
        <div className="space-y-4 p-2">
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-lg border">
            {FACTORES_ANALIZADOS_MGA.map((factor) => {
              const isSelected = factoresAnalizados.includes(factor);
              return (
                <label 
                  key={factor} 
                  className={`flex items-start gap-2 p-2 rounded cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50/50 text-blue-900' : 'hover:bg-white text-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleFactorToggle(factor)}
                    className="mt-1 w-4 h-4 text-[#006162] rounded border-slate-300 focus:ring-[#006162]"
                  />
                  <span className="text-sm leading-tight">{factor}</span>
                </label>
              );
            })}
          </div>

          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200">
            <button
              onClick={handleSelectAllFactores}
              className="px-3 py-1.5 text-xs bg-slate-100 border text-slate-700 hover:bg-slate-200 rounded transition-colors"
            >
              Seleccionar todo
            </button>
            <button
              onClick={handleDeselectAllFactores}
              className="px-3 py-1.5 text-xs bg-slate-100 border text-slate-700 hover:bg-slate-200 rounded transition-colors"
            >
              Deseleccionar todo
            </button>
          </div>

        </div>
      </MgaAccordion>
      
      <div className="mt-8">
        <MgaActionButtons project={project} />
      </div>
    </div>
  );
}
