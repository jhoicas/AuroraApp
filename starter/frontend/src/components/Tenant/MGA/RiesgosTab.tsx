import { useState, useEffect } from 'react';
import { HelpCircle, PlusCircle, Trash2 } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore } from '../../../store/projectMgaStore';
import MgaAlert from './MgaAlert';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';

export default function RiesgosTab({ project }: { project: Project }) {
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));
  const saveRiesgos = useProjectMgaStore((s) => s.saveRiesgos);
  const isSaving = useProjectMgaStore((s) => s.isSaving);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<any[]>([]);

  const fieldProjectContext = {
    projectName: project.name,
    sector: project.sector || undefined,
    productCode: project.product_code || undefined,
  };

  useEffect(() => {
    if (formulation.riesgos?.items) {
      setItems(formulation.riesgos.items);
    }
  }, [formulation.riesgos]);

  const alternatives = formulation.alternatives.filter(a => a.proceeds_to_preparation);

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        alternativeId: '',
        descripcion: '',
        probabilidad: '',
        impacto: '',
        efectos: '',
        medida: '',
      }
    ]);
  };

  const updateItem = (id: string, field: string, value: string) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const deleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleSave = async () => {
    setError(null);
    setMessage(null);
    try {
      await saveRiesgos(project.id, { items });
      setMessage('Riesgos guardados exitosamente.');
    } catch (err) {
      setError('Error al guardar riesgos');
    }
  };

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-sm">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">Riesgos</h1>
        <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
      </div>

      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}
      {message && <MgaAlert message={message} variant="success" onDismiss={() => setMessage(null)} />}

      <div className="overflow-x-auto border rounded">
        <table className="w-full text-left">
          <thead className="bg-[#6c757d] text-white">
            <tr>
              <th className="p-2 border">Acciones</th>
              <th className="p-2 border">Alternativa</th>
              <th className="p-2 border">Descripción</th>
              <th className="p-2 border">Probabilidad</th>
              <th className="p-2 border">Impacto</th>
              <th className="p-2 border">Efectos</th>
              <th className="p-2 border">Medida mitigación</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-500">
                  No hay riesgos registrados.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b hover:bg-gray-50 align-top">
                  <td className="p-2 border text-center">
                    <button
                      type="button"
                      onClick={() => deleteItem(item.id)}
                      className="p-1 bg-[#2980b9] text-white rounded mt-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                  <td className="p-2 border">
                    <select
                      value={item.alternativeId}
                      onChange={(e) => updateItem(item.id, 'alternativeId', e.target.value)}
                      className="w-full p-1 border rounded bg-white text-xs"
                    >
                      <option value="">Seleccione...</option>
                      {alternatives.map(a => (
                        <option key={a.id} value={a.id}>{a.description.substring(0, 50)}...</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 border relative group">
                    <AIAssistedField
                      label="Descripción del riesgo"
                      htmlFor={`riesgo-desc-${item.id}`}
                      compact
                      guidance="Detalla el riesgo identificado."
                      askPrompt={`¿Cómo describo un riesgo para la alternativa seleccionada del proyecto "${project.name}"?`}
                      fieldHelpKey="descripcion_riesgo"
                      projectContext={fieldProjectContext}
                      reactiveContext={item}
                      currentValue={item.descripcion}
                      onAutoFill={(v) => updateItem(item.id, 'descripcion', v)}
                    >
                      <textarea spellCheck={true}
                        id={`riesgo-desc-${item.id}`}
                        rows={2}
                        maxLength={2500}
                        value={item.descripcion}
                        onChange={(e) => updateItem(item.id, 'descripcion', e.target.value)}
                        className="w-full p-1 border rounded bg-white text-xs mt-1"
                        placeholder="Descripción"
                      />
                    </AIAssistedField>
                  </td>
                  <td className="p-2 border">
                    <select
                      value={item.probabilidad}
                      onChange={(e) => updateItem(item.id, 'probabilidad', e.target.value)}
                      className="w-full p-1 border rounded bg-white text-xs"
                    >
                      <option value="">Seleccione...</option>
                      <option value="Alta">Alta</option>
                      <option value="Media">Media</option>
                      <option value="Baja">Baja</option>
                    </select>
                  </td>
                  <td className="p-2 border">
                    <select
                      value={item.impacto}
                      onChange={(e) => updateItem(item.id, 'impacto', e.target.value)}
                      className="w-full p-1 border rounded bg-white text-xs"
                    >
                      <option value="">Seleccione...</option>
                      <option value="Alto">Alto</option>
                      <option value="Medio">Medio</option>
                      <option value="Bajo">Bajo</option>
                    </select>
                  </td>
                  <td className="p-2 border relative group">
                    <AIAssistedField
                      label="Efectos del riesgo"
                      htmlFor={`riesgo-efectos-${item.id}`}
                      compact
                      guidance="Identifica las consecuencias si el riesgo se materializa."
                      askPrompt={`¿Cuáles podrían ser los efectos si se materializa este riesgo en el proyecto "${project.name}"?`}
                      fieldHelpKey="efectos_riesgo"
                      projectContext={fieldProjectContext}
                      reactiveContext={item}
                      currentValue={item.efectos}
                      onAutoFill={(v) => updateItem(item.id, 'efectos', v)}
                    >
                      <textarea spellCheck={true}
                        id={`riesgo-efectos-${item.id}`}
                        rows={2}
                        maxLength={250}
                        value={item.efectos}
                        onChange={(e) => updateItem(item.id, 'efectos', e.target.value)}
                        className="w-full p-1 border rounded bg-white text-xs mt-1"
                        placeholder="Efectos"
                      />
                    </AIAssistedField>
                  </td>
                  <td className="p-2 border relative group">
                    <AIAssistedField
                      label="Medida de mitigación"
                      htmlFor={`riesgo-medida-${item.id}`}
                      compact
                      guidance="Propone la medida para mitigar el riesgo."
                      askPrompt={`¿Qué medidas de mitigación puedo aplicar para este riesgo en el proyecto "${project.name}"?`}
                      fieldHelpKey="medida_mitigacion"
                      projectContext={fieldProjectContext}
                      reactiveContext={item}
                      currentValue={item.medida}
                      onAutoFill={(v) => updateItem(item.id, 'medida', v)}
                    >
                      <textarea spellCheck={true}
                        id={`riesgo-medida-${item.id}`}
                        rows={2}
                        maxLength={250}
                        value={item.medida}
                        onChange={(e) => updateItem(item.id, 'medida', e.target.value)}
                        className="w-full p-1 border rounded bg-white text-xs mt-1"
                        placeholder="Medida de mitigación"
                      />
                    </AIAssistedField>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-start">
        <button
          type="button"
          onClick={handleAddItem}
          className="flex items-center gap-1 px-4 py-1.5 bg-[#2980b9] text-white font-semibold rounded"
        >
          <PlusCircle className="w-4 h-4" />
          Adicionar riesgo
        </button>
      </div>

      <div className="mt-8 pt-4 border-t border-slate-200 flex justify-end">
        <button 
          type="button"
          onClick={() => void handleSave()} 
          disabled={isSaving}
          className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
          Guardar Riesgos
        </button>
      </div>
    </div>
  );
}
