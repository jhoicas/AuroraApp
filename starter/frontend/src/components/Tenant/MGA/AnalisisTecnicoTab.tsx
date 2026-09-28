import { useState, useEffect, useRef } from 'react';
import { HelpCircle } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore } from '../../../store/projectMgaStore';
import MgaAlert from './MgaAlert';

type AnalisisTecnicoTabProps = {
  project: Project;
};

export default function AnalisisTecnicoTab({ project }: AnalisisTecnicoTabProps) {
  const getFormulation = useProjectMgaStore((s) => s.getFormulation);
  const saveAnalisisTecnico = useProjectMgaStore((s) => s.saveAnalisisTecnico);

  const formulation = getFormulation(project.id);
  const alternatives = formulation.identificacion?.alternativas || [];
  
  const [selectedAlternativeId, setSelectedAlternativeId] = useState<string>('');
  const [resumen, setResumen] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const prevProjectIdRef = useRef(project.id);
  const isFirstMount = useRef(true);
  const lastSavedRef = useRef<string>('');

  // Initial load and project change sync
  useEffect(() => {
    if (prevProjectIdRef.current !== project.id) {
      prevProjectIdRef.current = project.id;
      isFirstMount.current = true;
    }

    const currentFormulation = useProjectMgaStore.getState().getFormulation(project.id);
    const alts = currentFormulation.identificacion?.alternativas || [];
    
    if (alts.length > 0) {
      const altIdToSelect = selectedAlternativeId && alts.some(a => a.id === selectedAlternativeId) 
        ? selectedAlternativeId 
        : alts[0].id;
        
      setSelectedAlternativeId(altIdToSelect);
      const initialResumen = currentFormulation.analisisTecnico?.[altIdToSelect]?.resumen || '';
      setResumen(initialResumen);
      lastSavedRef.current = initialResumen;
    } else {
      setSelectedAlternativeId('');
      setResumen('');
      lastSavedRef.current = '';
    }
  }, [project.id]);

  // Handle alternative change
  const handleAlternativeChange = (newAltId: string) => {
    // Before switching, save current if it's different (handled by the auto-save effect, but just in case, it relies on debounce)
    setSelectedAlternativeId(newAltId);
    
    const currentFormulation = useProjectMgaStore.getState().getFormulation(project.id);
    const newResumen = currentFormulation.analisisTecnico?.[newAltId]?.resumen || '';
    setResumen(newResumen);
    lastSavedRef.current = newResumen; // Reset lastSavedRef so the new value doesn't trigger an immediate save if it hasn't changed
    isFirstMount.current = true; // Prevent immediate save on next render
  };

  // Auto-save effect
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    if (!selectedAlternativeId) return;

    if (resumen === lastSavedRef.current) return;
    lastSavedRef.current = resumen;

    void saveAnalisisTecnico(project.id, selectedAlternativeId, { resumen });
  }, [resumen, selectedAlternativeId, project.id, saveAnalisisTecnico]);

  if (alternatives.length === 0) {
    return (
      <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
        <div className="flex items-center gap-2 border-b pb-3">
          <h1 className="text-xl font-normal text-[#2980b9]">Análisis técnico</h1>
          <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
        </div>
        <div className="p-4 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-lg">
          No hay alternativas registradas en el proyecto. Por favor, diríjase a la pestaña de "Identificación" para crear las alternativas antes de realizar el análisis técnico.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">Análisis técnico</h1>
        <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
      </div>

      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}

      <div className="space-y-6">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
          <label className="block text-sm font-semibold text-slate-800 mb-2">
            Alternativa
          </label>
          <select
            value={selectedAlternativeId}
            onChange={(e) => handleAlternativeChange(e.target.value)}
            className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-[#006162] focus:border-transparent outline-none"
          >
            {alternatives.map((alt) => (
              <option key={alt.id} value={alt.id}>
                {alt.nombre}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-2">
            Seleccione la alternativa para la cual desea diligenciar el análisis técnico.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
          <label className="block text-sm font-semibold text-slate-800 mb-2">
            Resumen de la alternativa <span className="text-red-500">*</span>
          </label>
          <textarea
            value={resumen}
            onChange={(e) => setResumen(e.target.value)}
            maxLength={2000}
            rows={8}
            placeholder="Ingrese el resumen técnico de la alternativa..."
            className="w-full p-3 border border-slate-300 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-[#006162] focus:border-transparent outline-none resize-y"
          />
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-slate-500">
              Describa técnicamente la alternativa seleccionada.
            </p>
            <p className="text-xs font-medium text-slate-500">
              {resumen.length} / 2000
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
