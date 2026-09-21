import { useState, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore } from '../../../store/projectMgaStore';
import MgaAlert from './MgaAlert';

export default function LocalizacionTab({ project }: { project: Project }) {
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));
  const saveLocalizacion = useProjectMgaStore((s) => s.saveLocalizacion);
  const isSaving = useProjectMgaStore((s) => s.isSaving);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<Record<string, { type: string; specific: string }>>({});

  useEffect(() => {
    if (formulation.localizacion?.items) {
      setItems(formulation.localizacion.items);
    }
  }, [formulation.localizacion]);

  const alternatives = formulation.alternatives.filter(a => a.proceeds_to_preparation);

  const handleSave = async () => {
    setError(null);
    setMessage(null);
    try {
      await saveLocalizacion(project.id, { items });
      setMessage('Localización guardada exitosamente.');
    } catch (err) {
      setError('Error al guardar localización');
    }
  };

  const updateItem = (altId: string, field: string, value: string) => {
    setItems(prev => ({
      ...prev,
      [altId]: {
        ...(prev[altId] || { type: '', specific: '' }),
        [field]: value
      }
    }));
  };

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-sm">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">Localización</h1>
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
          alternatives.map(alt => {
            const val = items[alt.id] || { type: '', specific: '' };
            return (
              <div key={alt.id} className="border rounded p-4 bg-gray-50 space-y-3">
                <label className="font-semibold block mb-1 text-gray-700">
                  Alternativa: {alt.description}
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-gray-600 mb-1">Localización de la alternativa</label>
                    <select
                      value={val.type}
                      onChange={(e) => updateItem(alt.id, 'type', e.target.value)}
                      className="w-full p-2 border rounded bg-white"
                    >
                      <option value="">Seleccione...</option>
                      <option value="Departamento">Departamento</option>
                      <option value="Municipio">Municipio</option>
                      <option value="Centro poblado">Centro poblado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1">Localización específica</label>
                    <input spellCheck={true}
                      type="text"
                      maxLength={200}
                      value={val.specific}
                      onChange={(e) => updateItem(alt.id, 'specific', e.target.value)}
                      className="w-full p-2 border rounded bg-white"
                      placeholder="Ej. Barrio Centro..."
                    />
                  </div>
                </div>
              </div>
            );
          })
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
          Guardar Localización
        </button>
      </div>
    </div>
  );
}
