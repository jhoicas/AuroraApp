import { useState, useEffect, useRef, useCallback } from 'react';
import { HelpCircle, AlertTriangle, Plus, Trash2, DollarSign, Target, ChevronDown, ChevronRight, X, Package, Activity, FileCheck } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import {
  useProjectMgaStore,
  debouncedPatchProject,
  type CadenaValorAlternativa,
  type ProductoCvJson,
  type ActividadCvJson,
  type EntregableCvJson,
  type CostoCvJson,
} from '../../../store/projectMgaStore';
import MgaAccordion from './MgaAccordion';
import MgaAlert from './MgaAlert';

// ─── Constants ───────────────────────────────────────────────────────────────

const ETAPAS = ['Inversión', 'Operación', 'Preinversión'] as const;

const INSUMOS_MGA = [
  'Mano de obra calificada',
  'Mano de obra no calificada',
  'Materiales',
  'Maquinaria y equipo',
  'Terrenos',
  'Edificaciones',
  'Servicios tecnológicos',
  'Gastos de viaje',
  'Imprevistos',
  'Interventoría',
  'Otros',
] as const;

const MAX_PERIODOS = 12;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

function sumCostos(costos: CostoCvJson[]): number {
  return costos.reduce((acc, c) => acc + (c.valor || 0), 0);
}

function sumActividadCostos(actividades: ActividadCvJson[]): number {
  return actividades.reduce((acc, a) => acc + sumCostos(a.costos), 0);
}

function sumEntregableCostos(entregables: EntregableCvJson[]): number {
  return entregables.reduce((acc, e) => acc + sumCostos(e.costos), 0);
}

function sumProductoCostos(producto: ProductoCvJson): number {
  return sumActividadCostos(producto.actividades) + sumEntregableCostos(producto.entregables);
}

function sumObjetivoCostos(productos: ProductoCvJson[]): number {
  return productos.reduce((acc, p) => acc + sumProductoCostos(p), 0);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function emptyProducto(etapa: string): ProductoCvJson {
  return {
    id: uuid(), etapa, productoId: '', complemento: '', descripcion: '',
    unidadMedidaId: '', cantidad: 0,
    localizacion: { rural: false, ruralDisperso: false, urbano: false },
    poblacion: { usarObjetivo: false, numero: 0, tipoAcumulacion: 'Suma', descripcion: '' },
    actividades: [], entregables: [],
  };
}

// ─── Cost Modal ──────────────────────────────────────────────────────────────

type CostModalProps = {
  title: string;
  costos: CostoCvJson[];
  onSave: (costos: CostoCvJson[]) => void;
  onClose: () => void;
};

function CostModal({ title, costos: initialCostos, onSave, onClose }: CostModalProps) {
  // Build a matrix: rows = insumos, cols = periodos
  const [matrix, setMatrix] = useState<Record<string, Record<number, number>>>(() => {
    const m: Record<string, Record<number, number>> = {};
    for (const insumo of INSUMOS_MGA) {
      m[insumo] = {};
      for (let p = 0; p < MAX_PERIODOS; p++) m[insumo][p] = 0;
    }
    for (const c of initialCostos) {
      if (m[c.insumo]) m[c.insumo][c.periodo] = c.valor;
    }
    return m;
  });

  const handleCellChange = (insumo: string, periodo: number, raw: string) => {
    const val = parseFloat(raw) || 0;
    setMatrix(prev => ({ ...prev, [insumo]: { ...prev[insumo], [periodo]: val } }));
  };

  const handleSave = () => {
    const newCostos: CostoCvJson[] = [];
    for (const insumo of INSUMOS_MGA) {
      for (let p = 0; p < MAX_PERIODOS; p++) {
        const val = matrix[insumo]?.[p] || 0;
        if (val > 0) newCostos.push({ insumo, periodo: p, valor: val });
      }
    }
    onSave(newCostos);
  };

  const totalGeneral = Object.values(matrix).reduce((acc, row) =>
    acc + Object.values(row).reduce((s, v) => s + v, 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Programar costos</h3>
            <p className="text-xs text-slate-500 mt-0.5">{title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body - scrollable */}
        <div className="overflow-auto flex-1 p-4">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#2980b9] text-white">
                <th className="p-2 text-left border border-[#2471a3] sticky left-0 bg-[#2980b9] z-10 min-w-[180px]">Insumo</th>
                {Array.from({ length: MAX_PERIODOS }, (_, i) => (
                  <th key={i} className="p-2 text-center border border-[#2471a3] min-w-[100px]">Periodo {i}</th>
                ))}
                <th className="p-2 text-center border border-[#2471a3] min-w-[120px] bg-[#1a5276]">Total fila</th>
              </tr>
            </thead>
            <tbody>
              {INSUMOS_MGA.map(insumo => {
                const rowTotal = Object.values(matrix[insumo] || {}).reduce((s, v) => s + v, 0);
                return (
                  <tr key={insumo} className="border-b hover:bg-slate-50">
                    <td className="p-2 font-medium text-slate-700 border sticky left-0 bg-white z-10">{insumo}</td>
                    {Array.from({ length: MAX_PERIODOS }, (_, i) => (
                      <td key={i} className="p-1 border">
                        <input
                          type="number"
                          min="0"
                          value={matrix[insumo]?.[i] || ''}
                          onChange={e => handleCellChange(insumo, i, e.target.value)}
                          className="w-full p-1.5 text-right border border-slate-200 rounded text-xs focus:ring-1 focus:ring-[#2980b9] outline-none"
                          placeholder="0"
                        />
                      </td>
                    ))}
                    <td className="p-2 text-right font-semibold text-slate-800 border bg-slate-50">{formatCurrency(rowTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-emerald-50 font-bold text-emerald-800">
                <td className="p-2 border sticky left-0 bg-emerald-50 z-10">Total por periodo</td>
                {Array.from({ length: MAX_PERIODOS }, (_, i) => {
                  const colTotal = INSUMOS_MGA.reduce((acc, ins) => acc + (matrix[ins]?.[i] || 0), 0);
                  return <td key={i} className="p-2 text-right border">{formatCurrency(colTotal)}</td>;
                })}
                <td className="p-2 text-right border text-lg">{formatCurrency(totalGeneral)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-slate-50">
          <div className="text-sm font-semibold text-emerald-700">
            Costo total: {formatCurrency(totalGeneral)}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} className="px-5 py-2 text-sm bg-[#006162] text-white rounded-lg hover:bg-[#004d4e] transition-colors font-medium shadow-sm">
              Guardar costos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Product Form (inline) ───────────────────────────────────────────────────

type ProductFormProps = {
  product: ProductoCvJson;
  poblacionObjetivoNum: number;
  onChange: (updated: ProductoCvJson) => void;
  onRemove: () => void;
};

function ProductForm({ product, poblacionObjetivoNum, onChange, onRemove }: ProductFormProps) {
  const [expanded, setExpanded] = useState(true);
  const [costModalTarget, setCostModalTarget] = useState<{ type: 'actividad' | 'entregable'; idx: number } | null>(null);

  const updateField = <K extends keyof ProductoCvJson>(field: K, value: ProductoCvJson[K]) => {
    onChange({ ...product, [field]: value });
  };

  // ── Activities ──
  const addActividad = () => {
    const newAct: ActividadCvJson = { id: uuid(), etapa: product.etapa, nombre: '', costos: [] };
    onChange({ ...product, actividades: [...product.actividades, newAct] });
  };

  const updateActividad = (idx: number, patch: Partial<ActividadCvJson>) => {
    const updated = product.actividades.map((a, i) => i === idx ? { ...a, ...patch } : a);
    onChange({ ...product, actividades: updated });
  };

  const removeActividad = (idx: number) => {
    if (!window.confirm('¿Eliminar esta actividad y sus costos?')) return;
    onChange({ ...product, actividades: product.actividades.filter((_, i) => i !== idx) });
  };

  // ── Entregables ──
  const addEntregable = () => {
    const newEnt: EntregableCvJson = { id: uuid(), etapa: product.etapa, nombre: '', costos: [] };
    onChange({ ...product, entregables: [...product.entregables, newEnt] });
  };

  const updateEntregable = (idx: number, patch: Partial<EntregableCvJson>) => {
    const updated = product.entregables.map((e, i) => i === idx ? { ...e, ...patch } : e);
    onChange({ ...product, entregables: updated });
  };

  const removeEntregable = (idx: number) => {
    if (!window.confirm('¿Eliminar este entregable y sus costos?')) return;
    onChange({ ...product, entregables: product.entregables.filter((_, i) => i !== idx) });
  };

  const handleCostSave = (costos: CostoCvJson[]) => {
    if (!costModalTarget) return;
    if (costModalTarget.type === 'actividad') {
      updateActividad(costModalTarget.idx, { costos });
    } else {
      updateEntregable(costModalTarget.idx, { costos });
    }
    setCostModalTarget(null);
  };

  const handleUsarPoblacionObjetivo = () => {
    onChange({
      ...product,
      poblacion: { ...product.poblacion, usarObjetivo: true, numero: poblacionObjetivoNum },
    });
  };

  const totalProducto = sumProductoCostos(product);

  return (
    <div className="border border-slate-200 rounded-lg bg-white shadow-sm">
      {/* Product header */}
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-50 to-white border-b cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          <Package className="w-4 h-4 text-[#2980b9]" />
          <span className="text-sm font-medium text-slate-800">{product.complemento || product.productoId || 'Nuevo producto'}</span>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{product.etapa}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">{formatCurrency(totalProducto)}</span>
          <button onClick={e => { e.stopPropagation(); onRemove(); }} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Eliminar producto">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Producto fields grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Etapa</label>
              <select value={product.etapa} onChange={e => updateField('etapa', e.target.value)} className="w-full p-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-[#2980b9] outline-none">
                {ETAPAS.map(et => <option key={et} value={et}>{et}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre del Producto</label>
              <input type="text" value={product.productoId} onChange={e => updateField('productoId', e.target.value)} placeholder="Nombre o código del producto" className="w-full p-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-[#2980b9] outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Complemento</label>
              <input type="text" value={product.complemento} onChange={e => updateField('complemento', e.target.value)} placeholder="Complemento del producto" className="w-full p-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-[#2980b9] outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Descripción</label>
            <textarea value={product.descripcion} onChange={e => updateField('descripcion', e.target.value)} rows={2} maxLength={500} placeholder="Describa el producto..." className="w-full p-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-[#2980b9] outline-none resize-y" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Unidad de Medida</label>
              <input type="text" value={product.unidadMedidaId} onChange={e => updateField('unidadMedidaId', e.target.value)} placeholder="Ej: Unidad, Metro, Kg" className="w-full p-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-[#2980b9] outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Cantidad</label>
              <input type="number" min={0} value={product.cantidad || ''} onChange={e => updateField('cantidad', parseFloat(e.target.value) || 0)} className="w-full p-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-[#2980b9] outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Localización</label>
              <div className="flex gap-3 mt-1">
                {(['rural', 'ruralDisperso', 'urbano'] as const).map(loc => (
                  <label key={loc} className="flex items-center gap-1 text-xs cursor-pointer">
                    <input type="checkbox" checked={product.localizacion[loc]} onChange={e => updateField('localizacion', { ...product.localizacion, [loc]: e.target.checked })} className="rounded border-slate-300 text-[#006162] focus:ring-[#006162]" />
                    {loc === 'ruralDisperso' ? 'Rural Disperso' : loc.charAt(0).toUpperCase() + loc.slice(1)}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Población */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-blue-800">Cuantificación de Población</label>
              <button
                onClick={handleUsarPoblacionObjetivo}
                className="text-xs px-3 py-1 bg-white border border-blue-200 text-blue-700 rounded hover:bg-blue-50 transition-colors font-medium shadow-sm"
              >
                <Target className="w-3 h-3 inline mr-1" />
                Utilizar cantidad de población objetivo
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-blue-700">Número</label>
                <input type="number" min={0} value={product.poblacion.numero || ''} onChange={e => updateField('poblacion', { ...product.poblacion, numero: parseInt(e.target.value) || 0 })} className="w-full p-1.5 text-xs border border-blue-200 rounded bg-white focus:ring-1 focus:ring-blue-400 outline-none" />
              </div>
              <div>
                <label className="text-xs text-blue-700">Tipo Acumulación</label>
                <select value={product.poblacion.tipoAcumulacion} onChange={e => updateField('poblacion', { ...product.poblacion, tipoAcumulacion: e.target.value })} className="w-full p-1.5 text-xs border border-blue-200 rounded bg-white focus:ring-1 focus:ring-blue-400 outline-none">
                  <option value="Suma">Suma</option>
                  <option value="Flujo">Flujo</option>
                  <option value="Stock">Stock</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-blue-700">Descripción</label>
                <input type="text" value={product.poblacion.descripcion} onChange={e => updateField('poblacion', { ...product.poblacion, descripcion: e.target.value })} className="w-full p-1.5 text-xs border border-blue-200 rounded bg-white focus:ring-1 focus:ring-blue-400 outline-none" placeholder="Descripción..." />
              </div>
            </div>
          </div>

          {/* ── Actividades ── */}
          <div className="space-y-2 pt-2 border-t border-dashed border-slate-200">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-orange-500" /> Actividades ({product.actividades.length})
              </h4>
              <button onClick={addActividad} className="text-xs px-3 py-1 bg-orange-50 border border-orange-200 text-orange-700 rounded hover:bg-orange-100 transition-colors flex items-center gap-1 font-medium">
                <Plus className="w-3 h-3" /> Adicionar Actividad
              </button>
            </div>
            {product.actividades.map((act, ai) => (
              <div key={act.id} className="flex items-start gap-2 bg-orange-50/50 p-2 rounded border border-orange-100">
                <div className="flex-1 space-y-1">
                  <div className="flex gap-2">
                    <textarea value={act.nombre} onChange={e => updateActividad(ai, { nombre: e.target.value })} rows={1} placeholder="Nombre de la actividad" className="flex-1 p-1.5 text-xs border border-orange-200 rounded focus:ring-1 focus:ring-orange-400 outline-none resize-y" />
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded self-start whitespace-nowrap">{act.etapa}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Costo: <span className="font-semibold text-slate-700">{formatCurrency(sumCostos(act.costos))}</span></span>
                    <button onClick={() => setCostModalTarget({ type: 'actividad', idx: ai })} className="px-2 py-0.5 bg-white border border-slate-300 text-slate-600 rounded hover:bg-slate-50 transition-colors flex items-center gap-1">
                      <DollarSign className="w-3 h-3" /> Programar costos
                    </button>
                  </div>
                </div>
                <button onClick={() => removeActividad(ai)} className="p-1 text-red-400 hover:text-red-600 rounded" title="Eliminar actividad">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* ── Entregables ── */}
          <div className="space-y-2 pt-2 border-t border-dashed border-slate-200">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <FileCheck className="w-3.5 h-3.5 text-purple-500" /> Entregables ({product.entregables.length})
              </h4>
              <button onClick={addEntregable} className="text-xs px-3 py-1 bg-purple-50 border border-purple-200 text-purple-700 rounded hover:bg-purple-100 transition-colors flex items-center gap-1 font-medium">
                <Plus className="w-3 h-3" /> Adicionar Entregable
              </button>
            </div>
            {product.entregables.map((ent, ei) => (
              <div key={ent.id} className="flex items-start gap-2 bg-purple-50/50 p-2 rounded border border-purple-100">
                <div className="flex-1 space-y-1">
                  <div className="flex gap-2">
                    <input type="text" value={ent.nombre} onChange={e => updateEntregable(ei, { nombre: e.target.value })} placeholder="Nombre del entregable" className="flex-1 p-1.5 text-xs border border-purple-200 rounded focus:ring-1 focus:ring-purple-400 outline-none" />
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded self-start whitespace-nowrap">{ent.etapa}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Costo: <span className="font-semibold text-slate-700">{formatCurrency(sumCostos(ent.costos))}</span></span>
                    <button onClick={() => setCostModalTarget({ type: 'entregable', idx: ei })} className="px-2 py-0.5 bg-white border border-slate-300 text-slate-600 rounded hover:bg-slate-50 transition-colors flex items-center gap-1">
                      <DollarSign className="w-3 h-3" /> Programar costos
                    </button>
                  </div>
                </div>
                <button onClick={() => removeEntregable(ei)} className="p-1 text-red-400 hover:text-red-600 rounded" title="Eliminar entregable">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cost modal */}
      {costModalTarget && (
        <CostModal
          title={costModalTarget.type === 'actividad'
            ? product.actividades[costModalTarget.idx]?.nombre || `Actividad ${costModalTarget.idx + 1}`
            : product.entregables[costModalTarget.idx]?.nombre || `Entregable ${costModalTarget.idx + 1}`}
          costos={costModalTarget.type === 'actividad'
            ? product.actividades[costModalTarget.idx]?.costos || []
            : product.entregables[costModalTarget.idx]?.costos || []}
          onSave={handleCostSave}
          onClose={() => setCostModalTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

type CadenaValorTabProps = {
  project: Project;
};

export default function CadenaValorTab({ project }: CadenaValorTabProps) {
  const getFormulation = useProjectMgaStore((s) => s.getFormulation);
  const isSaving = useProjectMgaStore((s) => s.isSaving);

  const formulation = getFormulation(project.id);
  const alternativasAll = formulation.identificacion?.alternativas || [];
  const alternatives = alternativasAll.filter((alt: any) => alt.pasaPreparacion === true);
  const objetivosEspecificos: Record<string, string> = formulation.identificacion?.objetivos?.objetivosEspecificos || {};
  const poblacionObjetivoNum = formulation.identificacion?.poblacion?.objetivo?.numero || 0;

  const [selectedAlternativeId, setSelectedAlternativeId] = useState<string>(alternatives.length > 0 ? alternatives[0].id : '');
  const [cadenaData, setCadenaData] = useState<CadenaValorAlternativa>({ objetivos: {} });
  const [error, setError] = useState<string | null>(null);

  const prevProjectIdRef = useRef(project.id);
  const isFirstMount = useRef(true);
  const lastSavedRef = useRef<string>('{}');

  // ── Load data for selected alternative ──
  const loadAlternativeData = useCallback((altId: string) => {
    const f = useProjectMgaStore.getState().getFormulation(project.id);
    const prep = f.preparacion?.cadenaValorPrep || {};
    const altData = prep[altId] || { objetivos: {} };
    setCadenaData(altData);
    lastSavedRef.current = JSON.stringify(altData);
  }, [project.id]);

  // Project change sync
  useEffect(() => {
    if (prevProjectIdRef.current !== project.id) {
      prevProjectIdRef.current = project.id;
      isFirstMount.current = true;
    }

    const f = useProjectMgaStore.getState().getFormulation(project.id);
    const altsAll = f.identificacion?.alternativas || [];
    const alts = altsAll.filter((a: any) => a.pasaPreparacion === true);

    if (alts.length > 0) {
      const altId = selectedAlternativeId && alts.some((a: any) => a.id === selectedAlternativeId)
        ? selectedAlternativeId : alts[0].id;
      setSelectedAlternativeId(altId);
      loadAlternativeData(altId);
    } else {
      setSelectedAlternativeId('');
      setCadenaData({ objetivos: {} });
      lastSavedRef.current = '{}';
    }
  }, [project.id, loadAlternativeData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save ──
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (!selectedAlternativeId) return;

    const serialized = JSON.stringify(cadenaData);
    if (serialized === lastSavedRef.current) return;
    lastSavedRef.current = serialized;

    // Merge into preparacion
    const f = useProjectMgaStore.getState().getFormulation(project.id);
    const currentPrep = f.preparacion || { necesidades: {} };
    const currentCV = currentPrep.cadenaValorPrep || {};
    const updatedCV = { ...currentCV, [selectedAlternativeId]: cadenaData };
    const newPrep = { ...currentPrep, cadenaValorPrep: updatedCV };

    // Optimistic update
    useProjectMgaStore.setState((state) => {
      const fm = state.byProjectId[project.id] || { causeRelations: [], generalIndicators: [], effects: [], participants: [], populations: [], alternatives: [], completedSections: {} };
      return {
        byProjectId: {
          ...state.byProjectId,
          [project.id]: { ...fm, preparacion: newPrep, completedSections: { ...fm.completedSections, 'cadena-valor': true } },
        },
        isSaving: true,
      };
    });

    debouncedPatchProject(project.id, { preparacion: newPrep, completedSections: { ...f.completedSections, 'cadena-valor': true } });
  }, [cadenaData, selectedAlternativeId, project.id]);

  // ── Alternative change handler ──
  const handleAlternativeChange = (newAltId: string) => {
    setSelectedAlternativeId(newAltId);
    isFirstMount.current = true;
    loadAlternativeData(newAltId);
  };

  // ── Product CRUD ──
  const addProducto = (objetivoId: string) => {
    setCadenaData(prev => {
      const obj = prev.objetivos[objetivoId] || { productos: [] };
      return {
        ...prev,
        objetivos: {
          ...prev.objetivos,
          [objetivoId]: { productos: [...obj.productos, emptyProducto('Inversión')] },
        },
      };
    });
  };

  const updateProducto = (objetivoId: string, productoIdx: number, updated: ProductoCvJson) => {
    setCadenaData(prev => {
      const obj = prev.objetivos[objetivoId];
      if (!obj) return prev;
      const newProducts = obj.productos.map((p, i) => i === productoIdx ? updated : p);
      return {
        ...prev,
        objetivos: { ...prev.objetivos, [objetivoId]: { productos: newProducts } },
      };
    });
  };

  const removeProducto = (objetivoId: string, productoIdx: number) => {
    if (!window.confirm('¿Eliminar este producto y todos sus costos asociados?')) return;
    setCadenaData(prev => {
      const obj = prev.objetivos[objetivoId];
      if (!obj) return prev;
      return {
        ...prev,
        objetivos: { ...prev.objetivos, [objetivoId]: { productos: obj.productos.filter((_, i) => i !== productoIdx) } },
      };
    });
  };

  // ── Computed totals ──
  const costoTotalAlternativa = Object.values(cadenaData.objetivos).reduce((acc, obj) => acc + sumObjetivoCostos(obj.productos), 0);

  // ── No alternatives guard ──
  if (alternatives.length === 0) {
    return (
      <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
        <div className="flex items-center gap-2 border-b pb-3">
          <h1 className="text-xl font-normal text-[#2980b9]">Cadena de Valor</h1>
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

  // ── No objetivos guard ──
  const objEntries = Object.entries(objetivosEspecificos);
  if (objEntries.length === 0) {
    return (
      <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
        <div className="flex items-center gap-2 border-b pb-3">
          <h1 className="text-xl font-normal text-[#2980b9]">Cadena de Valor</h1>
          <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
        </div>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md flex gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
          <div className="text-yellow-700">
            <p className="font-bold">No hay objetivos específicos definidos.</p>
            <p>Por favor, diríjase a la pestaña de "Identificación", módulo "Objetivos", y defina al menos un objetivo específico para construir la cadena de valor.</p>
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
          <h1 className="text-xl font-normal text-[#2980b9]">Cadena de Valor</h1>
          <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
            Costo total alternativa: {formatCurrency(costoTotalAlternativa)}
          </div>
          {isSaving && (
            <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm">
              <div className="w-4 h-4 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" /> Guardando...
            </div>
          )}
        </div>
      </div>

      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}

      {/* Alternative selector */}
      <div className="flex items-center gap-4 bg-slate-50 p-3 rounded border">
        <label className="font-semibold text-slate-700 whitespace-nowrap">Alternativa:</label>
        <select
          value={selectedAlternativeId}
          onChange={(e) => handleAlternativeChange(e.target.value)}
          className="flex-1 p-2 border border-slate-300 rounded bg-white focus:border-[#2980b9] focus:ring-[#2980b9] outline-none"
        >
          {alternatives.map((alt: any) => (
            <option key={alt.id} value={alt.id}>{alt.nombre}</option>
          ))}
        </select>
      </div>

      {/* Objective accordions */}
      {objEntries.map(([objId, objText]) => {
        const objData = cadenaData.objetivos[objId] || { productos: [] };
        const objTotal = sumObjetivoCostos(objData.productos);

        return (
          <MgaAccordion
            key={objId}
            title={objText || `Objetivo ${objId}`}
            number={`OE`}
            open={true}
            onToggle={() => {}}
          >
            <div className="space-y-4 p-1">
              {/* Objective header with total */}
              <div className="flex items-center justify-between bg-emerald-50 p-2 rounded border border-emerald-100">
                <span className="text-xs font-semibold text-emerald-800">
                  <Target className="w-3.5 h-3.5 inline mr-1" />
                  Costo total del objetivo
                </span>
                <span className="text-sm font-bold text-emerald-700">{formatCurrency(objTotal)}</span>
              </div>

              {/* Products list */}
              {objData.productos.map((prod, pi) => (
                <ProductForm
                  key={prod.id}
                  product={prod}
                  poblacionObjetivoNum={poblacionObjetivoNum}
                  onChange={(updated) => updateProducto(objId, pi, updated)}
                  onRemove={() => removeProducto(objId, pi)}
                />
              ))}

              {/* Add product button */}
              <button
                onClick={() => addProducto(objId)}
                className="w-full py-2.5 border-2 border-dashed border-slate-300 text-slate-500 rounded-lg hover:border-[#2980b9] hover:text-[#2980b9] hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2 text-sm font-medium"
              >
                <Plus className="w-4 h-4" /> Adicionar Producto
              </button>
            </div>
          </MgaAccordion>
        );
      })}
    </div>
  );
}
