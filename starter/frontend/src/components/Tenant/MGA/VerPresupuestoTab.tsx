import { useMemo, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore } from '../../../store/projectMgaStore';
import MgaAccordion from './MgaAccordion';
import MgaActionButtons from './MgaActionButtons';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(value)
    .replace(/ /g, ' ');
}

type CostRow = {
  key: string;
  kind: 'item' | 'subtotal-producto' | 'subtotal-objetivo' | 'total-proyecto';
  objetivoGeneral: string;
  objetivoEspecifico: string;
  producto: string;
  detalle: string;
  porPeriodo: Record<number, number>;
};

function sumInto(target: Record<number, number>, source: Record<number, number>) {
  Object.entries(source).forEach(([p, v]) => {
    target[Number(p)] = (target[Number(p)] || 0) + v;
  });
}

function rowTotal(porPeriodo: Record<number, number>): number {
  return Object.values(porPeriodo).reduce((acc, v) => acc + v, 0);
}

export default function VerPresupuestoTab({ project }: { project: Project }) {
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));
  const [accordionOpen, setAccordionOpen] = useState(true);

  const alternatives = (formulation.identificacion?.alternativas || []).filter(
    (alt: any) => alt.pasaPreparacion === true,
  );
  const selectedId = formulation.evaluacion?.alternativaSeleccionadaId;
  const altId =
    (selectedId && alternatives.some((a: any) => a.id === selectedId) ? selectedId : alternatives[0]?.id) || '';

  const { periods, rows } = useMemo(() => {
    const objetivos = formulation.preparacion?.cadenaValorPrep?.[altId]?.objetivos || {};
    const objetivosEsp = formulation.identificacion?.objetivos?.objetivosEspecificos || {};
    const objetivoGeneral = formulation.identificacion?.objetivos?.objetivoGeneral || '';

    const periodSet = new Set<number>([0]);
    const list: CostRow[] = [];
    const projectTotals: Record<number, number> = {};
    let first = true;

    Object.entries(objetivos).forEach(([objId, obj]) => {
      const objetivoNombre = objetivosEsp[objId] || objId;
      const objTotals: Record<number, number> = {};

      (obj.productos || []).forEach((prod) => {
        const prodNombre = [prod.descripcion, prod.complemento].filter(Boolean).join(' - ') || 'Producto';
        const prodTotals: Record<number, number> = {};

        const items = [
          ...(prod.actividades || []).map((a) => ({ ...a, tag: '(A)' })),
          ...(prod.entregables || []).map((e) => ({ ...e, tag: '(E)' })),
        ];
        items.forEach((item) => {
          const porPeriodo: Record<number, number> = {};
          (item.costos || []).forEach((c) => {
            periodSet.add(c.periodo);
            porPeriodo[c.periodo] = (porPeriodo[c.periodo] || 0) + (c.valor || 0);
          });
          sumInto(prodTotals, porPeriodo);
          list.push({
            key: `${objId}-${prod.id}-${item.id}`,
            kind: 'item',
            objetivoGeneral: first ? objetivoGeneral : '',
            objetivoEspecifico: objetivoNombre,
            producto: prodNombre,
            detalle: `${item.tag} ${item.nombre}`,
            porPeriodo,
          });
          first = false;
        });

        sumInto(objTotals, prodTotals);
        list.push({
          key: `tp-${objId}-${prod.id}`,
          kind: 'subtotal-producto',
          objetivoGeneral: '',
          objetivoEspecifico: '',
          producto: '',
          detalle: 'Total Producto',
          porPeriodo: prodTotals,
        });
      });

      sumInto(projectTotals, objTotals);
      list.push({
        key: `to-${objId}`,
        kind: 'subtotal-objetivo',
        objetivoGeneral: '',
        objetivoEspecifico: '',
        producto: '',
        detalle: 'Total Objetivo',
        porPeriodo: objTotals,
      });
    });

    if (list.length > 0) {
      list.push({
        key: 'total-proyecto',
        kind: 'total-proyecto',
        objetivoGeneral: '',
        objetivoEspecifico: '',
        producto: '',
        detalle: 'Total Proyecto',
        porPeriodo: projectTotals,
      });
    }

    const maxPeriod = Math.max(...periodSet);
    return { periods: Array.from({ length: maxPeriod + 1 }, (_, i) => i), rows: list };
  }, [formulation.preparacion?.cadenaValorPrep, formulation.identificacion?.objetivos, altId]);

  const rowClass = (kind: CostRow['kind']) =>
    kind === 'total-proyecto'
      ? 'bg-slate-200 font-bold'
      : kind === 'subtotal-objetivo'
        ? 'bg-slate-100 font-semibold'
        : kind === 'subtotal-producto'
          ? 'bg-slate-50 font-semibold'
          : '';

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">Presupuesto</h1>
        <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
      </div>

      <MgaAccordion
        number="01"
        title="Resumen de costos por periodo y nivel de planeación"
        open={accordionOpen}
        onToggle={() => setAccordionOpen(!accordionOpen)}
      >
        <div className="overflow-x-auto border rounded">
          <table className="w-full text-left">
            <thead className="bg-[#6c757d] text-white">
              <tr>
                <th className="p-2 border">Objetivo General</th>
                <th className="p-2 border">Objetivo Específico</th>
                <th className="p-2 border">Producto</th>
                <th className="p-2 border">(A)Actividad / (E)Entregable</th>
                {periods.map((p) => (
                  <th key={p} className="p-2 border text-right whitespace-nowrap">
                    Periodo {p}
                  </th>
                ))}
                <th className="p-2 border text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5 + periods.length} className="p-4 text-center text-gray-500">
                    No hay costos registrados en la cadena de valor.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.key} className={`border-b ${rowClass(r.kind)}`}>
                    <td className="p-2 border">{r.objetivoGeneral}</td>
                    <td className="p-2 border">{r.objetivoEspecifico}</td>
                    <td className="p-2 border">{r.producto}</td>
                    <td className="p-2 border">{r.detalle}</td>
                    {periods.map((p) => (
                      <td key={p} className="p-2 border text-right whitespace-nowrap">
                        {formatCurrency(r.porPeriodo[p] || 0)}
                      </td>
                    ))}
                    <td className="p-2 border text-right whitespace-nowrap font-semibold">
                      {formatCurrency(rowTotal(r.porPeriodo))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </MgaAccordion>

      <div className="mt-8">
        <MgaActionButtons project={project} onSave={() => undefined} />
      </div>
    </div>
  );
}
