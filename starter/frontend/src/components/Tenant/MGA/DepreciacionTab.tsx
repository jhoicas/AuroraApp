import { useState, useEffect, useRef, useCallback } from 'react';
import { HelpCircle, AlertTriangle, Plus, Trash2, Edit2, X, CheckCircle2 } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import {
  useProjectMgaStore,
  debouncedPatchProject,
  type DepreciacionJson,
} from '../../../store/projectMgaStore';
import MgaAlert from './MgaAlert';
import { CountedTextarea } from '../../ui/CountedTextarea';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';

// ─── Constants ───────────────────────────────────────────────────────────────

const DICCIONARIO_ACTIVOS = [
  { nombre: 'Vehículos', vidaUtil: 5, rpc: 0.71 },
  { nombre: 'Edificaciones', vidaUtil: 20, rpc: 0.8 },
  { nombre: 'Maquinaria y equipo', vidaUtil: 10, rpc: 0.75 },
  { nombre: 'Muebles y enseres', vidaUtil: 10, rpc: 0.85 },
  { nombre: 'Equipo de cómputo', vidaUtil: 5, rpc: 0.9 },
  { nombre: 'Otros', vidaUtil: 5, rpc: 1 },
];

const MAX_PERIODOS = 12;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

function emptyDepreciacion(periodoFinal: number): DepreciacionJson {
  return {
    id: uuid(),
    activo: '',
    rpc: 1,
    descripcion: '',
    vidaUtil: 0,
    periodoAdquisicion: 0,
    valorActivo: 0,
    periodoFinal,
    depreciacionAnual: 0,
    depreciacionTotal: 0,
    valorSalvamento: 0,
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

// ─── Depreciacion Form Modal ─────────────────────────────────────────────────

type DepreciacionFormProps = {
  item: DepreciacionJson;
  periodoFinalGeneral: number;
  onSave: (item: DepreciacionJson) => void;
  onClose: () => void;
};

function DepreciacionForm({ item: initial, periodoFinalGeneral, onSave, onClose }: DepreciacionFormProps) {
  const [draft, setDraft] = useState<DepreciacionJson>({ ...initial, periodoFinal: initial.periodoFinal || periodoFinalGeneral });

  const updateField = <K extends keyof DepreciacionJson>(field: K, value: DepreciacionJson[K]) => {
    setDraft(prev => {
      const next = { ...prev, [field]: value };
      
      // Auto-fill from dictionary
      if (field === 'activo' && typeof value === 'string') {
        const found = DICCIONARIO_ACTIVOS.find(a => a.nombre === value);
        if (found) {
          next.vidaUtil = found.vidaUtil;
          next.rpc = found.rpc;
        }
      }

      // Auto computations
      if (next.valorActivo > 0 && next.vidaUtil > 0) {
        next.depreciacionAnual = next.valorActivo / next.vidaUtil;
        const anosDeUso = next.periodoFinal - next.periodoAdquisicion;
        const anosDepreciables = Math.max(0, Math.min(next.vidaUtil, anosDeUso));
        next.depreciacionTotal = next.depreciacionAnual * anosDepreciables;
        next.valorSalvamento = Math.max(0, next.valorActivo - next.depreciacionTotal);
      } else {
        next.depreciacionAnual = 0;
        next.depreciacionTotal = 0;
        next.valorSalvamento = 0;
      }

      return next;
    });
  };

  const handleSubmit = () => {
    if (!draft.activo) { alert('Seleccione un activo.'); return; }
    if (!draft.descripcion.trim()) { alert('Ingrese una descripción.'); return; }
    if (draft.valorActivo <= 0) { alert('El valor del activo debe ser mayor a 0.'); return; }
    if (draft.periodoAdquisicion >= draft.periodoFinal) { alert('El periodo de adquisición debe ser menor al periodo final.'); return; }
    onSave(draft);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50 rounded-t-xl">
          <h3 className="text-lg font-semibold text-slate-800">
            {initial.descripcion ? 'Editar activo' : 'Adicionar activo'}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Activo <span className="text-red-500">*</span></label>
            <select value={draft.activo} onChange={e => updateField('activo', e.target.value)} className="w-full p-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-[#2980b9]">
              <option value="">Seleccione...</option>
              {DICCIONARIO_ACTIVOS.map(a => <option key={a.nombre} value={a.nombre}>{a.nombre}</option>)}
            </select>
          </div>

          <AIAssistedField
            label="Descripción del activo"
            htmlFor={`depreciacion-descripcion-${draft.id}`}
            required
            fieldHelpKey="depreciacion_descripcion"
            reactiveContext={{ activo: draft.activo }}
            onAutoFill={(value) => updateField('descripcion', value)}
            guidance="Describa el activo, su función en el proyecto y las condiciones relevantes para su depreciación."
            askPrompt="Ayúdame a redactar la descripción de un activo para la formulación MGA."
          >
            <CountedTextarea
              id={`depreciacion-descripcion-${draft.id}`}
              value={draft.descripcion}
              onChange={e => updateField('descripcion', e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full resize-y rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-[#2980b9]"
              placeholder="Descripción del activo..."
            />
          </AIAssistedField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Razón Precio Cuenta (RPC)</label>
              <input type="number" readOnly value={draft.rpc} className="w-full p-2 text-sm border border-slate-200 rounded-lg bg-slate-100 text-slate-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Vida útil (años)</label>
              <input type="number" readOnly value={draft.vidaUtil} className="w-full p-2 text-sm border border-slate-200 rounded-lg bg-slate-100 text-slate-500 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Valor del activo <span className="text-red-500">*</span></label>
              <input type="number" min="0" value={draft.valorActivo} onChange={e => updateField('valorActivo', parseFloat(e.target.value) || 0)} className="w-full p-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-[#2980b9]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Periodo de adquisición <span className="text-red-500">*</span></label>
              <select value={draft.periodoAdquisicion} onChange={e => updateField('periodoAdquisicion', parseInt(e.target.value, 10))} className="w-full p-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-[#2980b9]">
                {Array.from({ length: MAX_PERIODOS }).map((_, i) => (
                  <option key={i} value={i}>Año {i}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Motor de Cálculo (Read-only) */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3 mt-4">
             <h4 className="font-semibold text-slate-700 text-sm border-b pb-2">Cálculos de depreciación</h4>
             
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="block text-xs font-medium text-slate-500">Periodo final alternativa:</span>
                  <span className="font-semibold text-slate-800">Año {draft.periodoFinal}</span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-slate-500">Años de uso:</span>
                  <span className="font-semibold text-slate-800">{Math.max(0, draft.periodoFinal - draft.periodoAdquisicion)} años</span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-slate-500">Depreciación anual:</span>
                  <span className="font-semibold text-amber-700">{formatCurrency(draft.depreciacionAnual)}</span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-slate-500">Depreciación total:</span>
                  <span className="font-semibold text-amber-700">{formatCurrency(draft.depreciacionTotal)}</span>
                </div>
             </div>

             <div className="pt-3 border-t">
               <span className="block text-xs font-medium text-slate-500">Valor de salvamento:</span>
               <span className="text-lg font-bold text-emerald-700">{formatCurrency(draft.valorSalvamento)}</span>
             </div>
          </div>

        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">Cancelar</button>
          <button onClick={handleSubmit} className="px-5 py-2 text-sm bg-[#006162] text-white rounded-lg hover:bg-[#004d4e] transition-colors font-medium shadow-sm flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Tab ────────────────────────────────────────────────────────────────

type DepreciacionTabProps = {
  project: Project;
};

export default function DepreciacionTab({ project }: DepreciacionTabProps) {
  const getFormulation = useProjectMgaStore((s) => s.getFormulation);
  const isSaving = useProjectMgaStore((s) => s.isSaving);

  const formulation = getFormulation(project.id);
  const alternativasAll = formulation.identificacion?.alternativas || [];
  const alternatives = alternativasAll.filter((alt: any) => alt.pasaPreparacion === true);

  const [selectedAlternativeId, setSelectedAlternativeId] = useState<string>(alternatives.length > 0 ? alternatives[0].id : '');
  const [items, setItems] = useState<DepreciacionJson[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<DepreciacionJson | null>(null);
  const [showForm, setShowForm] = useState(false);

  const prevProjectIdRef = useRef(project.id);
  const isFirstMount = useRef(true);
  const lastSavedRef = useRef<string>('[]');

  // For MVP we assume fixed final period
  const PERIODO_FINAL = 10; 

  const loadAlternativeData = useCallback((altId: string) => {
    const f = useProjectMgaStore.getState().getFormulation(project.id);
    const altItems = f.preparacion?.depreciacion?.[altId] || [];
    setItems(altItems);
    lastSavedRef.current = JSON.stringify(altItems);
  }, [project.id]);

  const storeDepreciacion = useProjectMgaStore((s) => s.getFormulation(project.id)?.preparacion?.depreciacion);

  useEffect(() => {
    if (storeDepreciacion && selectedAlternativeId) {
      const altItems = storeDepreciacion[selectedAlternativeId] || [];
      const serialized = JSON.stringify(altItems);
      if (serialized !== lastSavedRef.current) {
        setItems(altItems);
        lastSavedRef.current = serialized;
      }
    }
  }, [storeDepreciacion, selectedAlternativeId]);

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
    const currentDepr = currentPrep.depreciacion || {};
    const updatedDepr = { ...currentDepr, [selectedAlternativeId]: items };
    const newPrep = { ...currentPrep, depreciacion: updatedDepr };

    useProjectMgaStore.setState((state) => {
      const fm = state.byProjectId[project.id] || { causeRelations: [], generalIndicators: [], effects: [], participants: [], populations: [], alternatives: [], completedSections: {} };
      return {
        byProjectId: {
          ...state.byProjectId,
          [project.id]: { ...fm, preparacion: newPrep, completedSections: fm.completedSections },
        },
        isSaving: true,
      };
    });

    debouncedPatchProject(project.id, { preparacion: newPrep, completedSections: f.completedSections });
  }, [items, selectedAlternativeId, project.id]);

  const handleAlternativeChange = (newAltId: string) => {
    setSelectedAlternativeId(newAltId);
    isFirstMount.current = true;
    loadAlternativeData(newAltId);
  };

  const handleSaveItem = (item: DepreciacionJson) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === item.id);
      if (idx >= 0) return prev.map((old, i) => i === idx ? item : old);
      return [...prev, item];
    });
    setShowForm(false);
    setEditingItem(null);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('¿Eliminar este activo?')) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const totalSalvamento = items.reduce((acc, it) => acc + it.valorSalvamento, 0);

  if (alternatives.length === 0) {
    return (
      <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
        <div className="flex items-center gap-2 border-b pb-3">
          <h1 className="text-xl font-normal text-[#2980b9]">Depreciación</h1>
          <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
        </div>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md flex gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
          <div className="text-yellow-700">
            <p className="font-bold">No hay alternativas que pasen a preparación.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-normal text-[#2980b9]">Depreciación</h1>
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
              <th className="p-2 border border-[#5a6268]">Descripción del activo</th>
              <th className="p-2 border border-[#5a6268] text-right">Valor activo</th>
              <th className="p-2 border border-[#5a6268] text-center">Periodo de adquisición</th>
              <th className="p-2 border border-[#5a6268] text-center">Periodo final</th>
              <th className="p-2 border border-[#5a6268] text-center w-20">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-500">No hay activos registrados.</td>
              </tr>
            ) : (
              items.map(it => (
                <tr key={it.id} className="border-b hover:bg-slate-50 align-top">
                  <td className="p-2 border">
                    <div className="font-medium text-slate-800">{it.activo}</div>
                    <div className="text-slate-500 text-[10px] mt-0.5">{it.descripcion}</div>
                  </td>
                  <td className="p-2 border text-right font-medium">{formatCurrency(it.valorActivo)}</td>
                  <td className="p-2 border text-center">Año {it.periodoAdquisicion}</td>
                  <td className="p-2 border text-center">Año {it.periodoFinal}</td>
                  <td className="p-2 border text-center">
                    <div className="flex items-center justify-center flex-wrap gap-1">
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

      <div className="flex justify-between items-center bg-emerald-50 border border-emerald-200 p-4 rounded-lg">
        <div className="text-emerald-900">
          <span className="font-medium mr-2">Total valor de salvamento:</span>
          <span className="text-lg font-bold">{formatCurrency(totalSalvamento)}</span>
        </div>
        <button
          onClick={() => { setEditingItem(emptyDepreciacion(PERIODO_FINAL)); setShowForm(true); }}
          className="px-5 py-2 bg-[#2980b9] text-white rounded-lg hover:bg-[#1a5276] transition-colors flex items-center gap-2 text-sm font-medium shadow-sm"
        >
          <Plus className="w-4 h-4" /> Adicionar activo
        </button>
      </div>

      {showForm && editingItem && (
        <DepreciacionForm
          item={editingItem}
          periodoFinalGeneral={PERIODO_FINAL}
          onSave={handleSaveItem}
          onClose={() => { setShowForm(false); setEditingItem(null); }}
        />
      )}
    </div>
  );
}
