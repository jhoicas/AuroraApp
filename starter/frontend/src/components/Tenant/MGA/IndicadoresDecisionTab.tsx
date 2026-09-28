import { useMemo, useState } from 'react';
import { HelpCircle, AlertTriangle, TrendingUp } from 'lucide-react';
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

/**
 * Build FNC, Benefits, and Costs arrays from preparation data for one alternative.
 * Returns contiguous arrays from period 0 to maxPeriod.
 */
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

  // Ingresos/Beneficios → benefits
  ingresos.forEach((ing) => {
    if (ing.proyecciones) {
      ing.proyecciones.forEach((p) => {
        benefitsByPeriod[p.periodo] = (benefitsByPeriod[p.periodo] || 0) + (p.valorTotal || 0);
      });
    }
  });

  // Préstamos: crédito goes into benefits side of FNC; amortization+interest into costs
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

  // Cadena de valor → costs
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

  // Depreciación → valor de salvamento (benefits, last period only)
  depreciaciones.forEach((dep) => {
    if (dep.periodoFinal !== undefined) {
      salvamentoByPeriod[dep.periodoFinal] =
        (salvamentoByPeriod[dep.periodoFinal] || 0) + (dep.valorSalvamento || 0);
    }
  });

  // Determine max period
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

/**
 * VPN = Σ FNC_t / (1+r)^t
 */
function calcVPN(fnc: number[], r: number): number {
  let vpn = 0;
  for (let t = 0; t < fnc.length; t++) {
    vpn += fnc[t] / Math.pow(1 + r, t);
  }
  return Number.isFinite(vpn) ? vpn : NaN;
}

/**
 * TIR via bisection: find r where VPN(r)=0.
 * Returns NaN if no sign change exists.
 */
function calcTIR(fnc: number[]): number {
  if (fnc.length === 0) return NaN;

  // Check for sign change
  let hasPositive = false;
  let hasNegative = false;
  for (const v of fnc) {
    if (v > 0) hasPositive = true;
    if (v < 0) hasNegative = true;
  }
  if (!hasPositive || !hasNegative) return NaN;

  let lo = -0.99;
  let hi = 10.0; // 1000%
  const MAX_ITER = 200;
  const TOLERANCE = 1e-8;

  let vpnLo = calcVPN(fnc, lo);
  let vpnHi = calcVPN(fnc, hi);

  // If both same sign, try to expand
  if (vpnLo * vpnHi > 0) {
    // Try expanding upper bound
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
      return mid * 100; // Return as %
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

/**
 * RBC = Σ B_t/(1+r)^t  /  Σ C_t/(1+r)^t
 */
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

/**
 * VPC = Σ C_t/(1+r)^t
 */
function calcVPC(costs: number[], r: number): number {
  let vpc = 0;
  for (let t = 0; t < costs.length; t++) {
    vpc += (costs[t] || 0) / Math.pow(1 + r, t);
  }
  return Number.isFinite(vpc) ? vpc : NaN;
}

/**
 * CAE = VPC * r(1+r)^n / ((1+r)^n - 1)
 */
function calcCAE(vpc: number, r: number, n: number): number {
  if (n <= 0 || !Number.isFinite(vpc)) return NaN;
  const factor = Math.pow(1 + r, n);
  const denominator = factor - 1;
  if (denominator === 0) return NaN;
  return vpc * (r * factor) / denominator;
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function IndicadoresDecisionTab({ project }: { project: Project }) {
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));

  const alternativasAll = formulation.identificacion?.alternativas || [];
  const alternatives = alternativasAll.filter((alt: any) => alt.pasaPreparacion === true);

  const prepData = formulation.preparacion;

  const [accordionOpen, setAccordionOpen] = useState(true);
  const [accordionCapOpen, setAccordionCapOpen] = useState(true);

  // ─── Core computation (memoised) ────────────────────────────────────────────
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

      // Beneficiarios from population objetivo (identified in formulation)
      const poblacion = formulation.identificacion?.poblacion;
      const totalBeneficiarios = poblacion?.objetivo?.numero || 0;
      const costoBeneficiario = totalBeneficiarios > 0 && Number.isFinite(vpc) ? vpc / totalBeneficiarios : NaN;

      // Per-product cost (for "Costo por capacidad")
      const cadena: CadenaValorAlternativa | undefined = prepData.cadenaValorPrep?.[altId];
      const productos: AltIndicators['productos'] = [];

      if (cadena?.objetivos) {
        Object.values(cadena.objetivos).forEach((obj) => {
          if (obj.productos) {
            obj.productos.forEach((prod: ProductoCvJson) => {
              // Compute VPC of this specific product
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

  // ─── Best-value detection ───────────────────────────────────────────────────
  const bestIndices = useMemo(() => {
    if (indicators.length === 0) return { vpn: -1, tir: -1, rbc: -1, costoBenef: -1, vpc: -1, cae: -1 };

    const finite = (v: number) => Number.isFinite(v);

    // Higher is better
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

  // ─── Empty state ────────────────────────────────────────────────────────────
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

      {/* ─── Acordeón 01: Evaluación económica ───────────────────────────── */}
      <MgaAccordion
        number="01"
        title="Evaluación económica"
        open={accordionOpen}
        onToggle={() => setAccordionOpen(!accordionOpen)}
      >
        <div className="overflow-x-auto border rounded-lg bg-white">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              {/* Group headers */}
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

      {/* ─── Acordeón 02: Costo por capacidad ────────────────────────────── */}
      <MgaAccordion
        number="02"
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

          // Find min cost per capacity within this alternative
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
    </div>
  );
}
