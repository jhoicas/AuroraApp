import { useState, useEffect } from 'react';
import { HelpCircle, PlusCircle, Trash2 } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore } from '../../../store/projectMgaStore';
import MgaAlert from './MgaAlert';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';

export default function IngresosBeneficiosTab({ project }: { project: Project }) {
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));
  const saveIngresosBeneficios = useProjectMgaStore((s) => s.saveIngresosBeneficios);
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
    if (formulation.ingresosBeneficios?.items) {
      setItems(formulation.ingresosBeneficios.items);
    }
  }, [formulation.ingresosBeneficios]);

  const alternatives = formulation.alternatives.filter(a => a.proceeds_to_preparation);

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        alternativeId: '',
        bienServicio: '',
        tipo: '',
        unidad: '',
        descripcion: '',
        cantidad: '',
        valorUnitario: '',
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
      await saveIngresosBeneficios(project.id, { items });
      setMessage('Ingresos y beneficios guardados exitosamente.');
    } catch (err) {
      setError('Error al guardar ingresos y beneficios');
    }
  };

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-sm">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">Ingresos y Beneficios</h1>
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
              <th className="p-2 border">Bien / Servicio</th>
              <th className="p-2 border">Tipo</th>
              <th className="p-2 border">Unidad</th>
              <th className="p-2 border">Descripción</th>
              <th className="p-2 border">Cantidad</th>
              <th className="p-2 border">Valor unit.</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-4 text-center text-gray-500">
                  No hay ingresos/beneficios registrados.
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
                      label="Bien o servicio"
                      htmlFor={`ingreso-bien-${item.id}`}
                      compact
                      guidance="Describe el bien o servicio que genera el ingreso/beneficio."
                      askPrompt={`¿Qué bien o servicio genera ingresos o beneficios para la alternativa seleccionada en el proyecto "${project.name}"?`}
                      fieldHelpKey="bien_servicio"
                      projectContext={fieldProjectContext}
                      reactiveContext={item}
                      currentValue={item.bienServicio}
                      onAutoFill={(v) => updateItem(item.id, 'bienServicio', v)}
                      maxLength={250}
                    >
                      <input spellCheck={true}
                        type="text"
                        id={`ingreso-bien-${item.id}`}
                        maxLength={250}
                        value={item.bienServicio}
                        onChange={(e) => updateItem(item.id, 'bienServicio', e.target.value)}
                        className="w-full p-1 border rounded bg-white text-xs mt-1"
                        placeholder="Bien o servicio"
                      />
                    </AIAssistedField>
                  </td>
                  <td className="p-2 border">
                    <select
                      value={item.tipo}
                      onChange={(e) => updateItem(item.id, 'tipo', e.target.value)}
                      className="w-full p-1 border rounded bg-white text-xs"
                    >
                      <option value="">Seleccione...</option>
                      <option value="Ingreso">Ingreso</option>
                      <option value="Beneficio">Beneficio</option>
                    </select>
                  </td>
                  <td className="p-2 border">
                    <select
                      value={item.unidad}
                      onChange={(e) => updateItem(item.id, 'unidad', e.target.value)}
                      className="w-full p-1 border rounded bg-white text-xs"
                    >
                      <option value="">Seleccione...</option>
                      <option value="Pesos">Pesos</option>
                      <option value="Porcentaje">Porcentaje</option>
                    </select>
                  </td>
                  <td className="p-2 border relative group">
                    <AIAssistedField
                      label="Descripción"
                      htmlFor={`ingreso-desc-${item.id}`}
                      compact
                      guidance="Proporciona detalles adicionales sobre el ingreso o beneficio."
                      askPrompt={`¿Cómo describo el ingreso o beneficio para la alternativa seleccionada en el proyecto "${project.name}"?`}
                      fieldHelpKey="descripcion_ingreso_beneficio"
                      projectContext={fieldProjectContext}
                      reactiveContext={item}
                      currentValue={item.descripcion}
                      onAutoFill={(v) => updateItem(item.id, 'descripcion', v)}
                      maxLength={2500}
                    >
                      <textarea spellCheck={true}
                        id={`ingreso-desc-${item.id}`}
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
                    <input spellCheck={true}
                      type="number"
                      min="0"
                      maxLength={22}
                      inputMode="numeric"
                      onKeyDown={(e) => {
                        if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                      }}
                      value={item.cantidad}
                      onChange={(e) => {
                        if (e.target.value.length <= 22) updateItem(item.id, 'cantidad', e.target.value);
                      }}
                      className="w-full p-1 border rounded bg-white text-xs text-right"
                      placeholder="Cantidad"
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
                      value={item.valorUnitario}
                      onChange={(e) => {
                        if (e.target.value.length <= 22) updateItem(item.id, 'valorUnitario', e.target.value);
                      }}
                      className="w-full p-1 border rounded bg-white text-xs text-right"
                      placeholder="Valor Unit."
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
          Adicionar ingreso/beneficio
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
          Guardar Ingresos/Beneficios
        </button>
      </div>
    </div>
  );
}
