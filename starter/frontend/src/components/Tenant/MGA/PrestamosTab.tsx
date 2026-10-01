import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HelpCircle, AlertTriangle, Plus, Trash2, Edit2, X, ChevronDown, CheckCircle2 } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import {
  useProjectMgaStore,
  debouncedPatchProject,
  type PrestamoJson,
  type AmortizacionPeriodoJson,
} from '../../../store/projectMgaStore';
import MgaAlert from './MgaAlert';
import MgaAccordion from './MgaAccordion';
import { CountedTextarea } from '../../ui/CountedTextarea';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

function emptyPrestamo(): PrestamoJson {
  return {
    id: uuid(),
    tipoCredito: 'Moneda Nacional',
    tasaCambio: 1,
    concepto: '',
    tasaInteresAnual: 0,
    plazoAnos: 0,
    valorCredito: 0,
    valorCreditoCop: 0,
    amortizacionAnualCop: 0,
    periodoInicio: 0,
    tablaAmortizacion: [],
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function computeAmortizacion(draft: PrestamoJson): AmortizacionPeriodoJson[] {
  const table: AmortizacionPeriodoJson[] = [];
  if (draft.plazoAnos <= 0 || draft.valorCreditoCop <= 0) return [];
  
  let saldoInicial = draft.valorCreditoCop;
  const amortizacionMensual = draft.valorCreditoCop / draft.plazoAnos;
  const tasaInteres = draft.tasaInteresAnual / 100;

  for (let i = 0; i < draft.plazoAnos; i++) {
    const periodo = draft.periodoInicio + i;
    const interes = saldoInicial * tasaInteres;
    const amortizacion = amortizacionMensual;
    const cuota = interes + amortizacion;
    const saldoFinal = saldoInicial - amortizacion;

    table.push({
      periodo,
      saldoInicial,
      cuota,
      interes,
      amortizacion,
      saldoFinal: Math.max(0, saldoFinal), // Prevent negative precision issues
    });

    saldoInicial = saldoFinal;
  }
  
  return table;
}

// ─── Prestamo Form Modal ─────────────────────────────────────────────────────

type PrestamoFormProps = {
  item: PrestamoJson;
  onSave: (item: PrestamoJson) => void;
  onClose: () => void;
};

function PrestamoForm({ item: initial, onSave, onClose }: PrestamoFormProps) {
  const [draft, setDraft] = useState<PrestamoJson>({ ...initial });

  const updateField = <K extends keyof PrestamoJson>(field: K, value: PrestamoJson[K]) => {
    setDraft(prev => {
      const next = { ...prev, [field]: value };
      
      // Enforce rules
      if (next.tipoCredito === 'Moneda Nacional') {
        next.tasaCambio = 1;
      }
      
      // Auto computations
      next.valorCreditoCop = next.valorCredito * next.tasaCambio;
      next.amortizacionAnualCop = next.plazoAnos > 0 ? (next.valorCreditoCop / next.plazoAnos) : 0;
      next.tablaAmortizacion = computeAmortizacion(next);

      return next;
    });
  };

  const handleSubmit = () => {
    if (!draft.concepto.trim()) { alert('Ingrese un concepto'); return; }
    if (draft.plazoAnos <= 0) { alert('El plazo debe ser mayor a 0'); return; }
    if (draft.valorCredito <= 0) { alert('El valor del crédito debe ser mayor a 0'); return; }
    onSave(draft);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50 rounded-t-xl">
          <h3 className="text-lg font-semibold text-slate-800">
            {initial.concepto ? 'Editar préstamo' : 'Adicionar préstamo'}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de crédito <span className="text-red-500">*</span></label>
              <select value={draft.tipoCredito} onChange={e => updateField('tipoCredito', e.target.value as 'Moneda Nacional' | 'Moneda Extranjera')} className="w-full p-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-[#2980b9]">
                <option value="Moneda Nacional">Moneda Nacional</option>
                <option value="Moneda Extranjera">Moneda Extranjera</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tasa de cambio ($) <span className="text-red-500">*</span></label>
              <input type="number" min="1" step="0.01" disabled={draft.tipoCredito === 'Moneda Nacional'} value={draft.tasaCambio} onChange={e => updateField('tasaCambio', parseFloat(e.target.value) || 1)} className="w-full p-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-[#2980b9] disabled:bg-slate-100 disabled:text-slate-500" />
            </div>
          </div>

          <AIAssistedField
            label="Concepto del préstamo"
            htmlFor={`prestamo-concepto-${draft.id}`}
            required
            fieldHelpKey="prestamo_concepto"
            reactiveContext={{ tipoCredito: draft.tipoCredito }}
            onAutoFill={(value) => updateField('concepto', value)}
            guidance="Describa el destino del crédito y su relación con la financiación del proyecto."
            askPrompt="Ayúdame a redactar el concepto de un préstamo para un proyecto MGA."
          >
            <CountedTextarea
              id={`prestamo-concepto-${draft.id}`}
              value={draft.concepto}
              onChange={e => updateField('concepto', e.target.value)}
              rows={2}
              maxLength={250}
              className="w-full resize-y rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-[#2980b9]"
            />
          </AIAssistedField>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tasa de interés anual (%) <span className="text-red-500">*</span></label>
              <input type="number" min="0" step="0.1" value={draft.tasaInteresAnual} onChange={e => updateField('tasaInteresAnual', parseFloat(e.target.value) || 0)} className="w-full p-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-[#2980b9]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Plazo (años) <span className="text-red-500">*</span></label>
              <input type="number" min="0" step="1" value={draft.plazoAnos} onChange={e => updateField('plazoAnos', parseInt(e.target.value, 10) || 0)} className="w-full p-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-[#2980b9]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Valor del crédito <span className="text-red-500">*</span></label>
              <input type="number" min="0" value={draft.valorCredito} onChange={e => updateField('valorCredito', parseFloat(e.target.value) || 0)} className="w-full p-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-[#2980b9]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Periodo de inicio <span className="text-red-500">*</span></label>
              <input type="number" min="0" step="1" value={draft.periodoInicio} onChange={e => updateField('periodoInicio', parseInt(e.target.value, 10) || 0)} className="w-full p-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-[#2980b9]" />
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-semibold text-blue-900 mb-1">Valor crédito (COP)</label>
                <div className="text-sm font-bold text-blue-800">{formatCurrency(draft.valorCreditoCop)}</div>
             </div>
             <div>
                <label className="block text-xs font-semibold text-blue-900 mb-1">Amortización anual (COP)</label>
                <div className="text-sm font-bold text-blue-800">{formatCurrency(draft.amortizacionAnualCop)}</div>
             </div>
          </div>

        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">Cancelar</button>
          <button onClick={handleSubmit} className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Tab ────────────────────────────────────────────────────────────────

type PrestamosTabProps = {
  project: Project;
};

export default function PrestamosTab({ project }: PrestamosTabProps) {
  const getFormulation = useProjectMgaStore((s) => s.getFormulation);
  const isSaving = useProjectMgaStore((s) => s.isSaving);

  const formulation = getFormulation(project.id);
  const alternativasAll = formulation.identificacion?.alternativas || [];
  const alternatives = alternativasAll.filter((alt: any) => alt.pasaPreparacion === true);

  const [selectedAlternativeId, setSelectedAlternativeId] = useState<string>(alternatives.length > 0 ? alternatives[0].id : '');
  const [items, setItems] = useState<PrestamoJson[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<PrestamoJson | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);

  const prevProjectIdRef = useRef(project.id);
  const isFirstMount = useRef(true);
  const lastSavedRef = useRef<string>('[]');

  const loadAlternativeData = useCallback((altId: string) => {
    const f = useProjectMgaStore.getState().getFormulation(project.id);
    const altItems = f.preparacion?.prestamos?.[altId] || [];
    setItems(altItems);
    lastSavedRef.current = JSON.stringify(altItems);
  }, [project.id]);

  const storePrestamos = useProjectMgaStore((s) => s.getFormulation(project.id)?.preparacion?.prestamos);

  useEffect(() => {
    if (storePrestamos && selectedAlternativeId) {
      const altItems = storePrestamos[selectedAlternativeId] || [];
      const serialized = JSON.stringify(altItems);
      if (serialized !== lastSavedRef.current) {
        setItems(altItems);
        lastSavedRef.current = serialized;
      }
    }
  }, [storePrestamos, selectedAlternativeId]);

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
    const currentPrestamos = currentPrep.prestamos || {};
    const updatedPrestamos = { ...currentPrestamos, [selectedAlternativeId]: items };
    const newPrep = { ...currentPrep, prestamos: updatedPrestamos };

    useProjectMgaStore.setState((state) => {
      const fm = state.byProjectId[project.id] || { causeRelations: [], generalIndicators: [], effects: [], participants: [], populations: [], alternatives: [], completedSections: {} };
      return {
        byProjectId: {
          ...state.byProjectId,
          [project.id]: { ...fm, preparacion: newPrep, completedSections: { ...fm.completedSections, 'prestamos': true } },
        },
        isSaving: true,
      };
    });

    debouncedPatchProject(project.id, { preparacion: newPrep, completedSections: { ...f.completedSections, 'prestamos': true } });
  }, [items, selectedAlternativeId, project.id]);

  const handleAlternativeChange = (newAltId: string) => {
    setSelectedAlternativeId(newAltId);
    isFirstMount.current = true;
    loadAlternativeData(newAltId);
    setExpandedLoan(null);
  };

  const handleSaveItem = (item: PrestamoJson) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === item.id);
      if (idx >= 0) return prev.map((old, i) => i === idx ? item : old);
      return [...prev, item];
    });
    setShowForm(false);
    setEditingItem(null);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('¿Eliminar este préstamo?')) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const toggleExpand = (id: string) => {
    setExpandedLoan(expandedLoan === id ? null : id);
  };

  // Consolidar matriz global
  const matrizGlobal: Record<number, number> = {};
  items.forEach(prestamo => {
    prestamo.tablaAmortizacion.forEach(fila => {
      if (!matrizGlobal[fila.periodo]) matrizGlobal[fila.periodo] = 0;
      matrizGlobal[fila.periodo] += fila.saldoFinal;
    });
  });
  const periodosGlobales = Object.keys(matrizGlobal).map(Number).sort((a, b) => a - b);

  if (alternatives.length === 0) {
    return (
      <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
        <div className="flex items-center gap-2 border-b pb-3">
          <h1 className="text-xl font-normal text-[#2980b9]">Préstamos</h1>
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
          <h1 className="text-xl font-normal text-[#2980b9]">Préstamos</h1>
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

      <MgaAccordion number="01" title="Crédito, amortización y pagos a capital" open={true} onToggle={() => {}}>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#6c757d] text-white text-xs">
                <th className="p-2 border border-[#5a6268] w-8"></th>
                <th className="p-2 border border-[#5a6268]">Tipo crédito</th>
                <th className="p-2 border border-[#5a6268]">Concepto</th>
                <th className="p-2 border border-[#5a6268] text-right">Tasa camb.</th>
                <th className="p-2 border border-[#5a6268] text-right">Tasa int.</th>
                <th className="p-2 border border-[#5a6268] text-right">Valor (COP)</th>
                <th className="p-2 border border-[#5a6268] text-right">Amort. anual</th>
                <th className="p-2 border border-[#5a6268] text-center w-20">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500">No hay préstamos registrados.</td>
                </tr>
              ) : (
                items.map(it => (
                  <React.Fragment key={it.id}>
                    <tr className={`border-b hover:bg-slate-50 align-top ${expandedLoan === it.id ? 'bg-slate-50' : ''}`}>
                      <td className="p-2 border text-center cursor-pointer" onClick={() => toggleExpand(it.id)}>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expandedLoan === it.id ? 'rotate-180' : ''}`} />
                      </td>
                      <td className="p-2 border font-medium text-slate-700">{it.tipoCredito}</td>
                      <td className="p-2 border text-slate-600 max-w-[200px] truncate" title={it.concepto}>{it.concepto}</td>
                      <td className="p-2 border text-right">{it.tasaCambio}</td>
                      <td className="p-2 border text-right">{it.tasaInteresAnual}%</td>
                      <td className="p-2 border text-right font-medium">{formatCurrency(it.valorCreditoCop)}</td>
                      <td className="p-2 border text-right">{formatCurrency(it.amortizacionAnualCop)}</td>
                      <td className="p-2 border text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => { setEditingItem(it); setShowForm(true); }} className="p-1 text-blue-500 hover:bg-blue-50 rounded" title="Editar"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(it.id)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                    
                    {expandedLoan === it.id && (
                      <tr className="bg-slate-50">
                        <td colSpan={8} className="p-4 border-b">
                          <div className="bg-white border rounded shadow-sm p-4">
                            <h4 className="font-semibold text-slate-700 mb-3 text-sm">Comportamiento anual de la amortización - {it.concepto}</h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs text-right border-collapse">
                                <thead>
                                  <tr className="bg-blue-50 text-blue-900 border-b border-blue-200">
                                    <th className="p-2 border-r border-blue-200 text-center">Periodo</th>
                                    <th className="p-2 border-r border-blue-200">Saldo inicial</th>
                                    <th className="p-2 border-r border-blue-200">Cuota</th>
                                    <th className="p-2 border-r border-blue-200">Interés</th>
                                    <th className="p-2 border-r border-blue-200">Amortización</th>
                                    <th className="p-2">Saldo final</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {it.tablaAmortizacion.length === 0 ? (
                                    <tr><td colSpan={6} className="p-3 text-center text-slate-500">No hay datos de amortización calculados.</td></tr>
                                  ) : (
                                    it.tablaAmortizacion.map(t => (
                                      <tr key={t.periodo} className="border-b">
                                        <td className="p-2 border-r text-center font-medium">Año {t.periodo}</td>
                                        <td className="p-2 border-r text-slate-600">{formatCurrency(t.saldoInicial)}</td>
                                        <td className="p-2 border-r text-slate-600">{formatCurrency(t.cuota)}</td>
                                        <td className="p-2 border-r text-slate-600">{formatCurrency(t.interes)}</td>
                                        <td className="p-2 border-r text-slate-600">{formatCurrency(t.amortizacion)}</td>
                                        <td className="p-2 font-semibold text-slate-700">{formatCurrency(t.saldoFinal)}</td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        <button
          onClick={() => { setEditingItem(emptyPrestamo()); setShowForm(true); }}
          className="w-full mt-3 py-2.5 border-2 border-dashed border-slate-300 text-slate-500 rounded-lg hover:border-[#2980b9] hover:text-[#2980b9] hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Adicionar crédito
        </button>
      </MgaAccordion>

      {items.length > 0 && periodosGlobales.length > 0 && (
        <MgaAccordion number="02" title="Saldo final por periodo para el total de los préstamos" open={true} onToggle={() => {}}>
           <div className="overflow-x-auto rounded border">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="p-2 border w-32 font-semibold">Concepto</th>
                  {periodosGlobales.map(p => <th key={p} className="p-2 border text-right font-semibold">Año {p}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white">
                  <td className="p-2 border font-medium text-slate-800">Saldo Final</td>
                  {periodosGlobales.map(p => (
                    <td key={p} className="p-2 border text-right text-emerald-700 font-semibold bg-emerald-50/30">
                      {formatCurrency(matrizGlobal[p] || 0)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
           </div>
        </MgaAccordion>
      )}

      {showForm && editingItem && (
        <PrestamoForm
          item={editingItem}
          onSave={handleSaveItem}
          onClose={() => { setShowForm(false); setEditingItem(null); }}
        />
      )}
    </div>
  );
}
