import { useState, useEffect, useRef } from 'react';
import { HelpCircle, Plus, Trash2, MapPin } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore, debouncedPatchProject, type PoblacionJson, type PoblacionDetalleJson, type UbicacionJson } from '../../../store/projectMgaStore';
import { useCatalogStore } from '../../../store/catalogStore';
import MgaAccordion from './MgaAccordion';
import MgaAlert from './MgaAlert';

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
  
  const [openSections, setOpenSections] = useState({
    afectada: true,
    objetivo: true,
  });

  const { departments, municipalitiesByDept, fetchDepartments, fetchMunicipalities } = useCatalogStore();

  const [poblacion, setPoblacion] = useState<PoblacionJson>({
    afectada: { ...EMPTY_POBLACION_DETALLE },
    objetivo: { ...EMPTY_POBLACION_DETALLE },
  });

  const prevProjectIdRef = useRef(project.id);
  const isFirstMount = useRef(true);
  const lastSavedRef = useRef<string>('');

  useEffect(() => {
    void fetchDepartments();
  }, [fetchDepartments]);

  useEffect(() => {
    if (prevProjectIdRef.current !== project.id) {
      prevProjectIdRef.current = project.id;
      isFirstMount.current = true;
    }
    const storePoblacion = useProjectMgaStore.getState().getFormulation(project.id)?.identificacion?.poblacion;
    const initial = {
      afectada: storePoblacion?.afectada || { ...EMPTY_POBLACION_DETALLE },
      objetivo: storePoblacion?.objetivo || { ...EMPTY_POBLACION_DETALLE },
    };
    setPoblacion(initial);
    lastSavedRef.current = JSON.stringify(initial);
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
    debouncedPatchProject(project.id, {
      identificacion_data: {
        ...curData,
        poblacion,
      },
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
              <label className="block text-sm font-semibold text-slate-700 mb-1">Fuente de la información *</label>
              <input
                spellCheck={true}
                type="text"
                value={data.fuenteInformacion}
                onChange={(e) => updateData({ fuenteInformacion: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#006162] outline-none text-sm"
              />
            </div>
          </div>
          
          <LocalizacionSubSection 
            localizaciones={data.localizaciones}
            onChange={(locs) => updateData({ localizaciones: locs })}
            departments={departments}
            municipalitiesByDept={municipalitiesByDept}
            fetchMunicipalities={fetchMunicipalities}
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
    </div>
  );
}

// Separate component for the Localization part to keep things clean
function LocalizacionSubSection({
  localizaciones,
  onChange,
  departments,
  municipalitiesByDept,
  fetchMunicipalities
}: {
  localizaciones: UbicacionJson[],
  onChange: (l: UbicacionJson[]) => void,
  departments: any[],
  municipalitiesByDept: Record<number, any[]>,
  fetchMunicipalities: (id: number) => void
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<UbicacionJson>>({ georeferenciada: false });

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
      region: 'N/A',
      departamento: deptObj?.name || formData.departamento || '',
      municipio: munObj?.name || formData.municipio || '',
      tipoAgrupacion: formData.tipoAgrupacion || '',
      agrupacion: formData.agrupacion || '',
      especifica: formData.especifica || '',
      latitud: formData.latitud || '',
      longitud: formData.longitud || '',
      georeferenciada: formData.georeferenciada || false,
    };

    onChange([...localizaciones, newUbicacion]);
    setIsAdding(false);
    setFormData({ georeferenciada: false });
    setError(null);
  };

  const handleDelete = (id: string) => {
    onChange(localizaciones.filter((u) => u.id !== id));
  };

  return (
    <div className="space-y-4 mt-6 border-t pt-4">
      <h4 className="text-sm font-semibold text-slate-700">Localización</h4>
      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}
      
      {!isAdding ? (
        <div className="space-y-4">
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b text-slate-600">
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
                    <td colSpan={6} className="p-4 text-center text-slate-500">
                      No hay localizaciones registradas.
                    </td>
                  </tr>
                ) : (
                  localizaciones.map((ub) => (
                    <tr key={ub.id} className="border-b hover:bg-slate-50">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Departamento *</label>
              <select
                value={formData.departamento || ''}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                className="w-full p-2 border rounded focus:ring-1 focus:ring-[#006162] outline-none text-sm bg-white"
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
                className="w-full p-2 border rounded focus:ring-1 focus:ring-[#006162] outline-none text-sm bg-white"
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
                className="w-full p-2 border rounded focus:ring-1 focus:ring-[#006162] outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Agrupación</label>
              <input
                type="text"
                value={formData.agrupacion || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, agrupacion: e.target.value }))}
                className="w-full p-2 border rounded focus:ring-1 focus:ring-[#006162] outline-none text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Localización Específica</label>
              <textarea
                value={formData.especifica || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, especifica: e.target.value }))}
                rows={2}
                className="w-full p-2 border rounded focus:ring-1 focus:ring-[#006162] outline-none text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-200">
            <button
              onClick={() => {
                setIsAdding(false);
                setFormData({ georeferenciada: false });
                setError(null);
              }}
              className="px-3 py-1.5 border text-slate-600 rounded hover:bg-slate-100 transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleAddSubmit}
              className="px-3 py-1.5 bg-[#006162] text-white rounded hover:bg-[#004d4e] transition-colors text-sm"
            >
              Guardar Localización
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
