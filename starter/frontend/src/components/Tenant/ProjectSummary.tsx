import { useMemo } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { formatMoney } from './BudgetManager';

export default function ProjectSummary() {
  const project = useProjectStore((s) => s.currentProject);
  const budget = useProjectStore((s) => s.budget);

  const total = useMemo(
    () => budget.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [budget],
  );

  if (!project) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-100 p-6 text-gray-500">
        No hay proyecto cargado para mostrar el resumen.
      </div>
    );
  }

  const createdLabel = new Date(project.created_at).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-4 print:space-y-0">
      <div className="flex justify-end print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1 rounded bg-[#006162] hover:bg-[#004f50] text-white px-4 py-2 text-sm font-medium"
        >
          <span className="material-symbols-outlined text-base">print</span>
          Exportar / Imprimir
        </button>
      </div>

      <article
        id="project-summary-print"
        className="bg-white rounded-lg shadow border border-gray-100 p-8 text-gray-900 print:shadow-none print:border-0 print:rounded-none print:bg-white print:p-0 print:m-0 print:w-full"
      >
        <header className="border-b-2 border-[#006162] pb-4 mb-6 print:border-black">
          <p className="text-xs uppercase tracking-widest text-[#006162] print:text-black font-semibold mb-1">
            AuroraApp · Resumen ejecutivo MGA
          </p>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">{project.name}</h1>
          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-gray-500 print:text-gray-700">Sector</dt>
              <dd className="font-medium">{project.sector || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500 print:text-gray-700">Código BPIN</dt>
              <dd className="font-medium">{project.code_bpin || 'No asignado'}</dd>
            </div>
            <div>
              <dt className="text-gray-500 print:text-gray-700">Fecha</dt>
              <dd className="font-medium">{createdLabel}</dd>
            </div>
          </dl>
        </header>

        <section className="mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#006162] print:text-black mb-2">
            1. Descripción del problema
          </h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-800 print:text-black">
            {project.problem_description?.trim() || 'Sin información registrada.'}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#006162] print:text-black mb-2">
            2. Objetivo general
          </h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-800 print:text-black">
            {project.general_objective?.trim() || 'Sin información registrada.'}
          </p>
        </section>

        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#006162] print:text-black mb-3">
            3. Presupuesto
          </h2>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-300 text-left">
                <th className="py-2 pr-2 font-semibold text-gray-700 print:text-black">#</th>
                <th className="py-2 pr-2 font-semibold text-gray-700 print:text-black">Descripción</th>
                <th className="py-2 pr-2 font-semibold text-gray-700 print:text-black">Producto DNP</th>
                <th className="py-2 text-right font-semibold text-gray-700 print:text-black">Monto</th>
              </tr>
            </thead>
            <tbody>
              {budget.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-500 print:text-black">
                    No hay ítems de presupuesto registrados.
                  </td>
                </tr>
              )}
              {budget.map((item, index) => (
                <tr key={item.id} className="border-b border-gray-100 print:border-gray-300">
                  <td className="py-2 pr-2 text-gray-500 print:text-black">{index + 1}</td>
                  <td className="py-2 pr-2 text-gray-800 print:text-black">{item.description}</td>
                  <td className="py-2 pr-2 text-gray-700 print:text-black">
                    {item.product_id ? 'Vinculado' : '—'}
                  </td>
                  <td className="py-2 text-right tabular-nums font-medium text-gray-900 print:text-black">
                    {formatMoney(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="pt-4 text-right font-bold text-gray-900 print:text-black">
                  Gran total
                </td>
                <td className="pt-4 text-right text-lg font-bold tabular-nums text-[#006162] print:text-black">
                  {formatMoney(total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        <footer className="mt-10 pt-4 border-t border-gray-200 text-xs text-gray-500 print:text-gray-700 print:border-black">
          Documento generado desde AuroraApp · Estado del proyecto: {project.status}
        </footer>
      </article>
    </div>
  );
}
