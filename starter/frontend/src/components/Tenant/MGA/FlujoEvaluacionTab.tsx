import { useMemo, useState, useEffect } from 'react';
import { HelpCircle, AlertTriangle } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore } from '../../../store/projectMgaStore';
import MgaAccordion from './MgaAccordion';

function financialFormat(value: number): string {
  return new Intl.NumberFormat('es-CO', { 
    style: 'currency', 
    currency: 'COP', 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
  }).format(value);
}

export default function FlujoEvaluacionTab({ project }: { project: Project }) {
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));
  
  const alternativasAll = formulation.identificacion?.alternativas || [];
  const alternatives = alternativasAll.filter((alt: any) => alt.pasaPreparacion === true);
  
  const [selectedAlternativeId, setSelectedAlternativeId] = useState<string>('');

  useEffect(() => {
    if (alternatives.length > 0 && !selectedAlternativeId) {
      setSelectedAlternativeId(alternatives[0].id);
    }
  }, [alternatives, selectedAlternativeId]);

  const prepData = formulation.preparacion;

  const { periods, rows, totals } = useMemo(() => {
    const emptyRows = {
      ingresos: {} as Record<number, number>,
      creditos: {} as Record<number, number>,
      preinversion: {} as Record<number, number>,
      inversion: {} as Record<number, number>,
      operacion: {} as Record<number, number>,
      amortizacion: {} as Record<number, number>,
      intereses: {} as Record<number, number>,
      salvamento: {} as Record<number, number>,
    };

    if (!selectedAlternativeId || !prepData) {
      return { periods: [] as number[], rows: emptyRows, totals: {} as Record<number, number> };
    }

    const ingresos = prepData.ingresosBeneficios?.[selectedAlternativeId] || [];
    const prestamos = prepData.prestamos?.[selectedAlternativeId] || [];
    const cadena = prepData.cadenaValorPrep?.[selectedAlternativeId];
    const depreciaciones = prepData.depreciacion?.[selectedAlternativeId] || [];

    const allPeriods = new Set<number>();
    allPeriods.add(0);

    const dataRows = { ...emptyRows };

    // 1. Ingresos y Beneficios
    ingresos.forEach(ing => {
      if (ing.proyecciones) {
        ing.proyecciones.forEach(p => {
          allPeriods.add(p.periodo);
          dataRows.ingresos[p.periodo] = (dataRows.ingresos[p.periodo] || 0) + (p.valorTotal || 0);
        });
      }
    });

    // 2. Préstamos (Créditos, Amortización, Intereses)
    prestamos.forEach(pres => {
      if (pres.periodoInicio !== undefined) {
        allPeriods.add(pres.periodoInicio);
        dataRows.creditos[pres.periodoInicio] = (dataRows.creditos[pres.periodoInicio] || 0) + (pres.valorCreditoCop || 0);
      }
      
      if (pres.tablaAmortizacion) {
        pres.tablaAmortizacion.forEach(t => {
          allPeriods.add(t.periodo);
          dataRows.amortizacion[t.periodo] = (dataRows.amortizacion[t.periodo] || 0) + (t.amortizacion || 0);
          dataRows.intereses[t.periodo] = (dataRows.intereses[t.periodo] || 0) + (t.interes || 0);
        });
      }
    });

    // 3. Cadena de Valor (Costos)
    if (cadena && cadena.objetivos) {
      Object.values(cadena.objetivos).forEach(obj => {
        if (obj.productos) {
          obj.productos.forEach(prod => {
            if (prod.actividades) {
              prod.actividades.forEach(act => {
                if (act.costos) {
                  act.costos.forEach(costo => {
                    allPeriods.add(costo.periodo);
                    const val = costo.valor || 0;
                    if (prod.etapa === 'Preinversión') {
                      dataRows.preinversion[costo.periodo] = (dataRows.preinversion[costo.periodo] || 0) + val;
                    } else if (prod.etapa === 'Inversión') {
                      dataRows.inversion[costo.periodo] = (dataRows.inversion[costo.periodo] || 0) + val;
                    } else if (prod.etapa === 'Operación') {
                      dataRows.operacion[costo.periodo] = (dataRows.operacion[costo.periodo] || 0) + val;
                    }
                  });
                }
              });
            }
          });
        }
      });
    }

    // 4. Depreciación (Valor de salvamento en periodoFinal)
    depreciaciones.forEach(dep => {
      if (dep.periodoFinal !== undefined) {
        allPeriods.add(dep.periodoFinal);
        dataRows.salvamento[dep.periodoFinal] = (dataRows.salvamento[dep.periodoFinal] || 0) + (dep.valorSalvamento || 0);
      }
    });

    const periodList = Array.from(allPeriods).sort((a, b) => a - b);
    const maxPeriod = periodList.length > 0 ? periodList[periodList.length - 1] : 0;
    
    const finalPeriods = [];
    for (let i = 0; i <= maxPeriod; i++) {
      finalPeriods.push(i);
    }

    const totalsObj: Record<number, number> = {};
    finalPeriods.forEach(p => {
      const positive = (dataRows.ingresos[p] || 0) + (dataRows.creditos[p] || 0) + (dataRows.salvamento[p] || 0);
      const negative = (dataRows.preinversion[p] || 0) + (dataRows.inversion[p] || 0) + (dataRows.operacion[p] || 0) + (dataRows.amortizacion[p] || 0) + (dataRows.intereses[p] || 0);
      totalsObj[p] = positive - negative;
    });

    return { periods: finalPeriods, rows: dataRows, totals: totalsObj };
  }, [selectedAlternativeId, prepData]);

  if (alternatives.length === 0) {
    return (
      <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
        <div className="flex items-center gap-2 border-b pb-3">
          <h1 className="text-xl font-normal text-[#2980b9]">Ver Flujo</h1>
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
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">Flujo Neto de Caja</h1>
        <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
      </div>

      <div className="flex items-center gap-4 bg-slate-50 p-3 rounded border">
        <label className="font-semibold text-slate-700 whitespace-nowrap">Alternativa:</label>
        <select
          value={selectedAlternativeId}
          onChange={(e) => setSelectedAlternativeId(e.target.value)}
          className="flex-1 p-2 border border-slate-300 rounded bg-white outline-none focus:border-[#2980b9] font-medium"
        >
          {alternatives.map((alt: any) => (
            <option key={alt.id} value={alt.id}>{alt.nombre || alt.description || 'Alternativa sin nombre'}</option>
          ))}
        </select>
      </div>

      <MgaAccordion number="01" title="Flujo Económico" open={true} onToggle={() => {}}>
        <div className="overflow-x-auto border rounded-lg bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#6c757d] text-white text-xs">
                <th className="p-2 border border-[#5a6268] min-w-[200px]">Concepto / Periodo</th>
                {periods.map(p => (
                  <th key={p} className="p-2 border border-[#5a6268] text-right min-w-[120px]">Periodo {p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Ingresos / Beneficios */}
              <tr className="border-b hover:bg-slate-50">
                <td className="p-2 border font-semibold text-emerald-700 bg-emerald-50/50">+ Beneficios e ingresos</td>
                {periods.map(p => (
                  <td key={p} className="p-2 border text-right font-mono">{financialFormat(rows.ingresos[p] || 0)}</td>
                ))}
              </tr>
              <tr className="border-b hover:bg-slate-50">
                <td className="p-2 border font-semibold text-emerald-700 bg-emerald-50/50">+ Créditos</td>
                {periods.map(p => (
                  <td key={p} className="p-2 border text-right font-mono">{financialFormat(rows.creditos[p] || 0)}</td>
                ))}
              </tr>

              {/* Egresos / Costos */}
              <tr className="border-b hover:bg-slate-50">
                <td className="p-2 border font-semibold text-red-700 bg-red-50/50">- Costos de preinversión</td>
                {periods.map(p => (
                  <td key={p} className="p-2 border text-right font-mono">{financialFormat(rows.preinversion[p] || 0)}</td>
                ))}
              </tr>
              <tr className="border-b hover:bg-slate-50">
                <td className="p-2 border font-semibold text-red-700 bg-red-50/50">- Costos de inversión</td>
                {periods.map(p => (
                  <td key={p} className="p-2 border text-right font-mono">{financialFormat(rows.inversion[p] || 0)}</td>
                ))}
              </tr>
              <tr className="border-b hover:bg-slate-50">
                <td className="p-2 border font-semibold text-red-700 bg-red-50/50">- Costos de operación</td>
                {periods.map(p => (
                  <td key={p} className="p-2 border text-right font-mono">{financialFormat(rows.operacion[p] || 0)}</td>
                ))}
              </tr>
              <tr className="border-b hover:bg-slate-50">
                <td className="p-2 border font-semibold text-red-700 bg-red-50/50">- Amortización</td>
                {periods.map(p => (
                  <td key={p} className="p-2 border text-right font-mono">{financialFormat(rows.amortizacion[p] || 0)}</td>
                ))}
              </tr>
              <tr className="border-b hover:bg-slate-50">
                <td className="p-2 border font-semibold text-red-700 bg-red-50/50">- Intereses de los créditos</td>
                {periods.map(p => (
                  <td key={p} className="p-2 border text-right font-mono">{financialFormat(rows.intereses[p] || 0)}</td>
                ))}
              </tr>
              
              {/* Valor de salvamento */}
              <tr className="border-b hover:bg-slate-50">
                <td className="p-2 border font-semibold text-emerald-700 bg-emerald-50/50">+ Valor de salvamento</td>
                {periods.map(p => (
                  <td key={p} className="p-2 border text-right font-mono">{financialFormat(rows.salvamento[p] || 0)}</td>
                ))}
              </tr>
            </tbody>
            <tfoot>
              <tr className="bg-slate-200">
                <td className="p-3 border text-slate-900 font-bold text-sm">Flujo neto de caja</td>
                {periods.map(p => {
                  const isNegative = totals[p] < 0;
                  return (
                    <td key={p} className={`p-3 border text-right font-mono font-bold ${isNegative ? 'text-red-700' : 'text-slate-900'}`}>
                      {financialFormat(totals[p] || 0)}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </MgaAccordion>
    </div>
  );
}
