import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { HelpCircle, AlertTriangle, TrendingUp, X, CheckCircle2, BarChart3 } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import {
  useProjectMgaStore,
  type PreparacionData,
  type CadenaValorAlternativa,
  type ProductoCvJson,
} from '../../../store/projectMgaStore';
import MgaAccordion from './MgaAccordion';

// ─── Constants ────────────────────────────────────────────────────────────────

const TASA_DESCUENTO = 0.09; // 9% DNP

/** 9 criterios oficiales MGA para evaluación multicriterio */
const CRITERIOS_MGA: { id: string; label: string }[] = [
  { id: 'c1', label: '1 - Cumplimiento de requisitos legales y técnicos' },
  { id: 'c2', label: '2 - Consistencia técnica del diseño' },
  { id: 'c3', label: '3 - Operatividad y sostenibilidad' },
  { id: 'c4', label: '4 - Viabilidad financiera' },
  { id: 'c5', label: '5 - Impacto ambiental' },
  { id: 'c6', label: '6 - Impacto social' },
  { id: 'c7', label: '7 - Participación comunitaria' },
  { id: 'c8', label: '8 - Riesgo (menor riesgo es mejor)' },
  { id: 'c9', label: '9 - Coherencia con políticas y planes' },
];

/** Escala Saaty 1-9 */
const ESCALA_AHP: { value: number; label: string }[] = [
  { value: 1, label: '1 - Igualmente preferido' },
  { value: 3, label: '3 - Moderadamente preferido' },
  { value: 5, label: '5 - Fuertemente preferido' },
  { value: 7, label: '7 - Muy fuertemente preferido' },
  { value: 9, label: '9 - Extremadamente preferido' },
];

/** Escala de atractivo para la barra visual */
const ESCALA_ATRACTIVO: { min: number; max: number; label: string; color: string }[] = [
  { min: 0, max: 25, label: 'Poco atractiva', color: '#ef4444' },
  { min: 25, max: 50, label: 'Medianamente atractiva', color: '#f59e0b' },
  { min: 50, max: 75, label: 'Atractiva', color: '#22c55e' },
  { min: 75, max: 100, label: 'Muy atractiva', color: '#2563eb' },
];

// ─── Multicriterio types ──────────────────────────────────────────────────────

type ComparacionEntry = {
  preferenciaId: string; // ID of the preferred alternative
  calificacion: number;  // 1,3,5,7,9
};

type MulticriterioData = {
  criteriosSeleccionados: string[];
  comparaciones: Record<string, ComparacionEntry>;
};

// ─── Formatting helpers ───────────────────────────────────────────────────────

function financialFormat(value: number): string {
  if (!Number.isFinite(value)) return 'No Aplica';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function pctFormat(value: number): string {
  if (!Number.isFinite(value)) return 'No Aplica';
  return `${value.toFixed(2)}%`;
}

function ratioFormat(value: number): string {
  if (!Number.isFinite(value)) return 'No Aplica';
  return value.toFixed(4);
}

// ─── Financial math ───────────────────────────────────────────────────────────

function buildFlowArrays(
  prepData: PreparacionData,
  altId: string,
): { fnc: number[]; benefits: number[]; costs: number[]; n: number } {
  const ingresos = prepData.ingresosBeneficios?.[altId] || [];
  const prestamos = prepData.prestamos?.[altId] || [];
  const cadena = prepData.cadenaValorPrep?.[altId];
  const depreciaciones = prepData.depreciacion?.[altId] || [];

  const benefitsByPeriod: Record<number, number> = {};
  const costsByPeriod: Record<number, number> = {};
  const creditsByPeriod: Record<number, number> = {};
  const salvamentoByPeriod: Record<number, number> = {};

  ingresos.forEach((ing) => {
    if (ing.proyecciones) {
      ing.proyecciones.forEach((p) => {
        benefitsByPeriod[p.periodo] = (benefitsByPeriod[p.periodo] || 0) + (p.valorTotal || 0);
      });
    }
  });

  prestamos.forEach((pres) => {
    if (pres.periodoInicio !== undefined && pres.valorCreditoCop) {
      creditsByPeriod[pres.periodoInicio] =
        (creditsByPeriod[pres.periodoInicio] || 0) + pres.valorCreditoCop;
    }
    if (pres.tablaAmortizacion) {
      pres.tablaAmortizacion.forEach((t) => {
        costsByPeriod[t.periodo] =
          (costsByPeriod[t.periodo] || 0) + (t.amortizacion || 0) + (t.interes || 0);
      });
    }
  });

  if (cadena?.objetivos) {
    Object.values(cadena.objetivos).forEach((obj) => {
      if (obj.productos) {
        obj.productos.forEach((prod) => {
          if (prod.actividades) {
            prod.actividades.forEach((act) => {
              if (act.costos) {
                act.costos.forEach((costo) => {
                  costsByPeriod[costo.periodo] = (costsByPeriod[costo.periodo] || 0) + (costo.valor || 0);
                });
              }
            });
          }
        });
      }
    });
  }

  depreciaciones.forEach((dep) => {
    if (dep.periodoFinal !== undefined) {
      salvamentoByPeriod[dep.periodoFinal] =
        (salvamentoByPeriod[dep.periodoFinal] || 0) + (dep.valorSalvamento || 0);
    }
  });

  const allPeriods = new Set<number>([0]);
  [benefitsByPeriod, costsByPeriod, creditsByPeriod, salvamentoByPeriod].forEach((map) =>
    Object.keys(map).forEach((k) => allPeriods.add(Number(k))),
  );
  const maxPeriod = Math.max(...Array.from(allPeriods));
  const n = Number.isFinite(maxPeriod) && maxPeriod > 0 ? maxPeriod : 0;

  const fnc: number[] = [];
  const benefits: number[] = [];
  const costs: number[] = [];

  for (let t = 0; t <= n; t++) {
    const b = (benefitsByPeriod[t] || 0) + (creditsByPeriod[t] || 0) + (salvamentoByPeriod[t] || 0);
    const c = costsByPeriod[t] || 0;
    benefits.push(b);
    costs.push(c);
    fnc.push(b - c);
  }

  return { fnc, benefits, costs, n };
}

function calcVPN(fnc: number[], r: number): number {
  let vpn = 0;
  for (let t = 0; t < fnc.length; t++) {
    vpn += fnc[t] / Math.pow(1 + r, t);
  }
  return Number.isFinite(vpn) ? vpn : NaN;
}

function calcTIR(fnc: number[]): number {
  if (fnc.length === 0) return NaN;
  let hasPositive = false;
  let hasNegative = false;
  for (const v of fnc) {
    if (v > 0) hasPositive = true;
    if (v < 0) hasNegative = true;
  }
  if (!hasPositive || !hasNegative) return NaN;

  let lo = -0.99;
  let hi = 10.0;
  const MAX_ITER = 200;
  const TOLERANCE = 1e-8;

  let vpnLo = calcVPN(fnc, lo);
  let vpnHi = calcVPN(fnc, hi);

  if (vpnLo * vpnHi > 0) {
    for (let attempt = 0; attempt < 20; attempt++) {
      hi *= 2;
      vpnHi = calcVPN(fnc, hi);
      if (vpnLo * vpnHi <= 0) break;
    }
    if (vpnLo * vpnHi > 0) return NaN;
  }

  for (let i = 0; i < MAX_ITER; i++) {
    const mid = (lo + hi) / 2;
    const vpnMid = calcVPN(fnc, mid);
    if (Math.abs(vpnMid) < TOLERANCE || (hi - lo) / 2 < TOLERANCE) {
      return mid * 100;
    }
    if (vpnLo * vpnMid < 0) {
      hi = mid;
      vpnHi = vpnMid;
    } else {
      lo = mid;
      vpnLo = vpnMid;
    }
  }
  return ((lo + hi) / 2) * 100;
}

function calcRBC(benefits: number[], costs: number[], r: number): number {
  let pvB = 0;
  let pvC = 0;
  const n = Math.max(benefits.length, costs.length);
  for (let t = 0; t < n; t++) {
    const disc = Math.pow(1 + r, t);
    pvB += (benefits[t] || 0) / disc;
    pvC += (costs[t] || 0) / disc;
  }
  if (pvC === 0) return NaN;
  return pvB / pvC;
}

function calcVPC(costs: number[], r: number): number {
  let vpc = 0;
  for (let t = 0; t < costs.length; t++) {
    vpc += (costs[t] || 0) / Math.pow(1 + r, t);
  }
  return Number.isFinite(vpc) ? vpc : NaN;
}

function calcCAE(vpc: number, r: number, n: number): number {
  if (n <= 0 || !Number.isFinite(vpc)) return NaN;
  const factor = Math.pow(1 + r, n);
  const denominator = factor - 1;
  if (denominator === 0) return NaN;
  return vpc * (r * factor) / denominator;
}

// ─── AHP math ─────────────────────────────────────────────────────────────────

/**
 * Compute AHP scores for each alternative.
 * For each selected criterion, generate pairwise comparisons.
 * If A wins over B with score X => A gets X pts, B gets 1/X pts.
 * Normalize totals to base 100.
 */
function computeAhpScores(
  alternatives: { id: string; nombre?: string }[],
  multicriterio: MulticriterioData,
): Record<string, number> {
  const scores: Record<string, number> = {};
  alternatives.forEach((a) => { scores[a.id] = 0; });

  const { criteriosSeleccionados, comparaciones } = multicriterio;

  if (criteriosSeleccionados.length === 0) return scores;

  for (const criterioId of criteriosSeleccionados) {
    // Generate all pairs
    for (let i = 0; i < alternatives.length; i++) {
      for (let j = i + 1; j < alternatives.length; j++) {
        const alt1 = alternatives[i];
        const alt2 = alternatives[j];
        const key = `${criterioId}_${alt1.id}_${alt2.id}`;
        const entry = comparaciones[key];

        if (!entry) continue;

        const { preferenciaId, calificacion } = entry;
        const cal = calificacion || 1;

        if (preferenciaId === alt1.id) {
          scores[alt1.id] += cal;
          scores[alt2.id] += 1 / cal;
        } else if (preferenciaId === alt2.id) {
          scores[alt2.id] += cal;
          scores[alt1.id] += 1 / cal;
        } else {
          // Equal / no preference: both get 1
          scores[alt1.id] += 1;
          scores[alt2.id] += 1;
        }
      }
    }
  }

  // Normalize to base 100
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  if (totalScore > 0) {
    for (const id of Object.keys(scores)) {
      scores[id] = (scores[id] / totalScore) * 100;
    }
  }

  return scores;
}

/** Generate pairwise combination keys for alternatives */
function generatePairs(
  alternatives: { id: string; nombre?: string }[],
): { alt1Id: string; alt1Name: string; alt2Id: string; alt2Name: string }[] {
  const pairs: { alt1Id: string; alt1Name: string; alt2Id: string; alt2Name: string }[] = [];
  for (let i = 0; i < alternatives.length; i++) {
    for (let j = i + 1; j < alternatives.length; j++) {
      pairs.push({
        alt1Id: alternatives[i].id,
        alt1Name: (alternatives[i] as any).nombre || (alternatives[i] as any).description || 'Alt ' + (i + 1),
        alt2Id: alternatives[j].id,
        alt2Name: (alternatives[j] as any).nombre || (alternatives[j] as any).description || 'Alt ' + (j + 1),
      });
    }
  }
  return pairs;
}

// ─── Per-alternative result ───────────────────────────────────────────────────

type AltIndicators = {
  altId: string;
  altName: string;
  vpn: number;
  tir: number;
  rbc: number;
  vpc: number;
  cae: number;
  costoBeneficiario: number;
  totalBeneficiarios: number;
  productos: {
    nombre: string;
    cantidad: number;
    vpc: number;
    costoUnitario: number;
  }[];
};

// ─── AHP Comparison Modal ─────────────────────────────────────────────────────

type AhpModalProps = {
  alternatives: { id: string; nombre?: string }[];
  initial: MulticriterioData;
  onSave: (data: MulticriterioData) => void;
  onClose: () => void;
};

function AhpModal({ alternatives, initial, onSave, onClose }: AhpModalProps) {
  const [criterios, setCriterios] = useState<string[]>(initial.criteriosSeleccionados || []);
  const [comparaciones, setComparaciones] = useState<Record<string, ComparacionEntry>>(
    initial.comparaciones || {},
  );

  const pairs = useMemo(() => generatePairs(alternatives), [alternatives]);

  const toggleCriterio = (id: string) => {
    setCriterios((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const updateComparacion = (key: string, field: keyof ComparacionEntry, value: string | number) => {
    setComparaciones((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        preferenciaId: prev[key]?.preferenciaId || alternatives[0]?.id || '',
        calificacion: prev[key]?.calificacion || 1,
        [field]: value,
      },
    }));
  };

  const handleSave = () => {
    onSave({
      criteriosSeleccionados: criterios,
      comparaciones,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50 rounded-t-xl">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-slate-800">
              Comparación multicriterio (AHP)
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Sección 1: Selección de criterios */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">
              1. Seleccione los criterios de evaluación
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CRITERIOS_MGA.map((c) => (
                <label
                  key={c.id}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors text-xs ${
                    criterios.includes(c.id)
                      ? 'bg-blue-50 border-blue-300 text-blue-900'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={criterios.includes(c.id)}
                    onChange={() => toggleCriterio(c.id)}
                    className="accent-blue-600 w-4 h-4"
                  />
                  <span className="font-medium">{c.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Sección 2: Matriz de calificación */}
          {criterios.length > 0 && pairs.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">
                2. Califique las comparaciones por pares
              </h4>

              {criterios.map((criterioId) => {
                const criterioLabel = CRITERIOS_MGA.find((c) => c.id === criterioId)?.label || criterioId;
                return (
                  <div key={criterioId} className="mb-5">
                    <h5 className="text-xs font-bold text-blue-800 bg-blue-50 p-2 rounded mb-2">
                      Criterio: {criterioLabel}
                    </h5>
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#6c757d] text-white">
                            <th className="p-2 border border-[#5a6268]">Alternativa</th>
                            <th className="p-2 border border-[#5a6268]">Comparado con</th>
                            <th className="p-2 border border-[#5a6268]">Preferencia</th>
                            <th className="p-2 border border-[#5a6268]">Calificación</th>
                            <th className="p-2 border border-[#5a6268] text-right">Ponderación</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pairs.map((pair) => {
                            const key = `${criterioId}_${pair.alt1Id}_${pair.alt2Id}`;
                            const entry = comparaciones[key] || {
                              preferenciaId: pair.alt1Id,
                              calificacion: 1,
                            };
                            const ponderacion =
                              entry.preferenciaId === pair.alt1Id
                                ? entry.calificacion
                                : 1 / (entry.calificacion || 1);

                            return (
                              <tr key={key} className="border-b hover:bg-slate-50">
                                <td className="p-2 border font-medium text-slate-700">
                                  {pair.alt1Name}
                                </td>
                                <td className="p-2 border text-slate-600">{pair.alt2Name}</td>
                                <td className="p-2 border">
                                  <select
                                    value={entry.preferenciaId}
                                    onChange={(e) =>
                                      updateComparacion(key, 'preferenciaId', e.target.value)
                                    }
                                    className="w-full p-1 border rounded text-xs bg-white outline-none focus:border-blue-400"
                                  >
                                    <option value={pair.alt1Id}>{pair.alt1Name}</option>
                                    <option value={pair.alt2Id}>{pair.alt2Name}</option>
                                  </select>
                                </td>
                                <td className="p-2 border">
                                  <select
                                    value={entry.calificacion}
                                    onChange={(e) =>
                                      updateComparacion(key, 'calificacion', Number(e.target.value))
                                    }
                                    className="w-full p-1 border rounded text-xs bg-white outline-none focus:border-blue-400"
                                  >
                                    {ESCALA_AHP.map((s) => (
                                      <option key={s.value} value={s.value}>
                                        {s.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="p-2 border text-right font-mono font-semibold text-slate-800">
                                  {ponderacion.toFixed(4)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {criterios.length > 0 && pairs.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
              Se necesitan al menos 2 alternativas para generar comparaciones por pares.
            </div>
          )}

          {criterios.length === 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-500">
              Seleccione al menos un criterio para comenzar las comparaciones.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm flex items-center gap-1"
          >
            <CheckCircle2 className="w-4 h-4" /> Guardar comparaciones
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IndicadoresDecisionTab({ project }: { project: Project }) {
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));
  const saveEvaluacion = useProjectMgaStore((s) => s.saveEvaluacion);

  const alternativasAll = formulation.identificacion?.alternativas || [];
  const alternatives = alternativasAll.filter((alt: any) => alt.pasaPreparacion === true);

  const prepData = formulation.preparacion;

  const [accordionOpen, setAccordionOpen] = useState(true);
  const [accordionCapOpen, setAccordionCapOpen] = useState(true);
  const [accordionMultiOpen, setAccordionMultiOpen] = useState(true);
  const [accordionDecisionOpen, setAccordionDecisionOpen] = useState(true);
  const [showAhpModal, setShowAhpModal] = useState(false);

  // ─── Multicriterio state ──────────────────────────────────────────────────
  const evalData = formulation.evaluacion || {};
  const [multicriterio, setMulticriterio] = useState<MulticriterioData>(() => ({
    criteriosSeleccionados: evalData.multicriterio?.criteriosSeleccionados || [],
    comparaciones: evalData.multicriterio?.comparaciones || {},
  }));
  const [alternativaSeleccionadaId, setAlternativaSeleccionadaId] = useState<string>(
    evalData.alternativaSeleccionadaId || '',
  );

  // Sync from store when evaluacion data changes externally
  useEffect(() => {
    const ed = formulation.evaluacion || {};
    const dataToCompare = {
      multicriterio: ed.multicriterio || { criteriosSeleccionados: [], comparaciones: {} },
      alternativaSeleccionadaId: ed.alternativaSeleccionadaId || '',
    };
    const serialized = JSON.stringify(dataToCompare);
    if (serialized !== lastSavedRef.current) {
      setMulticriterio(dataToCompare.multicriterio as any);
      setAlternativaSeleccionadaId(dataToCompare.alternativaSeleccionadaId);
      lastSavedRef.current = serialized;
    }
  }, [formulation.evaluacion]);

  // ─── Auto-save logic ──────────────────────────────────────────────────────
  const lastSavedRef = useRef<string>('');
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      lastSavedRef.current = JSON.stringify({ multicriterio, alternativaSeleccionadaId });
      return;
    }

    const serialized = JSON.stringify({ multicriterio, alternativaSeleccionadaId });
    if (serialized === lastSavedRef.current) return;
    lastSavedRef.current = serialized;

    // Merge with existing evaluacion data
    const existing = useProjectMgaStore.getState().getFormulation(project.id).evaluacion || {};
    const merged = {
      ...existing,
      multicriterio,
      alternativaSeleccionadaId: alternativaSeleccionadaId || undefined,
    };

    void saveEvaluacion(project.id, merged);
  }, [multicriterio, alternativaSeleccionadaId, project.id, saveEvaluacion]);

  // ─── AHP modal save handler ─────────────────────────────────────────────
  const handleAhpSave = useCallback((data: MulticriterioData) => {
    setMulticriterio(data);
    setShowAhpModal(false);
  }, []);

  // ─── Core economic computation (memoised) ───────────────────────────────
  const indicators = useMemo<AltIndicators[]>(() => {
    if (!prepData || alternatives.length === 0) return [];

    return alternatives.map((alt: any) => {
      const altId: string = alt.id;
      const altName: string = alt.nombre || alt.description || 'Sin nombre';

      const { fnc, benefits, costs, n } = buildFlowArrays(prepData, altId);

      const vpn = calcVPN(fnc, TASA_DESCUENTO);
      const tir = calcTIR(fnc);
      const rbc = calcRBC(benefits, costs, TASA_DESCUENTO);
      const vpc = calcVPC(costs, TASA_DESCUENTO);
      const cae = calcCAE(vpc, TASA_DESCUENTO, n);

      const poblacion = formulation.identificacion?.poblacion;
      const totalBeneficiarios = poblacion?.objetivo?.numero || 0;
      const costoBeneficiario = totalBeneficiarios > 0 && Number.isFinite(vpc) ? vpc / totalBeneficiarios : NaN;

      const cadena: CadenaValorAlternativa | undefined = prepData.cadenaValorPrep?.[altId];
      const productos: AltIndicators['productos'] = [];

      if (cadena?.objetivos) {
        Object.values(cadena.objetivos).forEach((obj) => {
          if (obj.productos) {
            obj.productos.forEach((prod: ProductoCvJson) => {
              const prodCostsByPeriod: Record<number, number> = {};
              if (prod.actividades) {
                prod.actividades.forEach((act) => {
                  if (act.costos) {
                    act.costos.forEach((c) => {
                      prodCostsByPeriod[c.periodo] = (prodCostsByPeriod[c.periodo] || 0) + (c.valor || 0);
                    });
                  }
                });
              }
              const maxP = Object.keys(prodCostsByPeriod).length > 0
                ? Math.max(...Object.keys(prodCostsByPeriod).map(Number))
                : 0;
              const prodCostsArr: number[] = [];
              for (let t = 0; t <= maxP; t++) {
                prodCostsArr.push(prodCostsByPeriod[t] || 0);
              }
              const prodVpc = calcVPC(prodCostsArr, TASA_DESCUENTO);
              const cantidad = prod.cantidad || 0;
              const costoUnitario = cantidad > 0 && Number.isFinite(prodVpc) ? prodVpc / cantidad : NaN;

              productos.push({
                nombre: prod.descripcion || prod.complemento || prod.productoId || 'Producto',
                cantidad,
                vpc: prodVpc,
                costoUnitario,
              });
            });
          }
        });
      }

      return { altId, altName, vpn, tir, rbc, vpc, cae, costoBeneficiario, totalBeneficiarios, productos };
    });
  }, [prepData, alternatives, formulation.identificacion?.poblacion, formulation.identificacion?.alternativas]);

  // ─── Best-value detection (Acordeón 01) ─────────────────────────────────
  const bestIndices = useMemo(() => {
    if (indicators.length === 0) return { vpn: -1, tir: -1, rbc: -1, costoBenef: -1, vpc: -1, cae: -1 };

    const finite = (v: number) => Number.isFinite(v);

    const bestIdx = (key: keyof AltIndicators, higher: boolean) => {
      let best = -1;
      let bestVal = higher ? -Infinity : Infinity;
      indicators.forEach((ind, i) => {
        const v = ind[key] as number;
        if (!finite(v)) return;
        if (higher ? v > bestVal : v < bestVal) {
          bestVal = v;
          best = i;
        }
      });
      return best;
    };

    return {
      vpn: bestIdx('vpn', true),
      tir: bestIdx('tir', true),
      rbc: bestIdx('rbc', true),
      costoBenef: bestIdx('costoBeneficiario', false),
      vpc: bestIdx('vpc', false),
      cae: bestIdx('cae', false),
    };
  }, [indicators]);

  // ─── AHP scores (Acordeón 02) ───────────────────────────────────────────
  const ahpScores = useMemo(() => {
    if (alternatives.length === 0 || multicriterio.criteriosSeleccionados.length === 0) {
      const empty: Record<string, number> = {};
      alternatives.forEach((a: any) => { empty[a.id] = 0; });
      return empty;
    }
    return computeAhpScores(alternatives as any[], multicriterio);
  }, [alternatives, multicriterio]);

  const bestAhpId = useMemo(() => {
    let bestId = '';
    let bestScore = -1;
    for (const [id, score] of Object.entries(ahpScores)) {
      if (score > bestScore) {
        bestScore = score;
        bestId = id;
      }
    }
    return bestId;
  }, [ahpScores]);

  // ─── Empty state ────────────────────────────────────────────────────────
  if (alternatives.length === 0) {
    return (
      <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
        <div className="flex items-center gap-2 border-b pb-3">
          <h1 className="text-xl font-normal text-[#2980b9]">Indicadores y Decisión</h1>
          <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
        </div>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md flex gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
          <div className="text-yellow-700">
            <p className="font-bold">No hay alternativas que pasen a preparación.</p>
            <p className="mt-1 text-xs">
              Debe registrar al menos una alternativa con datos de preparación completos para calcular indicadores.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const WINNER = 'bg-blue-600 text-white font-bold';
  const NORMAL = '';

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
      <div className="flex items-center gap-2 border-b pb-3">
        <TrendingUp className="w-5 h-5 text-[#2980b9]" />
        <h1 className="text-xl font-normal text-[#2980b9]">Indicadores y Decisión</h1>
        <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
      </div>

      <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded border">
        Tasa Social de Descuento (DNP): <strong>{(TASA_DESCUENTO * 100).toFixed(0)}%</strong>
      </div>

      {/* ═══ Acordeón 01: Evaluación económica ══════════════════════════════ */}
      <MgaAccordion
        number="01"
        title="Evaluación económica"
        open={accordionOpen}
        onToggle={() => setAccordionOpen(!accordionOpen)}
      >
        <div className="overflow-x-auto border rounded-lg bg-white">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#495057] text-white">
                <th className="p-2 border border-[#5a6268]" rowSpan={2}>
                  Alternativas de solución
                </th>
                <th className="p-2 border border-[#5a6268] text-center" colSpan={3}>
                  Indicadores de rentabilidad
                </th>
                <th className="p-2 border border-[#5a6268] text-center" colSpan={1}>
                  Indicadores de costo eficiencia
                </th>
                <th className="p-2 border border-[#5a6268] text-center" colSpan={2}>
                  Indicadores de costo mínimo
                </th>
              </tr>
              <tr className="bg-[#6c757d] text-white">
                <th className="p-2 border border-[#5a6268] text-right min-w-[130px]">VPN ($ COP)</th>
                <th className="p-2 border border-[#5a6268] text-right min-w-[90px]">TIR (%)</th>
                <th className="p-2 border border-[#5a6268] text-right min-w-[90px]">Rel. B/C</th>
                <th className="p-2 border border-[#5a6268] text-right min-w-[130px]">Costo por beneficiario</th>
                <th className="p-2 border border-[#5a6268] text-right min-w-[130px]">VP Costos ($ COP)</th>
                <th className="p-2 border border-[#5a6268] text-right min-w-[130px]">CAE ($ COP)</th>
              </tr>
            </thead>
            <tbody>
              {indicators.map((ind, i) => (
                <tr key={ind.altId} className="border-b hover:bg-slate-50">
                  <td className="p-2 border font-medium text-slate-800 max-w-[220px]">{ind.altName}</td>
                  <td className={`p-2 border text-right font-mono ${i === bestIndices.vpn ? WINNER : NORMAL}`}>
                    {financialFormat(ind.vpn)}
                  </td>
                  <td className={`p-2 border text-right font-mono ${i === bestIndices.tir ? WINNER : NORMAL}`}>
                    {Number.isFinite(ind.tir) ? pctFormat(ind.tir) : 'No Aplica'}
                  </td>
                  <td className={`p-2 border text-right font-mono ${i === bestIndices.rbc ? WINNER : NORMAL}`}>
                    {Number.isFinite(ind.rbc) ? ratioFormat(ind.rbc) : 'No Aplica'}
                  </td>
                  <td className={`p-2 border text-right font-mono ${i === bestIndices.costoBenef ? WINNER : NORMAL}`}>
                    {financialFormat(ind.costoBeneficiario)}
                  </td>
                  <td className={`p-2 border text-right font-mono ${i === bestIndices.vpc ? WINNER : NORMAL}`}>
                    {financialFormat(ind.vpc)}
                  </td>
                  <td className={`p-2 border text-right font-mono ${i === bestIndices.cae ? WINNER : NORMAL}`}>
                    {financialFormat(ind.cae)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-blue-700 font-medium italic">
          Los indicadores más relevantes de la(s) alternativa(s) se encuentran sombreados en azul.
        </p>
      </MgaAccordion>

      {/* ═══ Acordeón 01b: Costo por capacidad ═════════════════════════════ */}
      <MgaAccordion
        number="01b"
        title="Costo por capacidad"
        open={accordionCapOpen}
        onToggle={() => setAccordionCapOpen(!accordionCapOpen)}
      >
        {indicators.map((ind) => {
          if (ind.productos.length === 0) {
            return (
              <div key={ind.altId} className="mb-4 p-3 bg-slate-50 border rounded text-xs text-slate-500">
                <strong>{ind.altName}:</strong> Sin productos en cadena de valor.
              </div>
            );
          }

          let minCostoIdx = -1;
          let minCosto = Infinity;
          ind.productos.forEach((p, pi) => {
            if (Number.isFinite(p.costoUnitario) && p.costoUnitario < minCosto) {
              minCosto = p.costoUnitario;
              minCostoIdx = pi;
            }
          });

          return (
            <div key={ind.altId} className="mb-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">{ind.altName}</h4>
              <div className="overflow-x-auto border rounded-lg bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#6c757d] text-white">
                      <th className="p-2 border border-[#5a6268]">Producto</th>
                      <th className="p-2 border border-[#5a6268] text-right">Cantidad</th>
                      <th className="p-2 border border-[#5a6268] text-right">VP Costos ($ COP)</th>
                      <th className="p-2 border border-[#5a6268] text-right">Costo unitario (VP)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ind.productos.map((prod, pi) => (
                      <tr key={pi} className="border-b hover:bg-slate-50">
                        <td className="p-2 border font-medium text-slate-700 max-w-[250px]">{prod.nombre}</td>
                        <td className="p-2 border text-right font-mono">{prod.cantidad.toLocaleString('es-CO')}</td>
                        <td className="p-2 border text-right font-mono">{financialFormat(prod.vpc)}</td>
                        <td className={`p-2 border text-right font-mono ${pi === minCostoIdx ? WINNER : NORMAL}`}>
                          {financialFormat(prod.costoUnitario)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </MgaAccordion>

      {/* ═══ Acordeón 02: Evaluación multicriterio ═════════════════════════ */}
      <MgaAccordion
        number="02"
        title="Evaluación multicriterio"
        open={accordionMultiOpen}
        onToggle={() => setAccordionMultiOpen(!accordionMultiOpen)}
      >
        {/* Escala de interés */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-600 mb-2">
            Interés sobre la alternativa
          </p>
          <div className="flex h-5 rounded overflow-hidden border border-slate-300">
            {ESCALA_ATRACTIVO.map((seg) => (
              <div
                key={seg.label}
                className="flex-1 flex items-center justify-center text-[10px] font-bold text-white"
                style={{ backgroundColor: seg.color }}
                title={`${seg.min}% - ${seg.max}%`}
              >
                {seg.label}
              </div>
            ))}
          </div>
          <div className="flex text-[9px] text-slate-500 mt-0.5">
            <span className="flex-1 text-left">0%</span>
            <span className="flex-1 text-center">25%</span>
            <span className="flex-1 text-center">50%</span>
            <span className="flex-1 text-center">75%</span>
            <span className="flex-1 text-right">100%</span>
          </div>
        </div>

        {/* Tabla de resultados */}
        <div className="overflow-x-auto border rounded-lg bg-white mb-4">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#6c757d] text-white">
                <th className="p-2 border border-[#5a6268]">Alternativa</th>
                <th className="p-2 border border-[#5a6268] text-right min-w-[140px]">
                  Resultado calificación (%)
                </th>
                <th className="p-2 border border-[#5a6268] min-w-[200px]">Nivel de interés</th>
              </tr>
            </thead>
            <tbody>
              {alternatives.map((alt: any) => {
                const score = ahpScores[alt.id] || 0;
                const isBest = alt.id === bestAhpId && score > 0;
                const segColor =
                  ESCALA_ATRACTIVO.find((s) => score >= s.min && score < s.max)?.color ||
                  (score >= 100 ? '#2563eb' : '#e5e7eb');

                return (
                  <tr key={alt.id} className="border-b hover:bg-slate-50">
                    <td className={`p-2 border font-medium ${isBest ? WINNER : 'text-slate-800'}`}>
                      {alt.nombre || alt.description || 'Sin nombre'}
                    </td>
                    <td className={`p-2 border text-right font-mono ${isBest ? WINNER : ''}`}>
                      {score.toFixed(2)}%
                    </td>
                    <td className="p-2 border">
                      <div className="w-full bg-slate-100 rounded h-4 overflow-hidden">
                        <div
                          className="h-full rounded transition-all duration-500"
                          style={{
                            width: `${Math.min(score, 100)}%`,
                            backgroundColor: segColor,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {multicriterio.criteriosSeleccionados.length === 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-500 mb-3">
            No se han configurado criterios de evaluación. Pulse "Comparar alternativas" para iniciar.
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowAhpModal(true)}
          className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm flex items-center gap-2"
        >
          <BarChart3 className="w-4 h-4" />
          Comparar alternativas
        </button>

        <p className="mt-3 text-xs text-blue-700 font-medium italic">
          Los indicadores más relevantes de la(s) alternativa(s) se encuentran sombreados en azul.
        </p>
      </MgaAccordion>

      {/* ═══ Acordeón 03: Decisión ═════════════════════════════════════════ */}
      <MgaAccordion
        number="03"
        title="Decisión"
        open={accordionDecisionOpen}
        onToggle={() => setAccordionDecisionOpen(!accordionDecisionOpen)}
      >
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-lg border p-4">
            <p className="text-xs text-slate-500 mb-1">Proyecto</p>
            <p className="text-sm font-semibold text-slate-800">
              {project.name || 'Proyecto sin nombre'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Seleccione la alternativa: <span className="text-red-500">*</span>
            </label>
            <select
              value={alternativaSeleccionadaId}
              onChange={(e) => setAlternativaSeleccionadaId(e.target.value)}
              className="w-full p-2.5 text-sm border border-slate-300 rounded-lg outline-none focus:border-[#2980b9] bg-white"
            >
              <option value="">-- Seleccione una alternativa --</option>
              {alternatives.map((alt: any) => (
                <option key={alt.id} value={alt.id}>
                  {alt.nombre || alt.description || 'Alternativa sin nombre'}
                </option>
              ))}
            </select>
          </div>

          {alternativaSeleccionadaId && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-emerald-800">Alternativa seleccionada</p>
                <p className="text-sm text-emerald-700 font-medium">
                  {(alternatives.find((a: any) => a.id === alternativaSeleccionadaId) as any)?.nombre ||
                    alternativaSeleccionadaId}
                </p>
              </div>
            </div>
          )}
        </div>
      </MgaAccordion>

      {/* ─── AHP Modal ─────────────────────────────────────────────────────── */}
      {showAhpModal && (
        <AhpModal
          alternatives={alternatives as any[]}
          initial={multicriterio}
          onSave={handleAhpSave}
          onClose={() => setShowAhpModal(false)}
        />
      )}
    </div>
  );
}
