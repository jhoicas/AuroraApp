import { useState, useEffect, useRef } from 'react';
import { HelpCircle, Pencil, PlusCircle, Trash2, X, Check, AlertTriangle } from 'lucide-react';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore, type NecesidadJson, type NecesidadHistoricoJson, type PreparacionData } from '../../../store/projectMgaStore';
import { useCatalogStore } from '../../../store/catalogStore';
import MgaAlert from './MgaAlert';
import { CountedTextarea } from '../../ui/CountedTextarea';

type NecesidadesTabProps = {
  project: Project;
};

const CURRENT_YEAR = new Date().getFullYear();

export default function NecesidadesTab({ project }: NecesidadesTabProps) {
  const getFormulation = useProjectMgaStore((s) => s.getFormulation);
  const savePreparacion = useProjectMgaStore((s) => s.savePreparacion);
  const isSaving = useProjectMgaStore((s) => s.isSaving);

  const measurementUnits = useCatalogStore((s) => s.measurementUnits);
  const fetchAllMeasurementUnits = useCatalogStore((s) => s.fetchAllMeasurementUnits);

  const formulation = getFormulation(project.id);
  const alternativas = formulation?.identificacion?.alternativas || [];
  
  const initialPreparacion = formulation?.preparacion;

  const [necesidadesPorAlternativa, setNecesidadesPorAlternativa] = useState<Record<string, NecesidadJson[]>>(() => initialPreparacion?.necesidades || {});
  const [selectedAlternativaId, setSelectedAlternativaId] = useState<string>(alternativas.length > 0 ? alternativas[0].id : '');

  const currentNecesidades = selectedAlternativaId ? (necesidadesPorAlternativa[selectedAlternativaId] || []) : [];

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form draft
  const [bienServicio, setBienServicio] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [descripcionOferta, setDescripcionOferta] = useState('');
  const [descripcionDemanda, setDescripcionDemanda] = useState('');
  const [unidadMedidaId, setUnidadMedidaId] = useState<string>('');
  const [anoInicial, setAnoInicial] = useState<number>(CURRENT_YEAR - 5);
  const [anoFinal, setAnoFinal] = useState<number>(CURRENT_YEAR);
  const [ultimoAnoProyectado, setUltimoAnoProyectado] = useState<number>(CURRENT_YEAR + 10);
  const [historico, setHistorico] = useState<NecesidadHistoricoJson[]>([]);

  const [error, setError] = useState<string | null>(null);

  const prevProjectIdRef = useRef(project.id);
  const isFirstMount = useRef(true);
  const lastSavedRef = useRef<string>(JSON.stringify({
    necesidades: initialPreparacion?.necesidades || {},
  }));

  useEffect(() => {
    void fetchAllMeasurementUnits();
  }, [fetchAllMeasurementUnits]);

  // Sync state if project changes
  useEffect(() => {
    if (prevProjectIdRef.current !== project.id) {
      prevProjectIdRef.current = project.id;
      const currentData = useProjectMgaStore.getState().getFormulation(project.id)?.preparacion;
      setNecesidadesPorAlternativa(currentData?.necesidades || {});
      lastSavedRef.current = JSON.stringify({
        necesidades: currentData?.necesidades || {},
      });
      const alts = useProjectMgaStore.getState().getFormulation(project.id)?.identificacion?.alternativas || [];
      setSelectedAlternativaId(alts.length > 0 ? alts[0].id : '');
      setIsAdding(false);
      setEditingId(null);
    }
  }, [project.id]);

  // Auto-save effect
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    const data: PreparacionData = {
      necesidades: necesidadesPorAlternativa,
    };

    const serialized = JSON.stringify(data);
    if (serialized === lastSavedRef.current) return;
    lastSavedRef.current = serialized;

    void savePreparacion(project.id, data);
  }, [necesidadesPorAlternativa, project.id, savePreparacion]);

  // Regenerate historico dynamically when dates change during editing
  useEffect(() => {
    if (isAdding) {
      setHistorico(prevHistorico => {
        const newHistorico: NecesidadHistoricoJson[] = [];
        if (anoInicial <= anoFinal) {
          for (let y = anoInicial; y <= anoFinal; y++) {
            const existing = prevHistorico.find(h => h.ano === y);
            newHistorico.push({
              ano: y,
              oferta: existing?.oferta || 0,
              demanda: existing?.demanda || 0,
              deficit: (existing?.oferta || 0) - (existing?.demanda || 0)
            });
          }
        }
        return newHistorico;
      });
    }
  }, [anoInicial, anoFinal, isAdding]);

  const updateHistoricoRow = (index: number, field: 'oferta' | 'demanda', value: number) => {
    setHistorico(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      copy[index].deficit = copy[index].oferta - copy[index].demanda;
      return copy;
    });
  };

  const openForm = (item?: NecesidadJson) => {
    setError(null);
    if (item) {
      setEditingId(item.id);
      setBienServicio(item.bienServicio);
      setDescripcion(item.descripcion);
      setDescripcionOferta(item.descripcionOferta);
      setDescripcionDemanda(item.descripcionDemanda);
      setUnidadMedidaId(String(item.unidadMedidaId));
      setAnoInicial(item.anoInicial);
      setAnoFinal(item.anoFinal);
      setUltimoAnoProyectado(item.ultimoAnoProyectado);
      setHistorico(item.historico || []);
    } else {
      setEditingId(null);
      setBienServicio('');
      setDescripcion('');
      setDescripcionOferta('');
      setDescripcionDemanda('');
      setUnidadMedidaId('');
      setAnoInicial(CURRENT_YEAR - 5);
      setAnoFinal(CURRENT_YEAR);
      setUltimoAnoProyectado(CURRENT_YEAR + 10);
      setHistorico([]);
    }
    setIsAdding(true);
  };

  const closeForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setError(null);
  };

  const handleSave = () => {
    if (!selectedAlternativaId) {
      setError('Debe seleccionar una alternativa.');
      return;
    }
    if (!bienServicio.trim()) {
      setError('El Bien o Servicio es obligatorio.');
      return;
    }
    if (!unidadMedidaId) {
      setError('Debe seleccionar una unidad de medida.');
      return;
    }
    if (anoInicial > anoFinal) {
      setError('El Año inicial no puede ser mayor al Año final.');
      return;
    }
    if (ultimoAnoProyectado < anoFinal) {
      setError('El Último año proyectado debe ser mayor o igual al Año final.');
      return;
    }
    setError(null);

    const newItem: NecesidadJson = {
      id: editingId || crypto.randomUUID(),
      bienServicio: bienServicio.trim(),
      descripcion: descripcion.trim(),
      descripcionOferta: descripcionOferta.trim(),
      descripcionDemanda: descripcionDemanda.trim(),
      unidadMedidaId,
      anoInicial,
      anoFinal,
      ultimoAnoProyectado,
      historico
    };

    setNecesidadesPorAlternativa(prev => {
      const currentList = prev[selectedAlternativaId] || [];
      if (editingId) {
        return {
          ...prev,
          [selectedAlternativaId]: currentList.map(i => i.id === editingId ? newItem : i)
        };
      } else {
        return {
          ...prev,
          [selectedAlternativaId]: [...currentList, newItem]
        };
      }
    });

    closeForm();
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('¿Eliminar esta necesidad?')) return;
    setNecesidadesPorAlternativa(prev => {
      const currentList = prev[selectedAlternativaId] || [];
      return {
        ...prev,
        [selectedAlternativaId]: currentList.filter(i => i.id !== id)
      };
    });
  };

  if (alternativas.length === 0) {
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md flex gap-3 text-sm">
        <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
        <div className="text-yellow-700">
          <p className="font-bold">No hay alternativas creadas.</p>
          <p>Para registrar las necesidades de su proyecto, primero debe crear al menos una alternativa en la pestaña de Identificación.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-normal text-[#2980b9]">Estudio de necesidades</h1>
          <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
        </div>
        {isSaving && (
          <div className="flex items-center gap-2 text-emerald-600 font-medium">
             <div className="w-4 h-4 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" /> Guardando...
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 bg-slate-50 p-3 rounded border">
        <label className="font-semibold text-slate-700 whitespace-nowrap">Alternativa:</label>
        <select
          value={selectedAlternativaId}
          onChange={(e) => {
            setSelectedAlternativaId(e.target.value);
            closeForm();
          }}
          className="flex-1 p-2 border border-slate-300 rounded bg-white focus:border-[#2980b9] focus:ring-[#2980b9] outline-none"
        >
          {alternativas.map(alt => (
            <option key={alt.id} value={alt.id}>{alt.nombre}</option>
          ))}
        </select>
      </div>

      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}

      {!isAdding ? (
        <div className="space-y-4 mt-4">
          <div className="flex justify-end">
            <button
              type="button"
              disabled={isSaving || !selectedAlternativaId}
              onClick={() => openForm()}
              className="flex items-center gap-1 px-4 py-1.5 bg-[#2980b9] text-white font-semibold rounded disabled:opacity-60"
            >
              <PlusCircle className="w-4 h-4" />
              Adicionar
            </button>
          </div>
          <div className="overflow-x-auto border rounded">
            <table className="w-full text-left">
              <thead className="bg-[#6c757d] text-white">
                <tr>
                  <th className="p-2 border">Acciones</th>
                  <th className="p-2 border">Bien o servicio</th>
                  <th className="p-2 border">Medido a través de</th>
                  <th className="p-2 border">Descripción</th>
                  <th className="p-2 border">Inicio historia</th>
                  <th className="p-2 border">Final historia</th>
                  <th className="p-2 border">Último año</th>
                </tr>
              </thead>
              <tbody>
                {currentNecesidades.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-gray-500">
                      No se han adicionado bienes o servicios a esta alternativa.
                    </td>
                  </tr>
                ) : (
                  currentNecesidades.map((item) => {
                    const unidadNombre = measurementUnits.find(u => String(u.id) === String(item.unidadMedidaId))?.name || 'N/A';
                    return (
                      <tr key={item.id} className="border-b hover:bg-gray-50 align-top">
                        <td className="p-2 border text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openForm(item)}
                            disabled={isSaving}
                            className="p-1 bg-[#2980b9] text-white rounded mr-1 disabled:opacity-60"
                            aria-label="Editar"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            disabled={isSaving}
                            className="p-1 bg-[#2980b9] text-white rounded disabled:opacity-60"
                            aria-label="Eliminar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                        <td className="p-2 border font-medium text-slate-800">{item.bienServicio}</td>
                        <td className="p-2 border">{unidadNombre}</td>
                        <td className="p-2 border truncate max-w-xs" title={item.descripcion}>{item.descripcion}</td>
                        <td className="p-2 border text-center">{item.anoInicial}</td>
                        <td className="p-2 border text-center">{item.anoFinal}</td>
                        <td className="p-2 border text-center">{item.ultimoAnoProyectado}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="border rounded p-4 bg-gray-50 space-y-4 mt-4">
          <h3 className="font-semibold text-slate-700">{editingId ? 'Editar Necesidad' : 'Nueva Necesidad'}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AIAssistedField
              label="Bien o servicio"
              htmlFor={`ns-bien-${project.id}`}
              required
              currentValue={bienServicio}
              onAutoFill={setBienServicio}
              maxLength={200}
            >
              <input
                id={`ns-bien-${project.id}`}
                type="text"
                value={bienServicio}
                onChange={(e) => setBienServicio(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded bg-white focus:border-[#2980b9] focus:ring-[#2980b9] outline-none"
              />
            </AIAssistedField>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Unidad de medida <span className="text-red-500">*</span></label>
              <select
                value={unidadMedidaId}
                onChange={(e) => setUnidadMedidaId(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded bg-white focus:border-[#2980b9] focus:ring-[#2980b9] outline-none"
              >
                <option value="">Seleccione una unidad...</option>
                {measurementUnits.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            
            <div className="md:col-span-2">
              <AIAssistedField
                label="Descripción del bien o servicio"
                htmlFor={`ns-desc-${project.id}`}
                currentValue={descripcion}
                onAutoFill={setDescripcion}
                maxLength={500}
              >
                <CountedTextarea
                  id={`ns-desc-${project.id}`}
                  rows={2}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded bg-white focus:border-[#2980b9] focus:ring-[#2980b9] outline-none"
                />
              </AIAssistedField>
            </div>

            <div>
              <AIAssistedField
                label="Descripción de la Oferta"
                htmlFor={`ns-oferta-${project.id}`}
                currentValue={descripcionOferta}
                onAutoFill={setDescripcionOferta}
                maxLength={500}
              >
                <CountedTextarea
                  id={`ns-oferta-${project.id}`}
                  rows={3}
                  value={descripcionOferta}
                  onChange={(e) => setDescripcionOferta(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded bg-white focus:border-[#2980b9] focus:ring-[#2980b9] outline-none"
                />
              </AIAssistedField>
            </div>

            <div>
              <AIAssistedField
                label="Descripción de la Demanda"
                htmlFor={`ns-demanda-${project.id}`}
                currentValue={descripcionDemanda}
                onAutoFill={setDescripcionDemanda}
                maxLength={500}
              >
                <CountedTextarea
                  id={`ns-demanda-${project.id}`}
                  rows={3}
                  value={descripcionDemanda}
                  onChange={(e) => setDescripcionDemanda(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded bg-white focus:border-[#2980b9] focus:ring-[#2980b9] outline-none"
                />
              </AIAssistedField>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold text-slate-700 mb-3 text-sm">Configuración de Serie Histórica</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-slate-600 mb-1">Año inicial</label>
                <input
                  type="number"
                  value={anoInicial}
                  onChange={(e) => setAnoInicial(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded bg-white focus:border-[#2980b9] focus:ring-[#2980b9] outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Año final</label>
                <input
                  type="number"
                  value={anoFinal}
                  onChange={(e) => setAnoFinal(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded bg-white focus:border-[#2980b9] focus:ring-[#2980b9] outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Último año proyectado</label>
                <input
                  type="number"
                  value={ultimoAnoProyectado}
                  onChange={(e) => setUltimoAnoProyectado(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded bg-white focus:border-[#2980b9] focus:ring-[#2980b9] outline-none"
                />
              </div>
            </div>

            {historico.length > 0 && (
              <div className="overflow-x-auto border rounded bg-white">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="p-2 border w-24 text-center">Año</th>
                      <th className="p-2 border">Oferta</th>
                      <th className="p-2 border">Demanda</th>
                      <th className="p-2 border">Déficit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historico.map((row, index) => (
                      <tr key={row.ano} className="border-b">
                        <td className="p-2 border text-center font-medium bg-slate-50">{row.ano}</td>
                        <td className="p-2 border">
                          <input
                            type="number"
                            step="any"
                            value={row.oferta}
                            onChange={(e) => updateHistoricoRow(index, 'oferta', Number(e.target.value))}
                            className="w-full p-1 border border-slate-300 rounded outline-none"
                          />
                        </td>
                        <td className="p-2 border">
                          <input
                            type="number"
                            step="any"
                            value={row.demanda}
                            onChange={(e) => updateHistoricoRow(index, 'demanda', Number(e.target.value))}
                            className="w-full p-1 border border-slate-300 rounded outline-none"
                          />
                        </td>
                        <td className="p-2 border text-right font-medium">
                          <span className={row.deficit < 0 ? 'text-red-600' : 'text-slate-800'}>
                            {row.deficit.toLocaleString('es-CO')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={closeForm}
              className="inline-flex items-center gap-1 px-4 py-1.5 border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors rounded text-sm"
            >
              <X className="w-4 h-4" /> Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1 px-4 py-1.5 bg-[#2980b9] text-white font-medium hover:bg-[#20638f] transition-colors shadow-sm rounded text-sm"
            >
              <Check className="w-4 h-4" /> {editingId ? 'Actualizar' : 'Aceptar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
