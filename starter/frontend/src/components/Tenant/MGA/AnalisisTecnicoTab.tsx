import { useState, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore } from '../../../store/projectMgaStore';
import MgaAlert from './MgaAlert';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';

export default function AnalisisTecnicoTab({ project }: { project: Project }) {
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));
  const saveAnalisisTecnico = useProjectMgaStore((s) => s.saveAnalisisTecnico);
  const isSaving = useProjectMgaStore((s) => s.isSaving);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<Record<string, string>>({});
  const [projectHorizon, setProjectHorizon] = useState<string>(() => {
    const rawHorizon =
      formulation.analisisTecnico?.project_horizon ??
      formulation.analisisTecnico?.horizonte_evaluacion ??
      (project.mga_formulation_data as any)?.analisisTecnico?.project_horizon ??
      (project.mga_formulation_data as any)?.analisis_tecnico?.project_horizon ??
      (project.mga_formulation_data as any)?.project_horizon ??
      '';
    return rawHorizon ? String(rawHorizon) : '';
  });

  const fieldProjectContext = {
    projectName: project.name,
    sector: project.sector || undefined,
    productCode: project.product_code || undefined,
  };

  useEffect(() => {
    if (formulation.analisisTecnico?.items) {
      setItems(formulation.analisisTecnico.items);
    }
    const h =
      formulation.analisisTecnico?.project_horizon ??
      formulation.analisisTecnico?.horizonte_evaluacion ??
      (project.mga_formulation_data as any)?.analisisTecnico?.project_horizon ??
      (project.mga_formulation_data as any)?.analisis_tecnico?.project_horizon ??
      (project.mga_formulation_data as any)?.project_horizon;
    if (h !== undefined && h !== null && h !== '') {
      setProjectHorizon(String(h));
    }
  }, [formulation.analisisTecnico, project.mga_formulation_data]);

  const alternatives = formulation.alternatives.filter(a => a.proceeds_to_preparation);

  const handleSave = async () => {
    setError(null);
    setMessage(null);
    const numHorizon = parseInt(projectHorizon, 10);
    try {
      await saveAnalisisTecnico(project.id, {
        items,
        project_horizon: Number.isFinite(numHorizon) ? numHorizon : 0,
        horizonte_evaluacion: Number.isFinite(numHorizon) ? numHorizon : 0,
      });
      setMessage('Análisis técnico guardado exitosamente.');
    } catch (err) {
      setError('Error al guardar análisis técnico');
    }
  };

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-sm">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">Análisis técnico</h1>
        <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
      </div>

      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}
      {message && <MgaAlert message={message} variant="success" onDismiss={() => setMessage(null)} />}

      {/* Horizonte de Evaluación */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-2">
        <label className="font-semibold text-gray-700 block">
          Horizonte de evaluación del proyecto (Años) *
        </label>
        <p className="text-xs text-gray-500">
          Periodo estimado en años que contempla la fase de inversión, operación y vida útil de los activos para la evaluación ex-ante (metodología MGA DNP).
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="1"
            max="100"
            id={`mga-project-horizon-${project.id}`}
            name="project_horizon"
            value={projectHorizon}
            onChange={(e) => setProjectHorizon(e.target.value)}
            className="w-48 p-2 border rounded text-xs bg-white focus:ring-2 focus:ring-primary"
            placeholder="Ej. 10"
          />
          <span className="text-xs text-gray-600 font-medium">años de horizonte de evaluación</span>
        </div>
      </div>

      <div className="space-y-4">
        {alternatives.length === 0 ? (
          <div className="p-4 text-center text-gray-500 border rounded bg-gray-50">
            No hay alternativas que pasen a preparación.
          </div>
        ) : (
          alternatives.map(alt => (
            <div key={alt.id} className="border rounded p-4 bg-gray-50 space-y-2">
              <AIAssistedField
                label={`Análisis Técnico - Alternativa: ${alt.description.substring(0, 50)}...`}
                htmlFor={`analisis-tecnico-${alt.id}`}
                compact
                guidance="Elabore el análisis técnico de la alternativa seleccionada, detallando la viabilidad técnica."
                askPrompt={`¿Cómo redacto el análisis técnico para la alternativa "${alt.description}" del proyecto "${project.name}"?`}
                fieldHelpKey="analisis_tecnico"
                projectContext={fieldProjectContext}
                reactiveContext={{ alternativa: alt.description }}
                currentValue={items[alt.id] || ''}
                onAutoFill={(v) => setItems(prev => ({ ...prev, [alt.id]: v }))}
                maxLength={2000}
              >
                <textarea spellCheck={true}
                  id={`analisis-tecnico-${alt.id}`}
                  rows={5}
                  maxLength={2000}
                  value={items[alt.id] || ''}
                  onChange={(e) => setItems(prev => ({ ...prev, [alt.id]: e.target.value }))}
                  className="w-full p-2 border rounded bg-white mt-1"
                  placeholder="Describa el análisis técnico..."
                />
              </AIAssistedField>
            </div>
          ))
        )}
      </div>

      <div className="mt-8 pt-4 border-t border-slate-200 flex justify-end">
        <button 
          type="button"
          onClick={() => void handleSave()} 
          disabled={isSaving}
          className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
          Guardar Análisis Técnico
        </button>
      </div>
    </div>
  );
}
