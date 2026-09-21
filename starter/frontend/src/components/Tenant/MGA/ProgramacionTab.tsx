import { useState, useEffect } from 'react';
import { HelpCircle, PlusCircle, Trash2 } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore } from '../../../store/projectMgaStore';
import MgaAlert from './MgaAlert';

export default function ProgramacionTab({ project }: { project: Project }) {
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));
  const saveProgramacion = useProjectMgaStore((s) => s.saveProgramacion);
  const isSaving = useProjectMgaStore((s) => s.isSaving);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fuentes, setFuentes] = useState<any[]>([]);
  const [indicadores, setIndicadores] = useState<any[]>([]);

  useEffect(() => {
    if (formulation.programacion?.fuentes) {
      setFuentes(formulation.programacion.fuentes);
    }
    if (formulation.programacion?.indicadores) {
      setIndicadores(formulation.programacion.indicadores);
    }
  }, [formulation.programacion]);

  const handleAddFuente = () => {
    setFuentes([
      ...fuentes,
      {
        id: crypto.randomUUID(),
        entidad: '',
        fuente: '',
        valor: '',
      }
    ]);
  };

  const updateFuente = (id: string, field: string, value: string) => {
    setFuentes(fuentes.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const deleteFuente = (id: string) => {
    setFuentes(fuentes.filter(item => item.id !== id));
  };

  const handleAddIndicador = () => {
    setIndicadores([
      ...indicadores,
      {
        id: crypto.randomUUID(),
        nombre: '',
        meta: '',
        ano: new Date().getFullYear().toString(),
      }
    ]);
  };

  const updateIndicador = (id: string, field: string, value: string) => {
    setIndicadores(indicadores.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const deleteIndicador = (id: string) => {
    setIndicadores(indicadores.filter(item => item.id !== id));
  };

  const handleSave = async () => {
    setError(null);
    setMessage(null);
    try {
      await saveProgramacion(project.id, { fuentes, indicadores });
      setMessage('Programación guardada exitosamente.');
    } catch (err) {
      setError('Error al guardar programación');
    }
  };

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-sm">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">Programación de Indicadores y Financiación</h1>
        <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
      </div>

      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}
      {message && <MgaAlert message={message} variant="success" onDismiss={() => setMessage(null)} />}

      <div className="space-y-6">
        <div className="border rounded p-4 bg-gray-50 space-y-4">
          <h3 className="font-semibold text-gray-700">Programación de Indicadores de Producto</h3>
          <div className="overflow-x-auto border rounded bg-white">
            <table className="w-full text-left">
              <thead className="bg-[#6c757d] text-white">
                <tr>
                  <th className="p-2 border">Acciones</th>
                  <th className="p-2 border">Indicador de Producto</th>
                  <th className="p-2 border">Meta</th>
                  <th className="p-2 border text-center">Año</th>
                </tr>
              </thead>
              <tbody>
                {indicadores.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-gray-500">
                      No hay indicadores programados.
                    </td>
                  </tr>
                ) : (
                  indicadores.map((ind) => (
                    <tr key={ind.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 border text-center">
                        <button
                          type="button"
                          onClick={() => deleteIndicador(ind.id)}
                          className="p-1 bg-[#2980b9] text-white rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                      <td className="p-2 border">
                        <input spellCheck={true}
                          type="text"
                          maxLength={500}
                          value={ind.nombre}
                          onChange={(e) => updateIndicador(ind.id, 'nombre', e.target.value)}
                          className="w-full p-1 border rounded bg-white text-xs"
                          placeholder="Nombre del indicador..."
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
                          value={ind.meta}
                          onChange={(e) => {
                            if (e.target.value.length <= 22) updateIndicador(ind.id, 'meta', e.target.value);
                          }}
                          className="w-full p-1 border rounded bg-white text-xs text-right"
                          placeholder="Meta"
                        />
                      </td>
                      <td className="p-2 border">
                        <input spellCheck={true}
                          type="number"
                          value={ind.ano}
                          onChange={(e) => updateIndicador(ind.id, 'ano', e.target.value)}
                          className="w-full p-1 border rounded bg-white text-xs text-center"
                          placeholder="Año"
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
              onClick={handleAddIndicador}
              className="flex items-center gap-1 px-4 py-1.5 bg-[#2980b9] text-white font-semibold rounded"
            >
              <PlusCircle className="w-4 h-4" />
              Adicionar indicador
            </button>
          </div>
        </div>

        <div className="border rounded p-4 bg-gray-50 space-y-4">
          <h3 className="font-semibold text-gray-700">Fuentes de Financiación</h3>
          <div className="overflow-x-auto border rounded bg-white">
            <table className="w-full text-left">
              <thead className="bg-[#6c757d] text-white">
                <tr>
                  <th className="p-2 border">Acciones</th>
                  <th className="p-2 border">Entidad / Aportante</th>
                  <th className="p-2 border">Fuente</th>
                  <th className="p-2 border">Valor Total</th>
                </tr>
              </thead>
              <tbody>
                {fuentes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-gray-500">
                      No hay fuentes de financiación registradas.
                    </td>
                  </tr>
                ) : (
                  fuentes.map((f) => (
                    <tr key={f.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 border text-center">
                        <button
                          type="button"
                          onClick={() => deleteFuente(f.id)}
                          className="p-1 bg-[#2980b9] text-white rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                      <td className="p-2 border">
                        <input spellCheck={true}
                          type="text"
                          maxLength={250}
                          value={f.entidad}
                          onChange={(e) => updateFuente(f.id, 'entidad', e.target.value)}
                          className="w-full p-1 border rounded bg-white text-xs"
                          placeholder="Nombre de la entidad..."
                        />
                      </td>
                      <td className="p-2 border">
                        <select
                          value={f.fuente}
                          onChange={(e) => updateFuente(f.id, 'fuente', e.target.value)}
                          className="w-full p-1 border rounded bg-white text-xs"
                        >
                          <option value="">Seleccione...</option>
                          <option value="SGR">Sistema General de Regalías</option>
                          <option value="SGP">Sistema General de Participaciones</option>
                          <option value="Recursos Propios">Recursos Propios</option>
                          <option value="Presupuesto General">Presupuesto General de la Nación</option>
                          <option value="Crédito">Crédito</option>
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
                          value={f.valor}
                          onChange={(e) => {
                            if (e.target.value.length <= 22) updateFuente(f.id, 'valor', e.target.value);
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
              onClick={handleAddFuente}
              className="flex items-center gap-1 px-4 py-1.5 bg-[#2980b9] text-white font-semibold rounded"
            >
              <PlusCircle className="w-4 h-4" />
              Adicionar fuente
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 pt-4 border-t border-slate-200 flex justify-end">
        <button 
          type="button"
          onClick={() => void handleSave()} 
          disabled={isSaving}
          className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
          Guardar Programación
        </button>
      </div>
    </div>
  );
}
