import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore } from '../../../store/projectMgaStore';
import MgaAlert from './MgaAlert';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';

export default function EvaluacionTab({ project }: { project: Project }) {
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));
  const saveEvaluacion = useProjectMgaStore((s) => s.saveEvaluacion);
  const isSaving = useProjectMgaStore((s) => s.isSaving);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [resumen, setResumen] = useState(formulation.evaluacion?.resumen || '');

  const fieldProjectContext = {
    projectName: project.name,
    sector: project.sector || undefined,
    productCode: project.product_code || undefined,
  };

  const alternatives = formulation.alternatives.filter(a => a.proceeds_to_preparation);

  const handleSave = async () => {
    setError(null);
    setMessage(null);
    try {
      await saveEvaluacion(project.id, { resumen });
      setMessage('Evaluación guardada exitosamente.');
    } catch (err) {
      setError('Error al guardar evaluación');
    }
  };

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-sm">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">Evaluación Económica y Social</h1>
        <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
      </div>

      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}
      {message && <MgaAlert message={message} variant="success" onDismiss={() => setMessage(null)} />}

      <div className="space-y-4">
        {alternatives.length === 0 ? (
          <div className="p-4 text-center text-gray-500 border rounded bg-gray-50">
            No hay alternativas para evaluar.
          </div>
        ) : (
          <div className="border rounded p-4 bg-gray-50 space-y-4">
            <h3 className="font-semibold text-gray-700">Resumen de evaluación por alternativa</h3>
            <div className="overflow-x-auto border rounded bg-white">
              <table className="w-full text-left">
                <thead className="bg-[#6c757d] text-white">
                  <tr>
                    <th className="p-2 border">Alternativa</th>
                    <th className="p-2 border text-right">VPN (Valor Presente Neto)</th>
                    <th className="p-2 border text-right">TIR (Tasa Interna de Retorno)</th>
                    <th className="p-2 border text-right">CAE (Costo Anual Equivalente)</th>
                  </tr>
                </thead>
                <tbody>
                  {alternatives.map((alt) => (
                    <tr key={alt.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 border font-medium">{alt.description}</td>
                      <td className="p-2 border text-right text-gray-500">Pendiente cálculo...</td>
                      <td className="p-2 border text-right text-gray-500">Pendiente cálculo...</td>
                      <td className="p-2 border text-right text-gray-500">Pendiente cálculo...</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <AIAssistedField
                label="Conclusión / Resumen de Evaluación"
                htmlFor={`eval-resumen-${project.id}`}
                compact
                guidance="Escribe las conclusiones de la evaluación económica y social."
                askPrompt={`¿Cómo redacto las conclusiones de la evaluación económica para el proyecto "${project.name}"?`}
                fieldHelpKey="resumen_evaluacion"
                projectContext={fieldProjectContext}
                reactiveContext={{ resumen }}
                currentValue={resumen}
                onAutoFill={(v) => setResumen(v)}
                maxLength={2500}
              >
                <textarea spellCheck={true}
                  id={`eval-resumen-${project.id}`}
                  rows={4}
                  maxLength={2500}
                  value={resumen}
                  onChange={(e) => setResumen(e.target.value)}
                  className="w-full p-2 border rounded bg-white mt-1"
                  placeholder="Escriba las conclusiones de la evaluación..."
                />
              </AIAssistedField>
            </div>
          </div>
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
          Guardar Evaluación
        </button>
      </div>
    </div>
  );
}
