import { useState, useEffect, useRef, useCallback } from 'react';
import { HelpCircle, AlertTriangle, Plus, Trash2, Edit2, X, Shield, ChevronDown } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import {
  useProjectMgaStore,
  debouncedPatchProject,
  type RiesgoJson,
  type ProductoCvJson,
} from '../../../store/projectMgaStore';
import MgaAlert from './MgaAlert';
import { CountedTextarea } from '../../ui/CountedTextarea';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';

// ─── Constants ───────────────────────────────────────────────────────────────

const NIVELES_CLASIFICACION = [
  { value: '1', label: '1-Propósito (Objetivo general)' },
  { value: '2', label: '2-Componente (Productos)' },
  { value: '3', label: '3-Actividades' },
] as const;

const TIPOS_RIESGO = [
  'De mercado',
  'Operacionales',
  'Administrativos',
  'Normativos/Legales',
  'Ambientales',
  'Tecnológicos',
  'Financieros',
] as const;

const PROBABILIDADES = [
  { value: '1', label: '1. Raro' },
  { value: '2', label: '2. Improbable' },
  { value: '3', label: '3. Moderado' },
  { value: '4', label: '4. Probable' },
  { value: '5', label: '5. Casi seguro' },
] as const;

const IMPACTOS = [
  { value: '1', label: '1. Insignificante' },
  { value: '2', label: '2. Menor' },
  { value: '3', label: '3. Moderado' },
  { value: '4', label: '4. Mayor' },
  { value: '5', label: '5. Catastrófico' },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

function emptyRiesgo(): RiesgoJson {
  return {
    id: uuid(),
    nivelClasificacion: '1',
    referenciaId: undefined,
    tipo: '',
    descripcion: '',
    probabilidad: '',
    impacto: '',
    efectos: '',
    medidasMitigacion: '',
  };
}

/** Collect all productos from the cadena de valor of an alternative */
function getProductosFromCadena(
  formulation: ReturnType<typeof useProjectMgaStore.getState>['byProjectId'][string],
  alternativeId: string,
): ProductoCvJson[] {
  const cvPrep = formulation?.preparacion?.cadenaValorPrep?.[alternativeId];
  if (!cvPrep) return [];
  const productos: ProductoCvJson[] = [];
  for (const obj of Object.values(cvPrep.objetivos)) {
    productos.push(...obj.productos);
  }
  return productos;
}

/** Collect all actividades + entregables from all productos */
function getActividadesEntregables(productos: ProductoCvJson[]): Array<{ id: string; nombre: string; tipo: 'actividad' | 'entregable'; productoNombre: string }> {
  const items: Array<{ id: string; nombre: string; tipo: 'actividad' | 'entregable'; productoNombre: string }> = [];
  for (const p of productos) {
    const prodName = p.complemento || p.productoId || 'Producto';
    for (const a of p.actividades) {
      items.push({ id: a.id, nombre: a.nombre || '(sin nombre)', tipo: 'actividad', productoNombre: prodName });
    }
    for (const e of p.entregables) {
      items.push({ id: e.id, nombre: e.nombre || '(sin nombre)', tipo: 'entregable', productoNombre: prodName });
    }
  }
  return items;
}

function getProbabilidadLabel(val: string): string {
  return PROBABILIDADES.find(p => p.value === val)?.label || val;
}

function getImpactoLabel(val: string): string {
  return IMPACTOS.find(i => i.value === val)?.label || val;
}

// ─── Risk Form Modal ─────────────────────────────────────────────────────────

type RiskFormProps = {
  risk: RiesgoJson;
  objetivoGeneral: string;
  productos: ProductoCvJson[];
  actividadesEntregables: Array<{ id: string; nombre: string; tipo: 'actividad' | 'entregable'; productoNombre: string }>;
  onSave: (risk: RiesgoJson) => void;
  onClose: () => void;
};

function RiskFormModal({ risk: initial, objetivoGeneral, productos, actividadesEntregables, onSave, onClose }: RiskFormProps) {
  const [draft, setDraft] = useState<RiesgoJson>({ ...initial });

  const updateField = <K extends keyof RiesgoJson>(field: K, value: RiesgoJson[K]) => {
    setDraft(prev => {
      const updated = { ...prev, [field]: value };
      // Reset referenciaId when changing classification level
      if (field === 'nivelClasificacion') {
        updated.referenciaId = undefined;
      }
      return updated;
    });
  };

  const handleSubmit = () => {
    if (!draft.tipo) { alert('Seleccione un tipo de riesgo.'); return; }
    if (!draft.descripcion.trim()) { alert('Ingrese una descripción del riesgo.'); return; }
    if (!draft.probabilidad) { alert('Seleccione la probabilidad.'); return; }
    if (!draft.impacto) { alert('Seleccione el impacto.'); return; }
    onSave(draft);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50 rounded-t-xl">
          <h3 className="text-lg font-semibold text-slate-800">
            <Shield className="w-5 h-5 inline mr-2 text-[#2980b9]" />
            {initial.descripcion ? 'Editar riesgo' : 'Adicionar riesgo'}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Nivel de clasificación */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nivel de clasificación <span className="text-red-500">*</span></label>
            <select
              value={draft.nivelClasificacion}
              onChange={e => updateField('nivelClasificacion', e.target.value as '1' | '2' | '3')}
              className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2980b9] outline-none"
            >
              {NIVELES_CLASIFICACION.map(n => (
                <option key={n.value} value={n.value}>{n.label}</option>
              ))}
            </select>
          </div>

          {/* Conditional reference field */}
          {draft.nivelClasificacion === '1' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Objetivo General</label>
              <input
                type="text"
                readOnly
                value={objetivoGeneral || '(No definido en Identificación)'}
                className="w-full p-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
              />
            </div>
          )}

          {draft.nivelClasificacion === '2' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Producto relacionado</label>
              <select
                value={draft.referenciaId || ''}
                onChange={e => updateField('referenciaId', e.target.value || undefined)}
                className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2980b9] outline-none"
              >
                <option value="">Seleccione un producto...</option>
                {productos.map(p => (
                  <option key={p.id} value={p.id}>{p.complemento || p.productoId || `Producto ${p.id.slice(0, 6)}`}</option>
                ))}
              </select>
              {productos.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No hay productos definidos en la cadena de valor de esta alternativa.</p>
              )}
            </div>
          )}

          {draft.nivelClasificacion === '3' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Actividad o entregable de ruta crítica</label>
              <select
                value={draft.referenciaId || ''}
                onChange={e => updateField('referenciaId', e.target.value || undefined)}
                className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2980b9] outline-none"
              >
                <option value="">Seleccione...</option>
                {actividadesEntregables.map(ae => (
                  <option key={ae.id} value={ae.id}>
                    [{ae.tipo === 'actividad' ? 'Act' : 'Ent'}] {ae.nombre} ({ae.productoNombre})
                  </option>
                ))}
              </select>
              {actividadesEntregables.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No hay actividades ni entregables definidos en la cadena de valor.</p>
              )}
            </div>
          )}

          {/* Tipo de riesgo */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de riesgo <span className="text-red-500">*</span></label>
            <select
              value={draft.tipo}
              onChange={e => updateField('tipo', e.target.value)}
              className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2980b9] outline-none"
            >
              <option value="">Seleccione tipo...</option>
              {TIPOS_RIESGO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Descripción */}
          <AIAssistedField
            label="Descripción del riesgo"
            htmlFor={`riesgo-descripcion-${draft.id}`}
            required
            guidance="Describa el evento incierto, su causa y la forma en que puede afectar el proyecto."
            askPrompt="Ayúdame a redactar la descripción de un riesgo MGA."
          >
            <CountedTextarea id={`riesgo-descripcion-${draft.id}`} value={draft.descripcion} onChange={e => updateField('descripcion', e.target.value)} rows={3} maxLength={500} placeholder="Describa el riesgo identificado..." className="w-full resize-y rounded-lg border border-slate-300 p-2 text-sm outline-none focus:ring-2 focus:ring-[#2980b9]" />
          </AIAssistedField>

          {/* Probabilidad + Impacto */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Probabilidad <span className="text-red-500">*</span></label>
              <select
                value={draft.probabilidad}
                onChange={e => updateField('probabilidad', e.target.value)}
                className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2980b9] outline-none"
              >
                <option value="">Seleccione...</option>
                {PROBABILIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Impacto <span className="text-red-500">*</span></label>
              <select
                value={draft.impacto}
                onChange={e => updateField('impacto', e.target.value)}
                className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2980b9] outline-none"
              >
                <option value="">Seleccione...</option>
                {IMPACTOS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
          </div>

          {/* Efectos */}
          <AIAssistedField
            label="Efectos del riesgo"
            htmlFor={`riesgo-efectos-${draft.id}`}
            guidance="Describa las consecuencias esperadas si el riesgo llega a materializarse."
            askPrompt="Ayúdame a redactar los efectos de un riesgo MGA."
          >
            <CountedTextarea id={`riesgo-efectos-${draft.id}`} value={draft.efectos} onChange={e => updateField('efectos', e.target.value)} rows={2} maxLength={500} placeholder="Consecuencias si el riesgo se materializa..." className="w-full resize-y rounded-lg border border-slate-300 p-2 text-sm outline-none focus:ring-2 focus:ring-[#2980b9]" />
          </AIAssistedField>

          {/* Medidas de mitigación */}
          <AIAssistedField
            label="Medidas de mitigación"
            htmlFor={`riesgo-mitigacion-${draft.id}`}
            guidance="Describa las acciones concretas para reducir la probabilidad o el impacto del riesgo."
            askPrompt="Ayúdame a redactar medidas de mitigación para un riesgo MGA."
          >
            <CountedTextarea id={`riesgo-mitigacion-${draft.id}`} value={draft.medidasMitigacion} onChange={e => updateField('medidasMitigacion', e.target.value)} rows={2} maxLength={500} placeholder="Acciones para reducir la probabilidad o impacto..." className="w-full resize-y rounded-lg border border-slate-300 p-2 text-sm outline-none focus:ring-2 focus:ring-[#2980b9]" />
          </AIAssistedField>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">Cancelar</button>
          <button onClick={handleSubmit} className="px-5 py-2 text-sm bg-[#006162] text-white rounded-lg hover:bg-[#004d4e] transition-colors font-medium shadow-sm">Guardar riesgo</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

type RiesgosTabProps = {
  project: Project;
};

export default function RiesgosTab({ project }: RiesgosTabProps) {
  const getFormulation = useProjectMgaStore((s) => s.getFormulation);
  const isSaving = useProjectMgaStore((s) => s.isSaving);

  const formulation = getFormulation(project.id);
  const alternativasAll = formulation.identificacion?.alternativas || [];
  const alternatives = alternativasAll.filter((alt: any) => alt.pasaPreparacion === true);
  const objetivoGeneral = formulation.identificacion?.objetivos?.objetivoGeneral || '';

  const [selectedAlternativeId, setSelectedAlternativeId] = useState<string>(alternatives.length > 0 ? alternatives[0].id : '');
  const [riesgos, setRiesgos] = useState<RiesgoJson[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingRisk, setEditingRisk] = useState<RiesgoJson | null>(null);
  const [showForm, setShowForm] = useState(false);

  const prevProjectIdRef = useRef(project.id);
  const isFirstMount = useRef(true);
  const lastSavedRef = useRef<string>('[]');

  // ── Derived data from cadena de valor ──
  const productos = getProductosFromCadena(formulation, selectedAlternativeId);
  const actividadesEntregables = getActividadesEntregables(productos);

  // ── Load data for selected alternative ──
  const loadAlternativeData = useCallback((altId: string) => {
    const f = useProjectMgaStore.getState().getFormulation(project.id);
    const altRiesgos = f.preparacion?.riesgos?.[altId] || [];
    setRiesgos(altRiesgos);
    lastSavedRef.current = JSON.stringify(altRiesgos);
  }, [project.id]);

  const storeRiesgos = useProjectMgaStore((s) => s.getFormulation(project.id)?.preparacion?.riesgos);

  useEffect(() => {
    if (storeRiesgos && selectedAlternativeId) {
      const altRiesgos = storeRiesgos[selectedAlternativeId] || [];
      const serialized = JSON.stringify(altRiesgos);
      if (serialized !== lastSavedRef.current) {
        setRiesgos(altRiesgos);
        lastSavedRef.current = serialized;
      }
    }
  }, [storeRiesgos, selectedAlternativeId]);

  // ── Project change sync ──
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
      setRiesgos([]);
      lastSavedRef.current = '[]';
    }
  }, [project.id, loadAlternativeData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save ──
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (!selectedAlternativeId) return;

    const serialized = JSON.stringify(riesgos);
    if (serialized === lastSavedRef.current) return;
    lastSavedRef.current = serialized;

    const f = useProjectMgaStore.getState().getFormulation(project.id);
    const currentPrep = f.preparacion || { necesidades: {} };
    const currentRiesgos = currentPrep.riesgos || {};
    const updatedRiesgos = { ...currentRiesgos, [selectedAlternativeId]: riesgos };
    const newPrep = { ...currentPrep, riesgos: updatedRiesgos };

    useProjectMgaStore.setState((state) => {
      const fm = state.byProjectId[project.id] || { causeRelations: [], generalIndicators: [], effects: [], participants: [], populations: [], alternatives: [], completedSections: {} };
      return {
        byProjectId: {
          ...state.byProjectId,
          [project.id]: { ...fm, preparacion: newPrep, completedSections: { ...fm.completedSections, riesgos: true } },
        },
        isSaving: true,
      };
    });

    debouncedPatchProject(project.id, { preparacion: newPrep, completedSections: { ...f.completedSections, riesgos: true } });
  }, [riesgos, selectedAlternativeId, project.id]);

  // ── Alternative change ──
  const handleAlternativeChange = (newAltId: string) => {
    setSelectedAlternativeId(newAltId);
    isFirstMount.current = true;
    loadAlternativeData(newAltId);
  };

  // ── CRUD ──
  const handleSaveRisk = (risk: RiesgoJson) => {
    setRiesgos(prev => {
      const existingIdx = prev.findIndex(r => r.id === risk.id);
      if (existingIdx >= 0) {
        return prev.map((r, i) => i === existingIdx ? risk : r);
      }
      return [...prev, risk];
    });
    setShowForm(false);
    setEditingRisk(null);
  };

  const handleDeleteRisk = (id: string) => {
    if (!window.confirm('¿Eliminar este riesgo?')) return;
    setRiesgos(prev => prev.filter(r => r.id !== id));
  };

  const handleEditRisk = (risk: RiesgoJson) => {
    setEditingRisk(risk);
    setShowForm(true);
  };

  const handleAddNew = () => {
    setEditingRisk(emptyRiesgo());
    setShowForm(true);
  };

  // ── Group risks by nivel ──
  const nivel1 = riesgos.filter(r => r.nivelClasificacion === '1');
  const nivel2 = riesgos.filter(r => r.nivelClasificacion === '2');
  const nivel3 = riesgos.filter(r => r.nivelClasificacion === '3');

  /** Resolve reference name for nivel 2 */
  const getRefNameN2 = (refId?: string) => {
    if (!refId) return '';
    const p = productos.find(pr => pr.id === refId);
    return p ? (p.complemento || p.productoId || `Producto ${refId.slice(0, 6)}`) : '';
  };

  /** Resolve reference name for nivel 3 */
  const getRefNameN3 = (refId?: string) => {
    if (!refId) return '';
    const ae = actividadesEntregables.find(a => a.id === refId);
    return ae ? `[${ae.tipo === 'actividad' ? 'Act' : 'Ent'}] ${ae.nombre}` : '';
  };

  // ── Guard: no alternatives ──
  if (alternatives.length === 0) {
    return (
      <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
        <div className="flex items-center gap-2 border-b pb-3">
          <h1 className="text-xl font-normal text-[#2980b9]">Riesgos</h1>
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

  // ── Render grouped table rows ──
  const renderGroupedRows = (label: string, items: RiesgoJson[], getRefName: (refId?: string) => string) => {
    if (items.length === 0) return null;
    return (
      <>
        {/* Section header row */}
        <tr className="bg-slate-100">
          <td colSpan={6} className="p-2 font-bold text-slate-700 text-xs border">
            <ChevronDown className="w-3.5 h-3.5 inline mr-1" />
            {label}
          </td>
        </tr>
        {items.map(r => {
          const refName = getRefName(r.referenciaId);
          return (
            <tr key={r.id} className="border-b hover:bg-slate-50 align-top">
              <td className="p-2 border text-xs">
                <div className="font-medium text-slate-800">{r.tipo || '—'}</div>
                {refName && <div className="text-[10px] text-blue-600 mt-0.5">{refName}</div>}
              </td>
              <td className="p-2 border text-xs text-slate-700 max-w-[200px]">{r.descripcion}</td>
              <td className="p-2 border text-xs text-center">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  r.probabilidad >= '4' ? 'bg-red-100 text-red-700' :
                  r.probabilidad === '3' ? 'bg-amber-100 text-amber-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {getProbabilidadLabel(r.probabilidad)}
                </span>
              </td>
              <td className="p-2 border text-xs text-center">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  r.impacto >= '4' ? 'bg-red-100 text-red-700' :
                  r.impacto === '3' ? 'bg-amber-100 text-amber-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {getImpactoLabel(r.impacto)}
                </span>
              </td>
              <td className="p-2 border text-xs text-slate-600 max-w-[180px]">{r.efectos || '—'}</td>
              <td className="p-2 border text-center">
                <div className="flex items-center justify-center gap-1">
                  <button onClick={() => handleEditRisk(r)} className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors" title="Editar">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDeleteRisk(r.id)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Eliminar">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </>
    );
  };

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-normal text-[#2980b9]">Riesgos</h1>
          <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
        </div>
        {isSaving && (
          <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm">
            <div className="w-4 h-4 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" /> Guardando...
          </div>
        )}
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

      {/* Grouped risk table */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#2980b9] text-white text-xs">
              <th className="p-2.5 border border-[#2471a3] font-medium">Tipo de riesgo</th>
              <th className="p-2.5 border border-[#2471a3] font-medium">Descripción del riesgo</th>
              <th className="p-2.5 border border-[#2471a3] font-medium text-center">Probabilidad</th>
              <th className="p-2.5 border border-[#2471a3] font-medium text-center">Impacto</th>
              <th className="p-2.5 border border-[#2471a3] font-medium">Efectos</th>
              <th className="p-2.5 border border-[#2471a3] font-medium text-center w-20">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {riesgos.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400 text-sm">
                  <Shield className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  No hay riesgos registrados para esta alternativa.
                </td>
              </tr>
            ) : (
              <>
                {renderGroupedRows('1-Propósito (Objetivo general)', nivel1, () => objetivoGeneral)}
                {renderGroupedRows('2-Componente (Productos)', nivel2, getRefNameN2)}
                {renderGroupedRows('3-Actividad o Entregable', nivel3, getRefNameN3)}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Add button */}
      <button
        onClick={handleAddNew}
        className="w-full py-2.5 border-2 border-dashed border-slate-300 text-slate-500 rounded-lg hover:border-[#2980b9] hover:text-[#2980b9] hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2 text-sm font-medium"
      >
        <Plus className="w-4 h-4" /> Adicionar riesgo
      </button>

      {/* Risk form modal */}
      {showForm && editingRisk && (
        <RiskFormModal
          risk={editingRisk}
          objetivoGeneral={objetivoGeneral}
          productos={productos}
          actividadesEntregables={actividadesEntregables}
          onSave={handleSaveRisk}
          onClose={() => { setShowForm(false); setEditingRisk(null); }}
        />
      )}
    </div>
  );
}
