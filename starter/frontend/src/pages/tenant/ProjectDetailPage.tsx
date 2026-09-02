import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import BudgetManager from '../../components/Tenant/BudgetManager';
import ProjectFormulation from '../../components/Tenant/ProjectFormulation';
import ProjectSummary from '../../components/Tenant/ProjectSummary';
import FormulationAuditPanel, {
  type MgaAuditTabId,
} from '../../components/Tenant/MGA/FormulationAuditPanel';
import MgaPdfExportButton from '../../components/Tenant/MGA/MgaPdfExportButton';
import { useAuth } from '../../context/AuthContext';
import { useProjectStore } from '../../store/projectStore';

type Tab = 'formulation' | 'budget' | 'summary';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const currentProject = useProjectStore((s) => s.currentProject);
  const isLoading = useProjectStore((s) => s.isLoading);
  const error = useProjectStore((s) => s.error);
  const fetchProjectById = useProjectStore((s) => s.fetchProjectById);
  const fetchBudget = useProjectStore((s) => s.fetchBudget);
  const clearCurrentProject = useProjectStore((s) => s.clearCurrentProject);
  const clearError = useProjectStore((s) => s.clearError);

  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>('formulation');
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [pendingMgaTab, setPendingMgaTab] = useState<MgaAuditTabId | null>(null);
  const formulationAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (location.pathname.endsWith('/formulation')) {
      setTab('formulation');
    }
  }, [location.pathname]);

  const handleAuditNavigateToTab = useCallback((tabId: MgaAuditTabId) => {
    setTab('formulation');
    setPendingMgaTab(tabId);
    setAuditModalOpen(false);
    window.requestAnimationFrame(() => {
      formulationAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    void fetchProjectById(id);
    void fetchBudget(id);
    return () => clearCurrentProject();
  }, [id, fetchProjectById, fetchBudget, clearCurrentProject]);

  if (isLoading && !currentProject) {
    return (
      <div className="bg-white rounded-lg shadow p-8 animate-pulse space-y-3 print:hidden">
        <div className="h-6 bg-gray-200 rounded w-1/2" />
        <div className="h-4 bg-gray-100 rounded w-1/3" />
        <div className="h-4 bg-gray-100 rounded w-2/3" />
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="bg-white rounded-lg shadow p-8 print:hidden">
        <p className="text-red-700">{error || 'Proyecto no encontrado'}</p>
        <Link
          to="/tenant/projects"
          className="inline-flex items-center gap-1 mt-4 text-[#006162] hover:underline"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Volver a proyectos
        </Link>
      </div>
    );
  }

  return (
    <div className="print:w-full print:m-0 print:p-0 print:bg-white">
      <div className="mb-4 print:hidden">
        <Link
          to="/tenant/projects"
          className="inline-flex items-center gap-1 text-sm text-[#006162] hover:underline"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Volver a proyectos
        </Link>
      </div>

      <div className="w-full min-w-0 print:w-full print:m-0 print:p-0">
        <div className="bg-white rounded-lg shadow border border-gray-100 p-6 mb-6 print:hidden">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{currentProject.name}</h2>
              <p className="text-sm text-gray-500 mt-1">{currentProject.sector}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setTab('formulation');
                  setAuditModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded border border-[#006162] bg-[#006162] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#004d4e]"
              >
                <span className="material-symbols-outlined text-base">fact_check</span>
                Validar y Enviar
              </button>
              <MgaPdfExportButton
                project={currentProject}
                formuladorLabel={user?.full_name || user?.email || 'Usuario'}
                formuladorType="Formulador oficial"
                variant="outline"
                className="border-[#2980b9] text-[#2980b9] hover:bg-blue-50"
              />
              <span className="inline-flex items-center rounded-full bg-teal-50 text-[#006162] px-2.5 py-0.5 text-xs font-medium">
                {currentProject.status}
              </span>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">BPIN</dt>
              <dd className="font-medium text-gray-800">{currentProject.code_bpin || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Creado</dt>
              <dd className="font-medium text-gray-800">
                {new Date(currentProject.created_at).toLocaleString('es-CO')}
              </dd>
            </div>
          </dl>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 flex items-start justify-between gap-3 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden"
          >
            <span>{error}</span>
            <button type="button" onClick={clearError} aria-label="Cerrar">
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        )}

        <div className="flex gap-2 mb-4 border-b border-gray-200 print:hidden">
          <button
            type="button"
            onClick={() => setTab('formulation')}
            className={`inline-flex items-center gap-1 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === 'formulation'
                ? 'border-[#006162] text-[#006162]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <span className="material-symbols-outlined text-base">edit_note</span>
            Formulación
          </button>
          <button
            type="button"
            onClick={() => setTab('budget')}
            className={`inline-flex items-center gap-1 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === 'budget'
                ? 'border-[#006162] text-[#006162]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <span className="material-symbols-outlined text-base">payments</span>
            Presupuesto
          </button>
          <button
            type="button"
            onClick={() => setTab('summary')}
            className={`inline-flex items-center gap-1 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === 'summary'
                ? 'border-[#006162] text-[#006162]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <span className="material-symbols-outlined text-base">description</span>
            Resumen
          </button>
        </div>

        <div className={tab === 'formulation' ? 'block print:hidden' : 'hidden'}>
          <ProjectFormulation
            project={currentProject}
            pendingMgaTab={pendingMgaTab}
            onPendingMgaTabConsumed={() => setPendingMgaTab(null)}
            formulationAnchorRef={formulationAnchorRef}
          />
        </div>
        <div className={tab === 'budget' ? 'block print:hidden' : 'hidden'}>
          <BudgetManager projectId={currentProject.id} />
        </div>
        <div className={tab === 'summary' ? 'block' : 'hidden print:block'}>
          <ProjectSummary />
        </div>
      </div>

      {auditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-modal-title"
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
              <h2 id="audit-modal-title" className="text-lg font-semibold text-gray-800">
                Auditoría previa de formulación
              </h2>
              <button
                type="button"
                onClick={() => setAuditModalOpen(false)}
                className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                aria-label="Cerrar"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="p-4">
              <FormulationAuditPanel
                projectId={currentProject.id}
                compact
                onNavigateToTab={handleAuditNavigateToTab}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
