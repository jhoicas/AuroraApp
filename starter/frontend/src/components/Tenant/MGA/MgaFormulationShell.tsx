import { useEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { useProjectMgaStore } from '../../../store/projectMgaStore';
import type { Project } from '../../../store/projectStore';
import MgaAlert from './MgaAlert';
import IdentificacionTab from './IdentificacionTab';
import ParticipantesTab from './ParticipantesTab';
import PoblacionTab from './PoblacionTab';
import ObjetivosTab from './ObjetivosTab';
import AlternativasTab from './AlternativasTab';
import CadenaValorTab from './CadenaValorTab';
import FormulationAuditPanel from './FormulationAuditPanel';
import { useProjectEdtStore } from '../../../store/projectEdtStore';

type MgaTabId =
  | 'identificacion'
  | 'participantes'
  | 'poblacion'
  | 'objetivos'
  | 'cadena-valor'
  | 'alternativas';

const TABS: { id: MgaTabId; label: string }[] = [
  { id: 'identificacion', label: 'Identificación' },
  { id: 'participantes', label: 'Participantes' },
  { id: 'poblacion', label: 'Población' },
  { id: 'objetivos', label: 'Objetivos' },
  { id: 'cadena-valor', label: 'Cadena de Valor' },
  { id: 'alternativas', label: 'Alternativas' },
];

type MgaFormulationShellProps = {
  project: Project;
};

export default function MgaFormulationShell({ project }: MgaFormulationShellProps) {
  const [activeTab, setActiveTab] = useState<MgaTabId>('identificacion');
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
      <div className="bg-white p-6 border rounded-lg text-sm text-gray-500">
        Cargando formulación MGA…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2">
        <h2 className="text-lg font-normal text-[#2980b9] flex items-center gap-2 mr-auto">
          Formulación MGA
          <HelpCircle className="w-4 h-4 text-[#3498db]" aria-hidden />
        </h2>
        {isSavingAny && (
          <span className="text-xs text-gray-500 animate-pulse">Guardando cambios…</span>
        )}
      </div>

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

      <nav
        className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg"
        aria-label="Secciones de formulación MGA"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                isActive
                  ? 'bg-[#2980b9] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-white hover:text-[#2980b9]'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="min-h-[320px]">
        {activeTab === 'identificacion' && <IdentificacionTab project={project} />}
        {activeTab === 'participantes' && <ParticipantesTab project={project} />}
        {activeTab === 'poblacion' && <PoblacionTab project={project} />}
        {activeTab === 'objetivos' && <ObjetivosTab project={project} skipInitialFetch />}
        {activeTab === 'cadena-valor' && <CadenaValorTab project={project} />}
        {activeTab === 'alternativas' && <AlternativasTab project={project} />}
      </div>

      <div className="pt-4 border-t border-gray-200">
        <FormulationAuditPanel projectId={project.id} />
      </div>
    </div>
  );
}
