import { useState, useEffect } from 'react';
import { HelpCircle, PlusCircle, Trash2 } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore } from '../../../store/projectMgaStore';
import MgaAlert from './MgaAlert';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';

export default function NecesidadesTab({ project }: { project: Project }) {
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));
  const saveNecesidades = useProjectMgaStore((s) => s.saveNecesidades);
  const isSaving = useProjectMgaStore((s) => s.isSaving);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (formulation.necesidades?.items) {
      setItems(formulation.necesidades.items);
    }
  }, [formulation.necesidades]);

  const alternatives = formulation.alternatives.filter(a => a.proceeds_to_preparation);

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        alternativeId: '',
        bienServicio: '',
        unidadMedida: '',
        year: new Date().getFullYear().toString(),
        oferta: '',
        demanda: '',
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
      await saveNecesidades(project.id, { items });
      setMessage('Necesidades guardadas exitosamente.');
    } catch (err) {
      setError('Error al guardar necesidades');
    }
  };

  const calculateDeficit = (ofertaStr: string, demandaStr: string) => {
    const o = parseFloat(ofertaStr) || 0;
    const d = parseFloat(demandaStr) || 0;
    return d - o;
  };

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-sm">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">Necesidades</h1>
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
              <th className="p-2 border">Bien/Servicio</th>
              <th className="p-2 border">Unidad medida</th>
              <th className="p-2 border text-center">Año</th>
              <th className="p-2 border text-right">Oferta</th>
              <th className="p-2 border text-right">Demanda</th>
              <th className="p-2 border text-right">Déficit</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-4 text-center text-gray-500">
                  No hay necesidades registradas.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="p-2 border text-center">
                    <button
                      type="button"
                      onClick={() => deleteItem(item.id)}
                      className="p-1 bg-[#2980b9] text-white rounded"
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
                      label="Bien o Servicio"
                      htmlFor={`necesidad-bien-${item.id}`}
                      compact
                      guidance="Identifica y redacta el bien y/o servicio según manual MGA."
                      askPrompt={`¿Qué bien o servicio debo registrar para la alternativa seleccionada en el proyecto "${project.name}"?`}
                      fieldHelpKey="bien_servicio"
                      projectContext={{ projectName: project.name }}
                      reactiveContext={item}
                      currentValue={item.bienServicio}
                      onAutoFill={(v) =
            maxLength={100}> updateItem(item.id, 'bienServicio', v)}
                    >
                      <input spellCheck={true}
                        type="text"
                        id={`necesidad-bien-${item.id}`}
                        maxLength={100}
                        value={item.bienServicio}
                        onChange={(e) => updateItem(item.id, 'bienServicio', e.target.value)}
                        className="w-full p-1 border rounded bg-white text-xs mt-1"
                        placeholder="Bien/Servicio"
                      />
                    </AIAssistedField>
                  </td>
                  <td className="p-2 border relative group">
                    <AIAssistedField
                      label="Unidad de medida"
                      htmlFor={`necesidad-unidad-${item.id}`}
                      compact
                      guidance="Indica la unidad de medida según el bien y/o servicio."
                      askPrompt={`¿Cuál es la unidad de medida correcta en MGA para el bien/servicio "${item.bienServicio || 'seleccionado'}"?`}
                      fieldHelpKey="unidad_medida"
                      projectContext={{ projectName: project.name }}
                      reactiveContext={item}
                      currentValue={item.unidadMedida}
                      onAutoFill={(v) =
            maxLength={50}> updateItem(item.id, 'unidadMedida', v)}
                    >
                      <input spellCheck={true}
                        type="text"
                        id={`necesidad-unidad-${item.id}`}
                        maxLength={50}
                        value={item.unidadMedida}
                        onChange={(e) => updateItem(item.id, 'unidadMedida', e.target.value)}
                        className="w-full p-1 border rounded bg-white text-xs mt-1"
                        placeholder="Unidad"
                      />
                    </AIAssistedField>
                  </td>
                  <td className="p-2 border">
                    <input spellCheck={true}
                      type="number"
                      value={item.year}
                      onChange={(e) => updateItem(item.id, 'year', e.target.value)}
                      className="w-full p-1 border rounded bg-white text-xs text-center"
                      placeholder="Año"
                    />
                  </td>
                  <td className="p-2 border">
                    <input spellCheck={true}
                      type="number"
                      min="0"
                      maxLength={13}
                      inputMode="numeric"
                      onKeyDown={(e) => {
                        if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                      }}
                      value={item.oferta}
                      onChange={(e) => {
                        if (e.target.value.length <= 13) updateItem(item.id, 'oferta', e.target.value);
                      }}
                      className="w-full p-1 border rounded bg-white text-xs text-right"
                    />
                  </td>
                  <td className="p-2 border">
                    <input spellCheck={true}
                      type="number"
                      min="0"
                      maxLength={13}
                      inputMode="numeric"
                      onKeyDown={(e) => {
                        if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                      }}
                      value={item.demanda}
                      onChange={(e) => {
                        if (e.target.value.length <= 13) updateItem(item.id, 'demanda', e.target.value);
                      }}
                      className="w-full p-1 border rounded bg-white text-xs text-right"
                    />
                  </td>
                  <td className="p-2 border text-right font-semibold">
                    {calculateDeficit(item.oferta, item.demanda).toLocaleString('es-CO')}
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
          Adicionar necesidad
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
          Guardar Necesidades
        </button>
      </div>
    </div>
  );
}
