import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useProjectMgaStore } from '../../../store/projectMgaStore';
import type { Project } from '../../../store/projectStore';
import { normalizeRole } from '../../../lib/roles';
import MgaAlert from './MgaAlert';
import FormulationAuditPanel, { type MgaAuditTabId } from './FormulationAuditPanel';
import MgaPdfExportButton from './MgaPdfExportButton';
import { useProjectEdtStore } from '../../../store/projectEdtStore';
import MGALayout, { type MgaLayoutTabId } from './MGALayout';

type MgaTabId = MgaAuditTabId;

type MgaFormulationShellProps = {
  project: Project;
  /** Pestaña solicitada desde fuera (p. ej. modal de auditoría del header). */
  pendingTab?: MgaTabId | null;
  onPendingTabConsumed?: () => void;
};

function formatRoleLabel(role: string | undefined): string {
  const normalized = normalizeRole(role);
  switch (normalized) {
    case 'SUPER_ADMIN':
      return 'Super administrador';
    case 'TENANT_ADMIN':
      return 'Administrador';
    case 'FORMULADOR':
      return 'Formulador';
    case 'EVALUADOR':
      return 'Evaluador';
    case 'ANALISTA':
      return 'Analista';
    case 'VIEWER':
      return 'Consulta';
    default:
      return normalized || 'Formulador';
  }
}

export default function MgaFormulationShell({
  project,
  pendingTab,
  onPendingTabConsumed,
}: MgaFormulationShellProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<MgaLayoutTabId>('identificacion');
  const [localError, setLocalError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const fetchFormulation = useProjectMgaStore((s) => s.fetchFormulation);
  const seedDefaultFormulation = useProjectMgaStore((s) => s.seedDefaultFormulation);
  const isLoading = useProjectMgaStore((s) => s.isLoading);
  const isSaving = useProjectMgaStore((s) => s.isSaving);
  const mgaError = useProjectMgaStore((s) => s.error);
  const clearMgaError = useProjectMgaStore((s) => s.clearError);

  const fetchEdtChain = useProjectEdtStore((s) => s.fetchEdtChain);
  const edtIsLoading = useProjectEdtStore((s) => s.isLoading);
  const edtIsSaving = useProjectEdtStore((s) => s.isSaving);
  const edtError = useProjectEdtStore((s) => s.error);
  const clearEdtError = useProjectEdtStore((s) => s.clearError);

  const problemDescription = project.problem_description ?? '';
  const generalObjective = project.general_objective ?? '';

  useEffect(() => {
    if (!pendingTab) return;
    setActiveTab(pendingTab);
    onPendingTabConsumed?.();
  }, [onPendingTabConsumed, pendingTab]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLocalError(null);
      clearMgaError();
      clearEdtError();
      try {
        const [loaded] = await Promise.all([
          fetchFormulation(project.id),
          fetchEdtChain(project.id),
        ]);
        if (cancelled) return;

        if (loaded.causeRelations.length === 0) {
          await seedDefaultFormulation(project.id, problemDescription, generalObjective);
        }
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) {
          setLocalError(err instanceof Error ? err.message : 'No se pudo cargar la formulación MGA');
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    clearEdtError,
    clearMgaError,
    fetchEdtChain,
    fetchFormulation,
    generalObjective,
    problemDescription,
    project.id,
    seedDefaultFormulation,
  ]);

  const displayError = localError ?? mgaError ?? edtError;
  const isBusy = isLoading || edtIsLoading;
  const isSavingAny = isSaving || edtIsSaving;

  if (isBusy && !ready) {
    return (
      <div className="rounded-lg border bg-white p-6 text-sm text-gray-500">
        Cargando formulación MGA…
      </div>
    );
  }

  const handleChangeSubTab = (tab: MgaLayoutTabId) => {
    setActiveTab(tab);
  };

  const handleNavigateToAuditTab = (tabId: MgaTabId) => {
    setActiveTab(tabId);
  };

  return (
    <MGALayout
      project={project}
      projectTitle={project.name}
      activeTab={activeTab}
      onChangeSubTab={handleChangeSubTab}
      userName={user?.full_name || user?.email || 'Usuario'}
      userRole={formatRoleLabel(user?.role)}
      onNavigateHome={() => navigate('/tenant/projects')}
      bannerActions={
        <MgaPdfExportButton
          project={project}
          formuladorLabel={user?.full_name || user?.email || 'Usuario'}
          formuladorType={formatRoleLabel(user?.role)}
          variant="outline"
        />
      }
      headerSlot={
        (displayError || isSavingAny) ? (
          <div className="space-y-2 border-b border-outline-variant/40 bg-white px-4 py-3 sm:px-6">
            {displayError && (
              <MgaAlert
                message={displayError}
                onDismiss={() => {
                  setLocalError(null);
                  clearMgaError();
                  clearEdtError();
                }}
              />
            )}
            {isSavingAny && (
              <p className="text-xs text-gray-500 animate-pulse">Guardando cambios…</p>
            )}
          </div>
        ) : undefined
      }
      footerSlot={
        <FormulationAuditPanel
          projectId={project.id}
          onNavigateToTab={handleNavigateToAuditTab}
        />
      }
    />
  );
}
