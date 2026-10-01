import { useState, useEffect, useRef } from 'react';
import { HelpCircle, AlertTriangle } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore, type PreparacionData } from '../../../store/projectMgaStore';
import MgaAlert from './MgaAlert';
import MgaAccordion from './MgaAccordion';
import MgaActionButtons from './MgaActionButtons';
import { CountedTextarea } from '../../ui/CountedTextarea';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';

type AnalisisTecnicoTabProps = {
  project: Project;
};

export default function AnalisisTecnicoTab({ project }: AnalisisTecnicoTabProps) {
  const getFormulation = useProjectMgaStore((s) => s.getFormulation);
  const savePreparacion = useProjectMgaStore((s) => s.savePreparacion);
  const isSaving = useProjectMgaStore((s) => s.isSaving);

  const formulation = getFormulation(project.id);
  const alternativasAll = formulation.identificacion?.alternativas || [];
  // Important: filter alternatives where pasaPreparacion === true
  const alternatives = alternativasAll.filter((alt: any) => alt.pasaPreparacion === true);
  
  const initialPreparacion = formulation.preparacion;

  const [selectedAlternativeId, setSelectedAlternativeId] = useState<string>(alternatives.length > 0 ? alternatives[0].id : '');
  const [resumen, setResumen] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const prevProjectIdRef = useRef(project.id);
  const isFirstMount = useRef(true);
  
  // Guardamos un ref para controlar qué hemos guardado en todo "analisisTecnico"
  const lastSavedRef = useRef<string>(JSON.stringify(initialPreparacion?.analisisTecnico || {}));

  const storePreparacion = useProjectMgaStore((s) => s.getFormulation(project.id)?.preparacion);

  useEffect(() => {
    if (storePreparacion?.analisisTecnico) {
      const dataToCompare = storePreparacion.analisisTecnico;
      const serialized = JSON.stringify(dataToCompare);
      if (serialized !== lastSavedRef.current) {
        if (selectedAlternativeId && dataToCompare[selectedAlternativeId]) {
          setResumen(dataToCompare[selectedAlternativeId].resumen || '');
        }
        lastSavedRef.current = serialized;
      }
    }
  }, [storePreparacion, selectedAlternativeId]);

  // Initial load and project change sync
  useEffect(() => {
    if (prevProjectIdRef.current !== project.id) {
      prevProjectIdRef.current = project.id;
      isFirstMount.current = true;
      const currentFormulation = useProjectMgaStore.getState().getFormulation(project.id);
      const altsAll = currentFormulation.identificacion?.alternativas || [];
      const alts = altsAll.filter((alt: any) => alt.pasaPreparacion === true);
      
      if (alts.length > 0) {
        setSelectedAlternativeId(alts[0].id);
      } else {
        setSelectedAlternativeId('');
        setResumen('');
      }
    }
  }, [project.id]);

  // Handle alternative change
  const handleAlternativeChange = (newAltId: string) => {
    setSelectedAlternativeId(newAltId);
    const currentFormulation = useProjectMgaStore.getState().getFormulation(project.id);
    const currentData = currentFormulation.preparacion?.analisisTecnico || {};
    const newResumen = currentData[newAltId]?.resumen || '';
    setResumen(newResumen);
  };

  // Auto-save effect
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    if (!selectedAlternativeId) return;

    const currentFormulation = useProjectMgaStore.getState().getFormulation(project.id);
    const currentData = currentFormulation.preparacion?.analisisTecnico || {};
    
    const updatedAnalisisTecnico = {
      ...currentData,
      [selectedAlternativeId]: { resumen }
    };

    const serialized = JSON.stringify(updatedAnalisisTecnico);
    if (serialized === lastSavedRef.current) return;
    lastSavedRef.current = serialized;

    const currentPreparacion = currentFormulation.preparacion || { necesidades: {} };
    const newData: PreparacionData = {
      ...currentPreparacion,
      analisisTecnico: updatedAnalisisTecnico
    };

    void savePreparacion(project.id, newData);
  }, [resumen, selectedAlternativeId, project.id, savePreparacion]);

  if (alternatives.length === 0) {
    return (
      <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
        <div className="flex items-center gap-2 border-b pb-3">
          <h1 className="text-xl font-normal text-[#2980b9]">Análisis técnico</h1>
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
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-normal text-[#2980b9]">Análisis técnico</h1>
          <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
        </div>
        {isSaving && (
          <div className="flex items-center gap-2 text-emerald-600 font-medium">
             <div className="w-4 h-4 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" /> Guardando...
          </div>
        )}
      </div>

      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}

      <div className="flex items-center gap-4 bg-slate-50 p-3 rounded border">
        <label className="font-semibold text-slate-700 whitespace-nowrap">Alternativa:</label>
        <select
          value={selectedAlternativeId}
          onChange={(e) => handleAlternativeChange(e.target.value)}
          className="flex-1 p-2 border border-slate-300 rounded bg-white focus:border-[#2980b9] focus:ring-[#2980b9] outline-none"
        >
          {alternatives.map((alt: any) => (
            <option key={alt.id} value={alt.id}>{alt.nombre}</option>
          ))}
        </select>
      </div>

      <MgaAccordion 
        title="01 - Análisis técnico de la alternativa"
        number="01"
        open={true}
        onToggle={() => {}}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-2">
          <div className="md:col-span-2">
            <AIAssistedField
              label="Resumen de la alternativa"
              htmlFor={`analisis-tecnico-${project.id}`}
              required
              guidance="Describa la viabilidad técnica, el alcance y los componentes principales de la alternativa."
              askPrompt={`Ayúdame a redactar el resumen técnico de la alternativa del proyecto ${project.name}.`}
            >
              <CountedTextarea
                id={`analisis-tecnico-${project.id}`}
                value={resumen}
                onChange={(e) => setResumen(e.target.value)}
                maxLength={2000}
                rows={8}
                placeholder="Ingrese el resumen técnico de la alternativa..."
                className="w-full resize-y rounded-lg border border-slate-300 p-3 text-sm text-slate-800 outline-none focus:border-transparent focus:ring-2 focus:ring-[#006162]"
              />
            </AIAssistedField>
            <div className="flex justify-between items-center mt-2">
              <p className="text-xs text-slate-500">
                Describa técnicamente la alternativa seleccionada.
              </p>
              <p className="text-xs font-medium text-slate-500">
                {resumen.length} / 2000
              </p>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-100 rounded p-4 text-blue-800 self-start">
            <h4 className="font-semibold mb-2">Se sugiere incluir:</h4>
            <ul className="list-disc pl-4 space-y-1">
              <li>Normas técnicas que apliquen a los productos</li>
              <li>Requisitos técnicos sectoriales</li>
              <li>Requisitos por fuentes de financiación</li>
              <li>Requerimientos técnicos especiales</li>
            </ul>
          </div>
        </div>
      </MgaAccordion>

      <div className="mt-8">
        <MgaActionButtons project={project} />
      </div>
    </div>
  );
}
