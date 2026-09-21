import { useState, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore } from '../../../store/projectMgaStore';
import MgaAlert from './MgaAlert';

export default function AnalisisTecnicoTab({ project }: { project: Project }) {
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));
  const saveAnalisisTecnico = useProjectMgaStore((s) => s.saveAnalisisTecnico);
  const isSaving = useProjectMgaStore((s) => s.isSaving);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<Record<string, string>>({});

  useEffect(() => {
    if (formulation.analisisTecnico?.items) {
      setItems(formulation.analisisTecnico.items);
    }
  }, [formulation.analisisTecnico]);

  const alternatives = formulation.alternatives.filter(a => a.proceeds_to_preparation);

  const handleSave = async () => {
    setError(null);
    setMessage(null);
    try {
      await saveAnalisisTecnico(project.id, { items });
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

      <div className="space-y-4">
        {alternatives.length === 0 ? (
          <div className="p-4 text-center text-gray-500 border rounded bg-gray-50">
            No hay alternativas que pasen a preparación.
          </div>
        ) : (
          alternatives.map(alt => (
            <div key={alt.id} className="border rounded p-4 bg-gray-50 space-y-2">
              <label className="font-semibold block mb-1 text-gray-700">
                Alternativa: {alt.description}
              </label>
              <textarea spellCheck={true}
                rows={5}
                maxLength={2500}
                value={items[alt.id] || ''}
                onChange={(e) => setItems(prev => ({ ...prev, [alt.id]: e.target.value }))}
                className="w-full p-2 border rounded bg-white"
                placeholder="Describa el análisis técnico..."
              />
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
