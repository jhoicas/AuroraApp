import { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useProjectStore } from '../../store/projectStore';
import { formatMoney } from './BudgetManager';
import MgaPdfExportButton from './MGA/MgaPdfExportButton';

export default function ProjectSummary() {
  const project = useProjectStore((s) => s.currentProject);
  const budget = useProjectStore((s) => s.budget);
  const { user } = useAuth();

  const total = useMemo(
    () => budget.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [budget],
  );

  if (!project) {
    return (
      <div className="rounded-lg border border-gray-100 bg-white p-6 text-gray-500 shadow">
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <MgaPdfExportButton
          project={project}
          formuladorLabel={user?.full_name || user?.email || 'Usuario'}
          formuladorType="Formulador oficial"
        />
      </div>

      <article className="rounded-lg border border-gray-100 bg-white p-8 text-gray-900 shadow">
        <header className="mb-6 border-b-2 border-primary pb-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
            AuroraApp · Resumen ejecutivo MGA
          </p>
          <h1 className="text-2xl font-bold leading-tight text-gray-900">{project.name}</h1>
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-gray-500">Sector</dt>
              <dd className="font-medium">{project.sector || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Código BPIN</dt>
              <dd className="font-medium">{project.code_bpin || 'No asignado'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Fecha</dt>
              <dd className="font-medium">{createdLabel}</dd>
            </div>
          </dl>
        </header>

        <section className="mb-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-primary">
            1. Descripción del problema
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
            {project.problem_description?.trim() || 'Sin información registrada.'}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-primary">
            2. Objetivo general
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
            {project.general_objective?.trim() || 'Sin información registrada.'}
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-primary">
            3. Presupuesto
          </h2>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-300 text-left">
                <th className="py-2 pr-2 font-semibold text-gray-700">#</th>
                <th className="py-2 pr-2 font-semibold text-gray-700">Descripción</th>
                <th className="py-2 pr-2 font-semibold text-gray-700">Producto DNP</th>
                <th className="py-2 text-right font-semibold text-gray-700">Monto</th>
              </tr>
            </thead>
            <tbody>
              {budget.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-500">
                    No hay ítems de presupuesto registrados.
                  </td>
                </tr>
              )}
              {budget.map((item, index) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-2 pr-2 text-gray-500">{index + 1}</td>
                  <td className="py-2 pr-2 text-gray-800">{item.description}</td>
                  <td className="py-2 pr-2 text-gray-700">
                    {item.product_id ? 'Vinculado' : '—'}
                  </td>
                  <td className="py-2 text-right font-medium tabular-nums text-gray-900">
                    {formatMoney(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="pt-4 text-right font-bold text-gray-900">
                  Gran total
                </td>
                <td className="pt-4 text-right text-lg font-bold tabular-nums text-primary">
                  {formatMoney(total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        <footer className="mt-10 border-t border-gray-200 pt-4 text-xs text-gray-500">
          Documento generado desde AuroraApp · Estado del proyecto: {project.status}
        </footer>
      </article>
    </div>
  );
}
