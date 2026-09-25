import React, { useEffect, useState, useCallback } from 'react';
import {
  getInvestmentPipelineReport,
  type InvestmentPipelineReportResponse,
} from '../../lib/api';

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCompactCOP(amount: number): string {
  if (amount >= 1_000_000_000_000) {
    return `$ ${(amount / 1_000_000_000_000).toFixed(2)} Billones`;
  }
  if (amount >= 1_000_000_000) {
    return `$ ${(amount / 1_000_000_000).toFixed(1)} Mil Millones`;
  }
  if (amount >= 1_000_000) {
    return `$ ${(amount / 1_000_000).toFixed(1)} Millones`;
  }
  return formatCOP(amount);
}

// Iconos e información de pasos para el embudo de ciclo de vida MGA
const FUNNEL_CONFIG: Record<
  string,
  { icon: string; color: string; border: string; bg: string; badgeBg: string; text: string }
> = {
  IDEATION: {
    icon: 'lightbulb',
    color: 'text-amber-600',
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    badgeBg: 'bg-amber-100 text-amber-800',
    text: 'Identificación y árbol de problemas',
  },
  FORMULATION: {
    icon: 'edit_note',
    color: 'text-blue-600',
    border: 'border-blue-200',
    bg: 'bg-blue-50',
    badgeBg: 'bg-blue-100 text-blue-800',
    text: 'Cadena de valor, EDT y costos',
  },
  AUDIT: {
    icon: 'fact_check',
    color: 'text-indigo-600',
    border: 'border-indigo-200',
    bg: 'bg-indigo-50',
    badgeBg: 'bg-indigo-100 text-indigo-800',
    text: 'Auditoría previa y cumplimiento',
  },
  VIABLE: {
    icon: 'verified',
    color: 'text-emerald-600',
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
    badgeBg: 'bg-emerald-100 text-emerald-800',
    text: 'Dictamen y concepto técnico',
  },
  APPROVED: {
    icon: 'task_alt',
    color: 'text-teal-700',
    border: 'border-teal-200',
    bg: 'bg-teal-50',
    badgeBg: 'bg-teal-100 text-teal-800',
    text: 'Listo para radicación y BPPD',
  },
};

export default function ReportsPage() {
  const [data, setData] = useState<InvestmentPipelineReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await getInvestmentPipelineReport();
      setData(response);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al consultar el reporte de inversión';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 pb-12 print:p-0 print:space-y-6">
      {/* Cabecera Ejecutiva */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-200 pb-5 print:border-b-2 print:border-gray-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[#006162] text-2xl print:text-gray-900">
              account_balance
            </span>
            <span className="text-xs uppercase tracking-wider font-semibold text-[#006162]">
              Visión Directiva &amp; Planeación Territorial
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">
            Pipeline de Inversión Pública
          </h1>
          <p className="text-sm md:text-base text-gray-600 max-w-3xl mt-1">
            Panel de control financiero de proyectos MGA, embudo de maduración y distribución presupuestal por sector DNP.
          </p>
        </div>

        {/* Acciones Directivas */}
        <div className="flex items-center gap-3 print:hidden shrink-0">
          <button
            type="button"
            onClick={() => void loadReport(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#006162] shadow-sm disabled:opacity-50 transition-colors"
            title="Actualizar datos"
          >
            <span
              className={`material-symbols-outlined text-lg ${
                refreshing ? 'animate-spin text-[#006162]' : 'text-gray-500'
              }`}
            >
              refresh
            </span>
            {refreshing ? 'Actualizando...' : 'Actualizar'}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#006162] hover:bg-[#004f50] rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#006162] focus:ring-offset-2 transition-colors"
            title="Imprimir o exportar PDF"
          >
            <span className="material-symbols-outlined text-lg">print</span>
            Imprimir Informe
          </button>
        </div>
      </header>

      {/* Estado de Error */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl border border-red-200 bg-red-50 flex items-start justify-between gap-4 text-red-800"
        >
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-red-600 mt-0.5">error</span>
            <div>
              <p className="font-semibold text-sm">No fue posible cargar el informe gerencial</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadReport()}
            className="px-3 py-1.5 bg-white border border-red-300 text-xs font-medium text-red-700 rounded-md hover:bg-red-100 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Estado de Carga (Esqueleto) */}
      {loading && !data && (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl" />
            ))}
          </div>
          <div className="h-48 bg-gray-200 rounded-xl" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      )}

      {/* Contenido Principal del Dashboard */}
      {data && (
        <>
          {/* Grilla de Tarjetas KPI (4 Cards) */}
          <section aria-labelledby="kpis-heading">
            <h2 id="kpis-heading" className="sr-only">
              Indicadores Clave de Inversión
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Presupuesto Total */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-gray-500 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Presupuesto Estructurado
                  </span>
                  <div className="w-10 h-10 rounded-lg bg-teal-50 text-[#006162] flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">payments</span>
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-gray-900 tracking-tight">
                    {formatCOP(data.kpis.total_budget)}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-teal-700 font-medium">
                    <span className="inline-block w-2 h-2 rounded-full bg-teal-500" />
                    <span>{formatCompactCOP(data.kpis.total_budget)}</span>
                    <span className="text-gray-400">| Total acumulado</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Proyectos Activos */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-gray-500 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Proyectos en Portafolio
                  </span>
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">folder_managed</span>
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-gray-900 tracking-tight">
                    {data.kpis.total_projects}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-blue-700 font-medium">
                    <span className="px-1.5 py-0.5 bg-blue-100 rounded text-[11px] font-semibold">
                      En gestión
                    </span>
                    <span className="text-gray-500">Iniciativas del municipio</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Costo Promedio */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-gray-500 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Costo Promedio / Proyecto
                  </span>
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">pie_chart</span>
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-gray-900 tracking-tight">
                    {formatCOP(data.kpis.average_project_cost)}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-indigo-700 font-medium">
                    <span>Inversión media proyectada</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Proyectos Listos para Viabilidad */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-gray-500 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Listos para Viabilidad
                  </span>
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">fact_check</span>
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-emerald-700 tracking-tight">
                    {data.kpis.viable_projects_count}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-800 font-medium">
                    <span className="px-1.5 py-0.5 bg-emerald-100 rounded text-[11px] font-semibold">
                      Fase avanzada
                    </span>
                    <span className="text-gray-500">Listos para radicación</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Sección Embudo de Estados (Funnel de Ciclo de Vida MGA) */}
          <section
            aria-labelledby="funnel-heading"
            className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006162]">timeline</span>
                  <h3 id="funnel-heading" className="text-lg font-bold text-gray-900">
                    Embudo del Ciclo de Vida de Inversión
                  </h3>
                </div>
                <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                  Progresión de proyectos desde la identificación de la problemática hasta la viabilidad y aprobación formal.
                </p>
              </div>

              <div className="text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 shrink-0">
                Total:{' '}
                <strong className="text-gray-800">{data.kpis.total_projects}</strong> proyectos |{' '}
                <strong className="text-gray-800">{formatCompactCOP(data.kpis.total_budget)}</strong>
              </div>
            </div>

            {/* Pasos Visuales del Embudo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {data.status_funnel.map((stage, idx) => {
                const conf = FUNNEL_CONFIG[stage.status] || {
                  icon: 'pending',
                  color: 'text-gray-600',
                  border: 'border-gray-200',
                  bg: 'bg-gray-50',
                  badgeBg: 'bg-gray-100 text-gray-700',
                  text: 'En proceso',
                };
                const stagePercent =
                  data.kpis.total_projects > 0
                    ? Math.round((stage.count / data.kpis.total_projects) * 100)
                    : 0;

                return (
                  <div
                    key={stage.status}
                    className={`relative p-4 rounded-xl border ${conf.border} ${conf.bg} flex flex-col justify-between`}
                  >
                    <div>
                      {/* Cabecera del paso */}
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className="text-[11px] font-bold text-gray-400">0{idx + 1}</span>
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${conf.badgeBg}`}
                        >
                          {stagePercent}%
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mb-1">
                        <span className={`material-symbols-outlined text-xl ${conf.color}`}>
                          {conf.icon}
                        </span>
                        <h4 className="font-bold text-gray-900 text-sm">{stage.label}</h4>
                      </div>

                      <p className="text-[11px] text-gray-500 line-clamp-2 leading-snug">
                        {conf.text}
                      </p>
                    </div>

                    {/* Métricas del paso */}
                    <div className="mt-4 pt-3 border-t border-gray-200/60">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xl font-extrabold text-gray-900">{stage.count}</span>
                        <span className="text-xs text-gray-500">
                          {stage.count === 1 ? 'proyecto' : 'proyectos'}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-gray-700 mt-1 truncate" title={formatCOP(stage.total_budget)}>
                        {formatCOP(stage.total_budget)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Sección Distribución Presupuestal por Sector DNP */}
          <section
            aria-labelledby="sectors-heading"
            className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006162]">category</span>
                  <h3 id="sectors-heading" className="text-lg font-bold text-gray-900">
                    Distribución de Inversión por Sector DNP
                  </h3>
                </div>
                <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                  Concentración presupuestal clasificada conforme a la taxonomía sectorial del Departamento Nacional de Planeación.
                </p>
              </div>

              <span className="text-xs font-medium text-gray-500">
                {data.sector_distribution.length} sectores con iniciativas registradas
              </span>
            </div>

            {data.sector_distribution.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No hay proyectos con sectores asignados en este momento.
              </div>
            ) : (
              <div className="space-y-4">
                {data.sector_distribution.map((sec, idx) => (
                  <div
                    key={`${sec.sector_code}-${sec.sector_name}-${idx}`}
                    className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2 py-0.5 text-xs font-mono font-bold bg-gray-200 text-gray-700 rounded">
                          {sec.sector_code !== 'SIN_SECTOR' ? sec.sector_code : 'N/A'}
                        </span>
                        <h4 className="font-bold text-gray-900 text-sm md:text-base">
                          {sec.sector_name}
                        </h4>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 font-medium">
                          {sec.project_count} {sec.project_count === 1 ? 'proyecto' : 'proyectos'}
                        </span>
                        <span className="text-sm md:text-base font-extrabold text-gray-900">
                          {formatCOP(sec.total_budget)}
                        </span>
                        <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-teal-100 text-teal-800">
                          {sec.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Barra de Progreso / Participación Visual */}
                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-[#006162] h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(Math.max(sec.percentage, 1), 100)}%` }}
                        role="progressbar"
                        aria-valuenow={sec.percentage}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Participación del sector ${sec.sector_name}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Tabla de Detalle y Resumen Directivo */}
          <section
            aria-labelledby="summary-heading"
            className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
          >
            <div className="p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 id="summary-heading" className="text-base font-bold text-gray-900">
                  Resumen Consolidado de Inversión Territorial
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Desglose tabular para auditoría directiva, rendición de cuentas y seguimiento PDD.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 tracking-wider border-b border-gray-200">
                  <tr>
                    <th scope="col" className="px-6 py-3.5">
                      Código DNP
                    </th>
                    <th scope="col" className="px-6 py-3.5">
                      Sector Administrativo
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-center">
                      Proyectos
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-right">
                      Presupuesto Asignado (COP)
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-right">
                      % Participación
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-medium">
                  {data.sector_distribution.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-sm">
                        No hay registros disponibles.
                      </td>
                    </tr>
                  ) : (
                    data.sector_distribution.map((row, idx) => (
                      <tr key={`row-${row.sector_code}-${idx}`} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-gray-700 font-semibold">
                          {row.sector_code}
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-900">
                          {row.sector_name}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800">
                            {row.project_count}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-gray-900">
                          {formatCOP(row.total_budget)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2 py-1 rounded-md">
                            {row.percentage.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {data.sector_distribution.length > 0 && (
                  <tfoot className="bg-gray-50 border-t-2 border-gray-300 font-bold text-gray-900">
                    <tr>
                      <td colSpan={2} className="px-6 py-3.5 uppercase text-xs tracking-wider">
                        Totales Consolidados
                      </td>
                      <td className="px-6 py-3.5 text-center text-sm font-extrabold">
                        {data.kpis.total_projects}
                      </td>
                      <td className="px-6 py-3.5 text-right text-sm font-extrabold text-[#006162]">
                        {formatCOP(data.kpis.total_budget)}
                      </td>
                      <td className="px-6 py-3.5 text-right text-xs font-extrabold text-teal-800">
                        100.0%
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
