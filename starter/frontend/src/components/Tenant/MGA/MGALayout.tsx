import { useState, type ReactNode } from 'react';
import { Home, Check, Lock } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectStore } from '../../../store/projectStore';
import CreateProjectModal from '../CreateProjectModal';
import type { MgaAuditTabId } from './FormulationAuditPanel';
import IdentificacionTab from './IdentificacionTab';
import PlanDesarrolloTab from './PlanDesarrolloTab';
import ParticipantesTab from './ParticipantesTab';
import PoblacionTab from './PoblacionTab';
import ObjetivosTab from './ObjetivosTab';
import AlternativasTab from './AlternativasTab';
import NecesidadesTab from './NecesidadesTab';
import AnalisisTecnicoTab from './AnalisisTecnicoTab';
import LocalizacionTab from './LocalizacionTab';
import CadenaValorTab from './CadenaValorTab';
import RiesgosTab from './RiesgosTab';
import IngresosBeneficiosTab from './IngresosBeneficiosTab';
import PrestamosTab from './PrestamosTab';
import DepreciacionTab from './DepreciacionTab';
import EvaluacionTab from './EvaluacionTab';
import ProgramacionTab from './ProgramacionTab';
import { useProjectMgaStore, hasMgaSectionData, type ProjectMgaFormulation } from '../../../store/projectMgaStore';
import { useProjectEdtStore, type ProjectEdtChainState } from '../../../store/projectEdtStore';

export type MgaMainStageId =
  | 'identificacion'
  | 'preparacion'
  | 'evaluacion'
  | 'programacion'
  | 'presentar';

/** Pestañas del menú lateral MGA (incluye plan de desarrollo y mapeo problemática → identificación). */
export type MgaLayoutTabId = 
  | MgaAuditTabId 
  | 'plan-desarrollo'
  | 'necesidades'
  | 'analisis-tecnico'
  | 'localizacion'
  | 'cadena-valor'
  | 'riesgos'
  | 'ingresos-beneficios'
  | 'prestamos'
  | 'depreciacion'
  | 'evaluacion'
  | 'programacion';

type MgaMainStage = {
  id: MgaMainStageId;
  label: string;
  hasDropdown?: boolean;
};

type MgaSubSection = {
  id: MgaLayoutTabId;
  label: string;
};

const MAIN_STAGES: MgaMainStage[] = [
  { id: 'identificacion', label: 'Identificación', hasDropdown: true },
  { id: 'preparacion', label: 'Preparación' },
  { id: 'evaluacion', label: 'Evaluación' },
  { id: 'programacion', label: 'Programación' },
  { id: 'presentar', label: 'Presentar' },
];

const SUB_SECTIONS_IDENTIFICACION: MgaSubSection[] = [
  { id: 'plan-desarrollo', label: 'Plan de desarrollo' },
  { id: 'identificacion', label: 'Problemática' },
  { id: 'participantes', label: 'Participantes' },
  { id: 'poblacion', label: 'Población' },
  { id: 'objetivos', label: 'Objetivos' },
  { id: 'alternativas', label: 'Alternativas' },
];

const SUB_SECTIONS_PREPARACION: MgaSubSection[] = [
  { id: 'necesidades', label: 'Necesidades' },
  { id: 'analisis-tecnico', label: 'Análisis técnico' },
  { id: 'localizacion', label: 'Localización' },
  { id: 'cadena-valor', label: 'Cadena de valor' },
  { id: 'riesgos', label: 'Riesgos' },
  { id: 'ingresos-beneficios', label: 'Ingresos y beneficios' },
  { id: 'prestamos', label: 'Préstamos' },
  { id: 'depreciacion', label: 'Depreciación' },
];

const SUB_SECTIONS_EVALUACION: MgaSubSection[] = [
  { id: 'evaluacion', label: 'Evaluación Económica' },
];

const SUB_SECTIONS_PROGRAMACION: MgaSubSection[] = [
  { id: 'programacion', label: 'Indicadores y Financiación' },
];

export function getMainStageForTab(tab: MgaLayoutTabId): MgaMainStageId {
  if (SUB_SECTIONS_IDENTIFICACION.some((s) => s.id === tab)) return 'identificacion';
  if (SUB_SECTIONS_PREPARACION.some((s) => s.id === tab)) return 'preparacion';
  if (SUB_SECTIONS_EVALUACION.some((s) => s.id === tab)) return 'evaluacion';
  if (SUB_SECTIONS_PROGRAMACION.some((s) => s.id === tab)) return 'programacion';
  return 'identificacion';
}

export type MGALayoutProps = {
  project: Project;
  activeTab: MgaLayoutTabId;
  onChangeSubTab: (tab: MgaLayoutTabId) => void;
  projectTitle?: string;
  userName?: string;
  userRole?: string;
  onNavigateHome?: () => void;
  /** Contenido opcional sobre el área de trabajo (alertas, estado de guardado). */
  headerSlot?: ReactNode;
  /** Panel de auditoría u otros bloques bajo el área de trabajo. */
  footerSlot?: ReactNode;
  /** Acciones en el banner del proyecto (p. ej. exportar PDF). */
  bannerActions?: ReactNode;
};

function CheckBadge({ isActive = false, className = '' }: { isActive?: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
        isActive ? 'bg-white text-emerald-700 shadow-sm' : 'bg-emerald-600 text-white'
      } ${className}`}
      aria-hidden
      title="Sección con información gestionada"
    >
      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
    </span>
  );
}

function LockBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500 ${className}`}
      aria-hidden
      title="Sección bloqueada"
    >
      <Lock className="h-3 w-3" />
    </span>
  );
}

type SectionStatus = 'LOCKED' | 'ACTIVE' | 'COMPLETED';

export const ALL_MGA_SECTIONS: MgaLayoutTabId[] = [
  'plan-desarrollo',
  'identificacion',
  'participantes',
  'poblacion',
  'objetivos',
  'alternativas',
  'necesidades',
  'analisis-tecnico',
  'localizacion',
  'cadena-valor',
  'riesgos',
  'ingresos-beneficios',
  'prestamos',
  'depreciacion',
  'evaluacion',
  'programacion',
];

function useMgaSectionStatuses(project: Project, edtChain?: ProjectEdtChainState | null) {
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));

  const statuses = {} as Record<MgaLayoutTabId, SectionStatus>;

  for (let i = 0; i < ALL_MGA_SECTIONS.length; i++) {
    const sectionId = ALL_MGA_SECTIONS[i];
    const hasData = hasMgaSectionData(sectionId, project, formulation, edtChain);

    const prevSectionId = i > 0 ? ALL_MGA_SECTIONS[i - 1] : null;
    const prevHasData = prevSectionId ? hasMgaSectionData(prevSectionId, project, formulation, edtChain) : false;
    const prevIsCompleted = prevSectionId
      ? Boolean(formulation.completedSections?.[prevSectionId] || project.mga_formulation_data?.completedSections?.[prevSectionId])
      : false;

    // Secciones que marcan inicio de etapa o accesibles por datos previos
    const isStageStart =
      sectionId === 'plan-desarrollo' ||
      sectionId === 'identificacion' ||
      (sectionId === 'necesidades' && (hasMgaSectionData('alternativas', project, formulation, edtChain) || hasMgaSectionData('identificacion', project, formulation, edtChain))) ||
      (sectionId === 'evaluacion' && (hasMgaSectionData('depreciacion', project, formulation, edtChain) || hasMgaSectionData('cadena-valor', project, formulation, edtChain))) ||
      (sectionId === 'programacion' && hasMgaSectionData('evaluacion', project, formulation, edtChain));

    const isUnlocked =
      i === 0 ||
      hasData ||
      prevHasData ||
      prevIsCompleted ||
      isStageStart;

    if (hasData) {
      statuses[sectionId] = 'COMPLETED';
    } else if (isUnlocked) {
      statuses[sectionId] = 'ACTIVE';
    } else {
      statuses[sectionId] = 'LOCKED';
    }
  }

  return statuses;
}

function useMgaMainStageStatuses(
  subStatuses: Record<MgaLayoutTabId, SectionStatus>,
  project: Project,
  formulation: ProjectMgaFormulation,
  edtChain?: ProjectEdtChainState | null,
) {
  const isStageAllCompleted = (subSections: MgaSubSection[]) =>
    subSections.every((s) => subStatuses[s.id] === 'COMPLETED');

  const isStageAnyManaged = (subSections: MgaSubSection[]) =>
    subSections.some((s) => hasMgaSectionData(s.id, project, formulation, edtChain));

  const cIdentificacion = isStageAllCompleted(SUB_SECTIONS_IDENTIFICACION);
  const cPreparacion = isStageAllCompleted(SUB_SECTIONS_PREPARACION);
  const cEvaluacion = isStageAllCompleted(SUB_SECTIONS_EVALUACION);
  const cProgramacion = isStageAllCompleted(SUB_SECTIONS_PROGRAMACION);

  const mIdentificacion = isStageAnyManaged(SUB_SECTIONS_IDENTIFICACION);
  const mPreparacion = isStageAnyManaged(SUB_SECTIONS_PREPARACION);
  const mEvaluacion = isStageAnyManaged(SUB_SECTIONS_EVALUACION);
  const mProgramacion = isStageAnyManaged(SUB_SECTIONS_PROGRAMACION);

  const statuses: Record<MgaMainStageId, SectionStatus> = {
    identificacion: cIdentificacion ? 'COMPLETED' : 'ACTIVE',
    preparacion: cPreparacion ? 'COMPLETED' : (mPreparacion || mIdentificacion || cIdentificacion ? 'ACTIVE' : 'LOCKED'),
    evaluacion: cEvaluacion ? 'COMPLETED' : (mEvaluacion || mPreparacion || cPreparacion ? 'ACTIVE' : 'LOCKED'),
    programacion: cProgramacion ? 'COMPLETED' : (mProgramacion || mEvaluacion || cEvaluacion ? 'ACTIVE' : 'LOCKED'),
    presentar: cProgramacion || mProgramacion ? 'ACTIVE' : 'LOCKED',
  };
  return statuses;
}

function renderWorkArea(project: Project, activeTab: MgaLayoutTabId) {
  switch (activeTab) {
    case 'plan-desarrollo':
      return <PlanDesarrolloTab project={project} />;
    case 'identificacion':
      return <IdentificacionTab project={project} />;
    case 'participantes':
      return <ParticipantesTab project={project} />;
    case 'poblacion':
      return <PoblacionTab project={project} />;
    case 'objetivos':
      return <ObjetivosTab project={project} skipInitialFetch />;
    case 'alternativas':
      return <AlternativasTab project={project} />;
    case 'necesidades':
      return <NecesidadesTab project={project} />;
    case 'analisis-tecnico':
      return <AnalisisTecnicoTab project={project} />;
    case 'localizacion':
      return <LocalizacionTab project={project} />;
    case 'cadena-valor':
      return <CadenaValorTab project={project} />;
    case 'riesgos':
      return <RiesgosTab project={project} />;
    case 'ingresos-beneficios':
      return <IngresosBeneficiosTab project={project} />;
    case 'prestamos':
      return <PrestamosTab project={project} />;
    case 'depreciacion':
      return <DepreciacionTab project={project} />;
    case 'evaluacion':
      return <EvaluacionTab project={project} />;
    case 'programacion':
      return <ProgramacionTab project={project} />;
    default:
      return <IdentificacionTab project={project} />;
  }
}

export default function MGALayout({
  project,
  activeTab,
  onChangeSubTab,
  projectTitle,
  userName = 'Usuario',
  userRole = 'Formulador',
  onNavigateHome,
  headerSlot,
  footerSlot,
  bannerActions,
}: MGALayoutProps) {
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));
  const edtChain = useProjectEdtStore((s) => s.getChain(project.id));
  const sectionStatuses = useMgaSectionStatuses(project, edtChain);
  const mainStageStatuses = useMgaMainStageStatuses(sectionStatuses, project, formulation, edtChain);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const currentProject = useProjectStore((state) => state.currentProject);

  const resolvedTitle =
    projectTitle?.trim() ||
    project.name?.trim() ||
    'Proyecto sin título';

  const targetStageFromTab = getMainStageForTab(activeTab);
  const [userSelectedStage, setUserSelectedStage] = useState<MgaMainStageId | null>(null);
  const activeMainStage: MgaMainStageId = userSelectedStage ?? targetStageFromTab;

  return (
    <div className="flex min-h-[32rem] flex-col overflow-hidden rounded-lg border border-outline-variant/40 bg-surface font-body text-gray-800 shadow-sm">
      {/* 1. Cabecera */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/50 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-md border border-outline-variant/40 bg-surface-container-low text-xs font-bold text-primary"
            aria-label="Logo DNP"
          >
            DNP
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Departamento Nacional de Planeación
            </p>
            <p className="text-sm text-outline">Metodología General Ajustada</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-800">{userName}</p>
            <p className="text-xs text-outline">{userRole}</p>
          </div>
          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant/50 text-primary transition-colors hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Ir al inicio"
          >
            <Home className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </header>

      {/* 2. Menú superior (tabs principales) */}
      <nav className="bg-primary text-white shadow-sm" aria-label="Etapas principales MGA">
        <div className="flex overflow-x-auto px-2 sm:px-4">
          {MAIN_STAGES.map((stage) => {
            const isActive = activeMainStage === stage.id;
            const status = mainStageStatuses[stage.id];
            const isLocked = status === 'LOCKED';
            const isCompleted = status === 'COMPLETED';

            let btnClass = 'flex shrink-0 items-center gap-2 border-b-4 px-4 py-3 text-sm font-medium transition-colors sm:px-5 ';
            if (isActive) {
              btnClass += 'border-white bg-primary-container/30 text-white';
            } else if (isLocked) {
              btnClass += 'cursor-not-allowed border-transparent text-white/50';
            } else {
              btnClass += 'border-transparent text-white/80 hover:bg-primary-container/20';
            }

            return (
              <button
                key={stage.id}
                type="button"
                disabled={isLocked}
                onClick={() => {
                  setUserSelectedStage(stage.id);
                  const subList =
                    stage.id === 'identificacion' ? SUB_SECTIONS_IDENTIFICACION :
                    stage.id === 'preparacion' ? SUB_SECTIONS_PREPARACION :
                    stage.id === 'evaluacion' ? SUB_SECTIONS_EVALUACION :
                    stage.id === 'programacion' ? SUB_SECTIONS_PROGRAMACION : SUB_SECTIONS_IDENTIFICACION;
                  const targetSub = subList.find((s) => sectionStatuses[s.id] !== 'LOCKED') || subList[0];
                  if (targetSub) {
                    onChangeSubTab(targetSub.id);
                  }
                }}
                className={btnClass}
                aria-current={isActive ? 'page' : undefined}
              >
                {isCompleted && (
                  <span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm"
                    aria-hidden
                    title="Etapa completada"
                  >
                    <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                  </span>
                )}
                {isLocked && <LockBadge className="bg-white/20 text-white/50" />}
                {!isCompleted && !isLocked && <span className="inline-flex h-5 w-5 shrink-0" aria-hidden />}
                <span>{stage.label}</span>
                {stage.hasDropdown && (
                  <span className="text-xs opacity-90" aria-hidden>
                    ▼
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* 3. Banner de proyecto */}
      <section className="shrink-0 border-b border-outline-variant/40 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3 max-w-4xl">
            <p className="text-sm font-medium leading-relaxed text-gray-800 sm:text-base">
              {resolvedTitle}
            </p>
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-[#006162] focus:outline-none focus:ring-2 focus:ring-[#006162] focus:ring-offset-1 mt-0.5"
              title="Editar Datos del Proyecto"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
              <span className="hidden sm:inline">Editar</span>
            </button>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            {bannerActions}
            <p className="text-xs font-medium text-red-600">* Campos requeridos</p>
          </div>
        </div>
      </section>

      {headerSlot}

      {/* 4. Layout de 2 columnas */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Columna izquierda: sub-tabs */}
        <aside
          className="w-full shrink-0 border-b border-outline-variant/40 bg-surface-container-lowest lg:w-56 lg:border-b-0 lg:border-r"
          aria-label="Secciones de identificación"
        >
          <ul className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:overflow-visible lg:p-3">
            {(
              activeMainStage === 'identificacion' ? SUB_SECTIONS_IDENTIFICACION :
              activeMainStage === 'preparacion' ? SUB_SECTIONS_PREPARACION :
              activeMainStage === 'evaluacion' ? SUB_SECTIONS_EVALUACION :
              activeMainStage === 'programacion' ? SUB_SECTIONS_PROGRAMACION :
              SUB_SECTIONS_IDENTIFICACION
            ).map((section) => {
              const isActive = activeTab === section.id;
              const status = sectionStatuses[section.id];
              const isLocked = status === 'LOCKED';
              const isCompleted = status === 'COMPLETED';

              let btnClass = 'flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors ';
              if (isActive) {
                btnClass += 'bg-primary text-white shadow-sm font-semibold';
              } else if (isLocked) {
                btnClass += 'text-slate-400 cursor-not-allowed opacity-60 pointer-events-none';
              } else {
                btnClass += 'text-gray-700 hover:bg-primary/5 hover:text-primary';
              }

              const isProblemTreeBlocked = (section.id === 'objetivos' || section.id === 'alternativas') && isLocked;
              const lockTooltip = isProblemTreeBlocked
                ? "Árbol de Problemas incompleto: registre Problema Central, Causas (directas e indirectas) y Efectos (directos e indirectos)"
                : "Sección bloqueada";

              return (
                <li key={section.id} className="min-w-[9.5rem] lg:min-w-0">
                  <button
                    type="button"
                    disabled={isLocked}
                    title={isLocked ? lockTooltip : undefined}
                    onClick={() => onChangeSubTab(section.id)}
                    className={btnClass}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {isCompleted && (
                      <CheckBadge
                        isActive={isActive}
                        className={isActive ? 'bg-white text-emerald-700' : ''}
                      />
                    )}
                    {isLocked && <LockBadge />}
                    {!isCompleted && !isLocked && <span className="inline-flex h-5 w-5 shrink-0" aria-hidden />}
                    
                    <span className="flex-1">{section.label}</span>
                    
                    {isActive && (
                      <span className="text-xs font-bold" aria-hidden>
                        ►
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Columna derecha: área de trabajo con scroll */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="mx-auto w-full max-w-6xl">
              {sectionStatuses[activeTab] === 'LOCKED' && (
                <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm">
                  <div className="flex items-center gap-2 font-semibold">
                    <span>⚠️ Sección Bloqueada</span>
                  </div>
                  <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                    Según la Metodología de Marco Lógico (MGA), para acceder a esta sección debe completar primero las etapas previas obligatorias (en particular el Árbol de Problemas con su Problema Central, Causas directas/indirectas y Efectos directos/indirectos en la pestaña Problemática).
                  </p>
                </div>
              )}
              {renderWorkArea(project, activeTab)}
            </div>
          </div>
          {footerSlot && (
            <div className="shrink-0 border-t border-outline-variant/40 bg-white px-4 py-4 sm:px-6">
              <div className="mx-auto w-full max-w-6xl">{footerSlot}</div>
            </div>
          )}
        </main>
      </div>
      
      {isEditModalOpen && (
        <CreateProjectModal 
          open={isEditModalOpen} 
          onClose={() => setIsEditModalOpen(false)} 
          editProject={currentProject || project}
        />
      )}
    </div>
  );
}
