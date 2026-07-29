import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import CreateProjectModal from '../../components/Tenant/CreateProjectModal';
import { useAuth } from '../../context/AuthContext';
import { useProjectStore } from '../../store/projectStore';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function statusProgress(status: string): number {
  const map: Record<string, number> = {
    DRAFT: 15,
    IN_FORMULATION: 45,
    SUBMITTED: 70,
    APPROVED: 100,
    REJECTED: 100,
    ARCHIVED: 100,
  };
  return map[status] ?? 30;
}

export default function ProjectsDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const isLoading = useProjectStore((s) => s.isLoading);
  const error = useProjectStore((s) => s.error);
  const fetchProjects = useProjectStore((s) => s.fetchProjects);
  const evaluationSummary = useProjectStore((s) => s.evaluationSummary);
  const fetchEvaluationSummary = useProjectStore((s) => s.fetchEvaluationSummary);
  const clearError = useProjectStore((s) => s.clearError);

  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    void fetchProjects();
    void fetchEvaluationSummary();
  }, [fetchProjects, fetchEvaluationSummary]);

  const chartData = useMemo(() => {
    return evaluationSummary.map((item) => {
      const project = projects.find((p) => p.id === item.project_id);
      const label = project?.name
        ? project.name.length > 18
          ? `${project.name.slice(0, 18)}…`
          : project.name
        : item.alternative_name.slice(0, 18);
      return {
        name: label,
        vpn: Math.round(item.vpn),
        tir: item.tir != null ? Math.round(item.tir * 10000) / 100 : 0,
      };
    });
  }, [evaluationSummary, projects]);

  const stats = useMemo(() => {
    const active = projects.filter((p) =>
      ['DRAFT', 'IN_FORMULATION', 'SUBMITTED'].includes(p.status),
    ).length;
    const review = projects.filter((p) => p.status === 'SUBMITTED').length;
    const approved = projects.filter((p) => p.status === 'APPROVED').length;
    return { active, review, approved };
  }, [projects]);

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
            Bienvenido{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
          </h2>
          <p className="text-base md:text-lg text-gray-600 max-w-2xl">
            Gestione y formule sus proyectos de inversión pública con cumplimiento normativo MGA.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="h-14 px-8 bg-[#006162] hover:bg-[#004f50] text-white rounded-lg font-semibold text-lg inline-flex items-center justify-center gap-2 shadow-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#006162] whitespace-nowrap"
        >
          <span className="material-symbols-outlined">add_circle</span>
          Crear nuevo proyecto
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start justify-between gap-3 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{error}</span>
          <button type="button" onClick={clearError} aria-label="Cerrar">
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Activos', value: stats.active, icon: 'task', bg: 'bg-teal-100' },
          { label: 'En revisión', value: stats.review, icon: 'history', bg: 'bg-cyan-100' },
          { label: 'Viabilizados', value: stats.approved, icon: 'verified', bg: 'bg-emerald-100' },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-4"
          >
            <div className={`w-14 h-14 ${s.bg} rounded-lg flex items-center justify-center text-[#006162]`}>
              <span className="material-symbols-outlined text-3xl">{s.icon}</span>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{s.label}</p>
              <p className="text-xl font-semibold text-gray-900">{s.value} proyectos</p>
            </div>
          </div>
        ))}
      </div>

      {chartData.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Indicadores financieros (motor Go)</h3>
          <p className="text-sm text-gray-500 mb-4">VPN y TIR (%) de la última evaluación por proyecto.</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="vpn" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="tir" orientation="right" tick={{ fontSize: 11 }} unit="%" />
                <Tooltip
                  formatter={(value, name) => {
                    const num = typeof value === 'number' ? value : Number(value ?? 0);
                    return name === 'tir'
                      ? [`${num}%`, 'TIR']
                      : [num.toLocaleString('es-CO'), 'VPN'];
                  }}
                />
                <Legend />
                <Bar yAxisId="vpn" dataKey="vpn" name="VPN" fill="#006162" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="tir" dataKey="tir" name="TIR (%)" fill="#2c7a7b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <h3 className="text-xl font-semibold text-gray-900 mb-4">Proyectos en formulación</h3>

      {isLoading && projects.length === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse h-64" />
          ))}
        </div>
      )}

      {!isLoading && projects.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <span className="material-symbols-outlined text-4xl text-[#006162] mb-2">folder_open</span>
          <p className="text-gray-600 mb-4">Aún no hay proyectos. Crea el primero para iniciar.</p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1 px-4 py-2 bg-[#006162] text-white rounded-lg hover:bg-[#004f50]"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Crear proyecto
          </button>
        </div>
      )}

      {projects.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const progress = statusProgress(project.status);
            return (
              <div
                key={project.id}
                className="bg-white p-5 rounded-xl border border-gray-200 flex flex-col h-full relative overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all"
              >
                <div className="absolute top-3 right-3">
                  <span className="px-2 py-1 bg-teal-100 text-[#006162] text-xs font-bold rounded-full uppercase">
                    {project.status}
                  </span>
                </div>
                <div className="mb-4 pr-16">
                  <span className="material-symbols-outlined text-[#006162] mb-2">category</span>
                  <h4 className="text-lg font-semibold text-gray-900 leading-tight mb-1 line-clamp-2">
                    {project.name}
                  </h4>
                  <p className="text-sm text-gray-500">
                    {project.code_bpin ? `BPIN: ${project.code_bpin}` : 'Sin BPIN'} · {project.sector}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{formatDate(project.created_at)}</p>
                </div>
                <div className="mt-auto">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-sm text-gray-500">Avance</span>
                    <span className="font-bold text-[#006162]">{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mb-4">
                    <div
                      className="bg-[#006162] h-full rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <Link
                    to={`/tenant/projects/${project.id}`}
                    className="w-full h-12 bg-[#006162] hover:bg-[#004f50] text-white rounded-lg font-semibold inline-flex items-center justify-center gap-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#006162]"
                  >
                    Continuar formulando
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-10 p-8 rounded-2xl bg-[#2c7a7b] text-white flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="max-w-xl">
          <h3 className="text-xl md:text-2xl font-semibold mb-2">¿Necesitas ayuda técnica?</h3>
          <p className="text-white/90">
            Aurora conoce los lineamientos del DNP y puede ayudarte a completar la cadena de valor de
            tu proyecto.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/tenant/ai')}
          className="h-14 px-8 bg-white text-[#006162] rounded-lg font-semibold inline-flex items-center gap-2 hover:bg-teal-50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white shrink-0"
        >
          <span className="material-symbols-outlined">bolt</span>
          Consultar asistente
        </button>
      </div>

      <CreateProjectModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
