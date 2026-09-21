import { useState, useEffect } from 'react';
import { HelpCircle, PlusCircle, Trash2 } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore } from '../../../store/projectMgaStore';
import MgaAlert from './MgaAlert';

export default function DepreciacionTab({ project }: { project: Project }) {
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));
  const saveDepreciacion = useProjectMgaStore((s) => s.saveDepreciacion);
  const isSaving = useProjectMgaStore((s) => s.isSaving);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (formulation.depreciacion?.items) {
      setItems(formulation.depreciacion.items);
    }
  }, [formulation.depreciacion]);

  const alternatives = formulation.alternatives.filter(a => a.proceeds_to_preparation);

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        alternativeId: '',
        activo: '',
        valorActivo: '',
        vidaUtil: '',
        valorSalvamento: '',
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
      await saveDepreciacion(project.id, { items });
      setMessage('Depreciación guardada exitosamente.');
    } catch (err) {
      setError('Error al guardar depreciación');
    }
  };

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-sm">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">Depreciación</h1>
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
              <th className="p-2 border">Activo</th>
              <th className="p-2 border">Valor activo</th>
              <th className="p-2 border">Vida útil</th>
              <th className="p-2 border">Valor salvamento</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500">
                  No hay activos registrados para depreciación.
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
                  <td className="p-2 border">
                    <select
                      value={item.activo}
                      onChange={(e) => updateItem(item.id, 'activo', e.target.value)}
                      className="w-full p-1 border rounded bg-white text-xs"
                    >
                      <option value="">Seleccione...</option>
                      <option value="Edificaciones">Edificaciones</option>
                      <option value="Maquinaria y equipo">Maquinaria y equipo</option>
                      <option value="Vehículos">Vehículos</option>
                      <option value="Muebles y enseres">Muebles y enseres</option>
                      <option value="Equipo de cómputo">Equipo de cómputo</option>
                      <option value="Otros">Otros</option>
                    </select>
                  </td>
                  <td className="p-2 border">
                    <input spellCheck={true}
                      type="number"
                      min="0"
                      maxLength={22}
                      inputMode="numeric"
                      onKeyDown={(e) => {
                        if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                      }}
                      value={item.valorActivo}
                      onChange={(e) => {
                        if (e.target.value.length <= 22) updateItem(item.id, 'valorActivo', e.target.value);
                      }}
                      className="w-full p-1 border rounded bg-white text-xs text-right"
                      placeholder="Valor"
                    />
                  </td>
                  <td className="p-2 border">
                    <input spellCheck={true}
                      type="number"
                      min="0"
                      maxLength={22}
                      inputMode="numeric"
                      onKeyDown={(e) => {
                        if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault();
                      }}
                      value={item.vidaUtil}
                      onChange={(e) => {
                        if (e.target.value.length <= 22) updateItem(item.id, 'vidaUtil', e.target.value);
                      }}
                      className="w-full p-1 border rounded bg-white text-xs text-center"
                      placeholder="Años"
                    />
                  </td>
                  <td className="p-2 border">
                    <input spellCheck={true}
                      type="number"
                      min="0"
                      maxLength={22}
                      inputMode="numeric"
                      onKeyDown={(e) => {
                        if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                      }}
                      value={item.valorSalvamento}
                      onChange={(e) => {
                        if (e.target.value.length <= 22) updateItem(item.id, 'valorSalvamento', e.target.value);
                      }}
                      className="w-full p-1 border rounded bg-white text-xs text-right"
                      placeholder="Valor"
                    />
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
          Adicionar activo
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
          Guardar Depreciación
        </button>
      </div>
    </div>
  );
}
