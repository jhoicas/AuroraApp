import { useState, useEffect } from 'react';
import { HelpCircle, PlusCircle, Trash2 } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore } from '../../../store/projectMgaStore';
import MgaAlert from './MgaAlert';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';

export default function PrestamosTab({ project }: { project: Project }) {
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));
  const savePrestamos = useProjectMgaStore((s) => s.savePrestamos);
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
    if (formulation.prestamos?.items) {
      setItems(formulation.prestamos.items);
    }
  }, [formulation.prestamos]);

  const alternatives = formulation.alternatives.filter(a => a.proceeds_to_preparation);

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        alternativeId: '',
        entidad: '',
        tasa: '',
        plazo: '',
        gracia: '',
        sistema: '',
        credito: '',
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
      await savePrestamos(project.id, { items });
      setMessage('Préstamos guardados exitosamente.');
    } catch (err) {
      setError('Error al guardar préstamos');
    }
  };

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-sm">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">Préstamos</h1>
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
              <th className="p-2 border">Entidad financiera</th>
              <th className="p-2 border">Tasa (%)</th>
              <th className="p-2 border">Plazo</th>
              <th className="p-2 border">Gracia</th>
              <th className="p-2 border">Sistema</th>
              <th className="p-2 border">Crédito</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-4 text-center text-gray-500">
                  No hay préstamos registrados.
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
                      label="Entidad financiera"
                      htmlFor={`prestamo-entidad-${item.id}`}
                      compact
                      guidance="Indica la entidad financiera con la cual se adquiriría el préstamo."
                      askPrompt={`¿Qué entidad financiera es recomendable o común para el préstamo del proyecto "${project.name}" en el sector ${project.sector}?`}
                      fieldHelpKey="entidad_financiera"
                      projectContext={fieldProjectContext}
                      reactiveContext={item}
                      currentValue={item.entidad}
                      onAutoFill={(v) => updateItem(item.id, 'entidad', v)}
                      maxLength={500}
                    >
                      <input spellCheck={true}
                        type="text"
                        id={`prestamo-entidad-${item.id}`}
                        maxLength={500}
                        value={item.entidad}
                        onChange={(e) => updateItem(item.id, 'entidad', e.target.value)}
                        className="w-full p-1 border rounded bg-white text-xs mt-1"
                        placeholder="Entidad"
                      />
                    </AIAssistedField>
                  </td>
                  <td className="p-2 border">
                    <input spellCheck={true}
                      type="number"
                      min="0"
                      maxLength={5}
                      inputMode="numeric"
                      onKeyDown={(e) => {
                        if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                      }}
                      value={item.tasa}
                      onChange={(e) => {
                        if (e.target.value.length <= 5) updateItem(item.id, 'tasa', e.target.value);
                      }}
                      className="w-full p-1 border rounded bg-white text-xs text-right"
                      placeholder="%"
                    />
                  </td>
                  <td className="p-2 border">
                    <input spellCheck={true}
                      type="number"
                      min="0"
                      maxLength={2}
                      inputMode="numeric"
                      onKeyDown={(e) => {
                        if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault();
                      }}
                      value={item.plazo}
                      onChange={(e) => {
                        if (e.target.value.length <= 2) updateItem(item.id, 'plazo', e.target.value);
                      }}
                      className="w-full p-1 border rounded bg-white text-xs text-center"
                      placeholder="Meses"
                    />
                  </td>
                  <td className="p-2 border">
                    <input spellCheck={true}
                      type="number"
                      min="0"
                      maxLength={13}
                      inputMode="numeric"
                      onKeyDown={(e) => {
                        if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault();
                      }}
                      value={item.gracia}
                      onChange={(e) => {
                        if (e.target.value.length <= 13) updateItem(item.id, 'gracia', e.target.value);
                      }}
                      className="w-full p-1 border rounded bg-white text-xs text-center"
                      placeholder="Meses"
                    />
                  </td>
                  <td className="p-2 border">
                    <select
                      value={item.sistema}
                      onChange={(e) => updateItem(item.id, 'sistema', e.target.value)}
                      className="w-full p-1 border rounded bg-white text-xs"
                    >
                      <option value="">Seleccione...</option>
                      <option value="Cuota fija">Cuota fija</option>
                      <option value="Abono constante a capital">Abono constante</option>
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
                      value={item.credito}
                      onChange={(e) => {
                        if (e.target.value.length <= 22) updateItem(item.id, 'credito', e.target.value);
                      }}
                      className="w-full p-1 border rounded bg-white text-xs text-right"
                      placeholder="Valor crédito"
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
          Adicionar préstamo
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
          Guardar Préstamos
        </button>
      </div>
    </div>
  );
}
