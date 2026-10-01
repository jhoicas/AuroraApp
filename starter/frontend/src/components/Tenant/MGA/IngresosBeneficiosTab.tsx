import { useState, useEffect, useRef, useCallback } from 'react';
import { HelpCircle, AlertTriangle, Plus, Trash2, Edit2, X, CheckCircle2 } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import {
  useProjectMgaStore,
  debouncedPatchProject,
  type IngresoBeneficioJson,
} from '../../../store/projectMgaStore';
import MgaAlert from './MgaAlert';
import MgaAccordion from './MgaAccordion';
import { CountedTextarea } from '../../ui/CountedTextarea';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_PERIODOS = 12;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

function emptyIngresoBeneficio(): IngresoBeneficioJson {
  return {
    id: uuid(),
    tipo: 'Ingresos',
    descripcion: '',
    descripcionCantidad: '',
    unidadMedidaId: '',
    descripcionValorUnitario: '',
    bienProducidoId: '',
    rpc: 1,
    proyecciones: Array.from({ length: MAX_PERIODOS }, (_, i) => ({
      periodo: i,
      cantidad: 0,
      valorUnitario: 0,
      valorTotal: 0,
    })),
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

// ─── Component ───────────────────────────────────────────────────────────────

type IngresoBeneficioFormProps = {
  item: IngresoBeneficioJson;
  productos: { id: string; nombre: string }[];
  onSave: (item: IngresoBeneficioJson) => void;
  onClose: () => void;
};

function IngresoBeneficioForm({ item: initial, productos, onSave, onClose }: IngresoBeneficioFormProps) {
  const [draft, setDraft] = useState<IngresoBeneficioJson>({ ...initial });
  const [step, setStep] = useState<1 | 2>(1);

  const updateField = <K extends keyof IngresoBeneficioJson>(field: K, value: IngresoBeneficioJson[K]) => {
    setDraft(prev => ({ ...prev, [field]: value }));
  };

  const updateProyeccion = (periodo: number, field: 'cantidad' | 'valorUnitario', rawValue: string) => {
    const val = parseFloat(rawValue) || 0;
    setDraft(prev => {
      const proys = [...prev.proyecciones];
      const p = { ...proys[periodo] };
      p[field] = val;
      p.valorTotal = p.cantidad * p.valorUnitario;
      proys[periodo] = p;
      return { ...prev, proyecciones: proys };
    });
  };

  const handleNext = () => {
    if (!draft.descripcion.trim() || !draft.unidadMedidaId.trim() || !draft.bienProducidoId) {
      alert('Por favor complete la descripción, medido a través de y el bien producido.');
      return;
    }
    setStep(2);
  };

  const handleSubmit = () => {
    onSave(draft);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50 rounded-t-xl">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">
              {initial.descripcion ? 'Editar ingreso o beneficio' : 'Adicionar ingreso o beneficio'}
            </h3>
            <div className="flex gap-2 mt-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${step === 1 ? 'bg-[#2980b9] text-white' : 'bg-slate-200 text-slate-600'}`}>1. Información básica</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${step === 2 ? 'bg-[#2980b9] text-white' : 'bg-slate-200 text-slate-600'}`}>2. Matriz de periodos</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo <span className="text-red-500">*</span></label>
                  <select value={draft.tipo} onChange={e => updateField('tipo', e.target.value as 'Ingresos' | 'Beneficios')} className="w-full p-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-[#2980b9]">
                    <option value="Ingresos">Ingresos</option>
                    <option value="Beneficios">Beneficios</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Medido a través de (Unidad) <span className="text-red-500">*</span></label>
                  <select value={draft.unidadMedidaId} onChange={e => updateField('unidadMedidaId', e.target.value)} className="w-full p-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-[#2980b9]">
                    <option value="">Seleccione...</option>
                    <option value="Pesos">Pesos</option>
                    <option value="Porcentaje">Porcentaje</option>
                    <option value="Unidades">Unidades</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bien producido <span className="text-red-500">*</span></label>
                <select value={draft.bienProducidoId} onChange={e => updateField('bienProducidoId', e.target.value)} className="w-full p-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-[#2980b9]">
                  <option value="">Seleccione un producto de la cadena de valor...</option>
                  {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
                {productos.length === 0 && <p className="text-xs text-amber-600 mt-1">No hay productos en la cadena de valor.</p>}
              </div>

              <AIAssistedField
                label="Descripción"
                htmlFor={`ingreso-descripcion-${draft.id}`}
                required
                fieldHelpKey="ingreso_beneficio_descripcion"
                reactiveContext={{ tipo: draft.tipo }}
                onAutoFill={(value) => updateField('descripcion', value)}
                guidance="Describa el ingreso o beneficio y su relación con el bien o servicio del proyecto."
                askPrompt="Ayúdame a redactar la descripción de un ingreso o beneficio MGA."
              >
                <CountedTextarea id={`ingreso-descripcion-${draft.id}`} value={draft.descripcion} onChange={e => updateField('descripcion', e.target.value)} rows={2} maxLength={500} className="w-full resize-y rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-[#2980b9]" />
              </AIAssistedField>

              <div className="grid grid-cols-2 gap-4">
                <AIAssistedField
                  label="Descripción de la cantidad"
                  htmlFor={`ingreso-cantidad-${draft.id}`}
                  fieldHelpKey="ingreso_beneficio_cantidad"
                  reactiveContext={{ descripcion: draft.descripcion }}
                  onAutoFill={(value) => updateField('descripcionCantidad', value)}
                  guidance="Explique qué representa la cantidad y cómo se cuantifica en el proyecto."
                  askPrompt="Ayúdame a describir la cantidad de un ingreso o beneficio MGA."
                >
                  <CountedTextarea id={`ingreso-cantidad-${draft.id}`} value={draft.descripcionCantidad} onChange={e => updateField('descripcionCantidad', e.target.value)} rows={2} maxLength={500} className="w-full resize-y rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-[#2980b9]" />
                </AIAssistedField>
                <AIAssistedField
                  label="Descripción del valor unitario"
                  htmlFor={`ingreso-valor-unitario-${draft.id}`}
                  fieldHelpKey="ingreso_beneficio_valor_unitario"
                  reactiveContext={{ descripcion: draft.descripcion }}
                  onAutoFill={(value) => updateField('descripcionValorUnitario', value)}
                  guidance="Explique cómo se determina el valor unitario utilizado en la proyección."
                  askPrompt="Ayúdame a describir el valor unitario de un ingreso o beneficio MGA."
                >
                  <CountedTextarea id={`ingreso-valor-unitario-${draft.id}`} value={draft.descripcionValorUnitario} onChange={e => updateField('descripcionValorUnitario', e.target.value)} rows={2} maxLength={500} className="w-full resize-y rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-[#2980b9]" />
                </AIAssistedField>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Razón Precio Cuenta (RPC)</label>
                <input type="number" step="0.01" min="0" value={draft.rpc} onChange={e => updateField('rpc', parseFloat(e.target.value) || 0)} className="w-full p-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-[#2980b9]" />
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-slate-600 mb-4">Ingrese la cantidad y el valor unitario para cada periodo. El valor total se calculará automáticamente.</p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#2980b9] text-white">
                    <th className="p-2 border border-[#2471a3] text-center w-24">Periodo</th>
                    <th className="p-2 border border-[#2471a3]">Cantidad</th>
                    <th className="p-2 border border-[#2471a3]">Valor Unitario</th>
                    <th className="p-2 border border-[#2471a3] text-right bg-[#1a5276]">Valor Total</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.proyecciones.map(p => (
                    <tr key={p.periodo} className="border-b hover:bg-slate-50">
                      <td className="p-2 border text-center font-medium bg-slate-50">Año {p.periodo}</td>
                      <td className="p-1 border">
                        <input type="number" min="0" value={p.cantidad || ''} onChange={e => updateProyeccion(p.periodo, 'cantidad', e.target.value)} className="w-full p-1.5 text-right border border-slate-200 rounded outline-none focus:border-[#2980b9]" placeholder="0" />
                      </td>
                      <td className="p-1 border">
                        <input type="number" min="0" value={p.valorUnitario || ''} onChange={e => updateProyeccion(p.periodo, 'valorUnitario', e.target.value)} className="w-full p-1.5 text-right border border-slate-200 rounded outline-none focus:border-[#2980b9]" placeholder="0" />
                      </td>
                      <td className="p-2 border text-right font-semibold bg-slate-50 text-slate-700">
                        {formatCurrency(p.valorTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-emerald-50 text-emerald-800 font-bold">
                    <td colSpan={3} className="p-2 border text-right">Sumatoria Total:</td>
                    <td className="p-2 border text-right text-sm">
                      {formatCurrency(draft.proyecciones.reduce((acc, p) => acc + p.valorTotal, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t bg-slate-50 rounded-b-xl">
          {step === 2 ? (
            <button onClick={() => setStep(1)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">Atrás</button>
          ) : (
            <div />
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">Cancelar</button>
            {step === 1 ? (
              <button onClick={handleNext} className="px-5 py-2 text-sm bg-[#006162] text-white rounded-lg hover:bg-[#004d4e] transition-colors font-medium shadow-sm">Siguiente</button>
            ) : (
              <button onClick={handleSubmit} className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Guardar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Tab ────────────────────────────────────────────────────────────────

type IngresosBeneficiosTabProps = {
  project: Project;
};

export default function IngresosBeneficiosTab({ project }: IngresosBeneficiosTabProps) {
  const getFormulation = useProjectMgaStore((s) => s.getFormulation);
  const isSaving = useProjectMgaStore((s) => s.isSaving);

  const formulation = getFormulation(project.id);
  const alternativasAll = formulation.identificacion?.alternativas || [];
  const alternatives = alternativasAll.filter((alt: any) => alt.pasaPreparacion === true);

  const [selectedAlternativeId, setSelectedAlternativeId] = useState<string>(alternatives.length > 0 ? alternatives[0].id : '');
  const [items, setItems] = useState<IngresoBeneficioJson[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<IngresoBeneficioJson | null>(null);
  const [showForm, setShowForm] = useState(false);

  const prevProjectIdRef = useRef(project.id);
  const isFirstMount = useRef(true);
  const lastSavedRef = useRef<string>('[]');

  // Get products from cadena valor for the dropdown
  const productos = (() => {
    if (!selectedAlternativeId) return [];
    const cv = formulation.preparacion?.cadenaValorPrep?.[selectedAlternativeId];
    if (!cv) return [];
    const prods: { id: string; nombre: string }[] = [];
    Object.values(cv.objetivos).forEach(obj => {
      obj.productos.forEach(p => {
        prods.push({ id: p.id, nombre: p.complemento || p.productoId || `Producto ${p.id.slice(0, 6)}` });
      });
    });
    return prods;
  })();

  const getProductName = (id: string) => productos.find(p => p.id === id)?.nombre || '—';

  const loadAlternativeData = useCallback((altId: string) => {
    const f = useProjectMgaStore.getState().getFormulation(project.id);
    const altItems = f.preparacion?.ingresosBeneficios?.[altId] || [];
    setItems(altItems);
    lastSavedRef.current = JSON.stringify(altItems);
  }, [project.id]);

  const storeIngresos = useProjectMgaStore((s) => s.getFormulation(project.id)?.preparacion?.ingresosBeneficios);

  useEffect(() => {
    if (storeIngresos && selectedAlternativeId) {
      const altItems = storeIngresos[selectedAlternativeId] || [];
      const serialized = JSON.stringify(altItems);
      if (serialized !== lastSavedRef.current) {
        setItems(altItems);
        lastSavedRef.current = serialized;
      }
    }
  }, [storeIngresos, selectedAlternativeId]);

  useEffect(() => {
    if (prevProjectIdRef.current !== project.id) {
      prevProjectIdRef.current = project.id;
      isFirstMount.current = true;
    }
    const f = useProjectMgaStore.getState().getFormulation(project.id);
    const altsAll = f.identificacion?.alternativas || [];
    const alts = altsAll.filter((a: any) => a.pasaPreparacion === true);

    if (alts.length > 0) {
      const altId = selectedAlternativeId && alts.some((a: any) => a.id === selectedAlternativeId) ? selectedAlternativeId : alts[0].id;
      setSelectedAlternativeId(altId);
      loadAlternativeData(altId);
    } else {
      setSelectedAlternativeId('');
      setItems([]);
      lastSavedRef.current = '[]';
    }
  }, [project.id, loadAlternativeData]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (!selectedAlternativeId) return;

    const serialized = JSON.stringify(items);
    if (serialized === lastSavedRef.current) return;
    lastSavedRef.current = serialized;

    const f = useProjectMgaStore.getState().getFormulation(project.id);
    const currentPrep = f.preparacion || { necesidades: {} };
    const currentIngr = currentPrep.ingresosBeneficios || {};
    const updatedIngr = { ...currentIngr, [selectedAlternativeId]: items };
    const newPrep = { ...currentPrep, ingresosBeneficios: updatedIngr };

    useProjectMgaStore.setState((state) => {
      const fm = state.byProjectId[project.id] || { causeRelations: [], generalIndicators: [], effects: [], participants: [], populations: [], alternatives: [], completedSections: {} };
      return {
        byProjectId: {
          ...state.byProjectId,
          [project.id]: { ...fm, preparacion: newPrep, completedSections: { ...fm.completedSections, 'ingresos-beneficios': true } },
        },
        isSaving: true,
      };
    });

    debouncedPatchProject(project.id, { preparacion: newPrep, completedSections: { ...f.completedSections, 'ingresos-beneficios': true } });
  }, [items, selectedAlternativeId, project.id]);

  const handleAlternativeChange = (newAltId: string) => {
    setSelectedAlternativeId(newAltId);
    isFirstMount.current = true;
    loadAlternativeData(newAltId);
  };

  const handleSaveItem = (item: IngresoBeneficioJson) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === item.id);
      if (idx >= 0) return prev.map((old, i) => i === idx ? item : old);
      return [...prev, item];
    });
    setShowForm(false);
    setEditingItem(null);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('¿Eliminar este registro?')) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const totalesGlobales = Array.from({ length: MAX_PERIODOS }, (_, i) => {
    const totalIngresos = items.filter(it => it.tipo === 'Ingresos').reduce((acc, it) => acc + (it.proyecciones[i]?.valorTotal || 0), 0);
    const totalBeneficios = items.filter(it => it.tipo === 'Beneficios').reduce((acc, it) => acc + (it.proyecciones[i]?.valorTotal || 0), 0);
    return {
      periodo: i,
      totalIngresos,
      totalBeneficios,
      totalGeneral: totalIngresos + totalBeneficios,
    };
  });

  if (alternatives.length === 0) {
    return (
      <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
        <div className="flex items-center gap-2 border-b pb-3">
          <h1 className="text-xl font-normal text-[#2980b9]">Ingresos y Beneficios</h1>
          <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
        </div>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md flex gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
          <div className="text-yellow-700">
            <p className="font-bold">No hay alternativas que pasen a preparación.</p>
            <p>Por favor, diríjase a la pestaña de "Identificación", módulo "Alternativas", y asegúrese de que al menos una alternativa tenga habilitada la opción "Pasa a preparación".</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-normal text-[#2980b9]">Ingresos y Beneficios</h1>
          <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
        </div>
        {isSaving && (
          <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm">
            <div className="w-4 h-4 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" /> Guardando...
          </div>
        )}
      </div>

      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}

      <div className="flex items-center gap-4 bg-slate-50 p-3 rounded border">
        <label className="font-semibold text-slate-700 whitespace-nowrap">Alternativa:</label>
        <select
          value={selectedAlternativeId}
          onChange={(e) => handleAlternativeChange(e.target.value)}
          className="flex-1 p-2 border border-slate-300 rounded bg-white outline-none focus:border-[#2980b9]"
        >
          {alternatives.map((alt: any) => (
            <option key={alt.id} value={alt.id}>{alt.nombre}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#6c757d] text-white text-xs">
              <th className="p-2 border border-[#5a6268]">Tipo</th>
              <th className="p-2 border border-[#5a6268]">Descripción</th>
              <th className="p-2 border border-[#5a6268]">Medido a través de</th>
              <th className="p-2 border border-[#5a6268]">Bien producido</th>
              <th className="p-2 border border-[#5a6268]">RPC</th>
              <th className="p-2 border border-[#5a6268] text-center w-20">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-500">No hay ingresos ni beneficios registrados.</td>
              </tr>
            ) : (
              items.map(it => (
                <tr key={it.id} className="border-b hover:bg-slate-50 align-top">
                  <td className="p-2 border font-medium text-slate-700">{it.tipo}</td>
                  <td className="p-2 border text-slate-600 max-w-[200px] truncate" title={it.descripcion}>{it.descripcion}</td>
                  <td className="p-2 border">{it.unidadMedidaId}</td>
                  <td className="p-2 border text-blue-700 text-[10px]">{getProductName(it.bienProducidoId)}</td>
                  <td className="p-2 border text-right">{it.rpc.toFixed(2)}</td>
                  <td className="p-2 border text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => { setEditingItem(it); setShowForm(true); }} className="p-1 text-blue-500 hover:bg-blue-50 rounded" title="Editar"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(it.id)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <button
        onClick={() => { setEditingItem(emptyIngresoBeneficio()); setShowForm(true); }}
        className="w-full py-2.5 border-2 border-dashed border-slate-300 text-slate-500 rounded-lg hover:border-[#2980b9] hover:text-[#2980b9] hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2 text-sm font-medium"
      >
        <Plus className="w-4 h-4" /> Adicionar Ingreso / Beneficio
      </button>

      {/* Totales Accordion */}
      {items.length > 0 && (
        <MgaAccordion number="01" title="Totales de Ingresos y Beneficios" open={true} onToggle={() => {}}>
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="p-2 border text-center font-semibold">Periodo</th>
                  <th className="p-2 border font-semibold">Total Ingresos</th>
                  <th className="p-2 border font-semibold">Total Beneficios</th>
                  <th className="p-2 border font-bold text-emerald-800">Total General</th>
                </tr>
              </thead>
              <tbody>
                {totalesGlobales.map(t => (
                  <tr key={t.periodo} className="border-b hover:bg-slate-50">
                    <td className="p-2 border text-center font-medium bg-slate-50">Año {t.periodo}</td>
                    <td className="p-2 border text-slate-600">{formatCurrency(t.totalIngresos)}</td>
                    <td className="p-2 border text-slate-600">{formatCurrency(t.totalBeneficios)}</td>
                    <td className="p-2 border font-bold text-emerald-700 bg-emerald-50/30">{formatCurrency(t.totalGeneral)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-800 text-white font-bold">
                  <td className="p-2 border text-center">Gran Total</td>
                  <td className="p-2 border">{formatCurrency(totalesGlobales.reduce((acc, t) => acc + t.totalIngresos, 0))}</td>
                  <td className="p-2 border">{formatCurrency(totalesGlobales.reduce((acc, t) => acc + t.totalBeneficios, 0))}</td>
                  <td className="p-2 border text-emerald-400">{formatCurrency(totalesGlobales.reduce((acc, t) => acc + t.totalGeneral, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </MgaAccordion>
      )}

      {showForm && editingItem && (
        <IngresoBeneficioForm
          item={editingItem}
          productos={productos}
          onSave={handleSaveItem}
          onClose={() => { setShowForm(false); setEditingItem(null); }}
        />
      )}
    </div>
  );
}
