import type { ReactNode } from 'react';
import { Home, Pencil } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import type { MgaAuditTabId } from './FormulationAuditPanel';
import IdentificacionTab from './IdentificacionTab';
import ParticipantesTab from './ParticipantesTab';
import PoblacionTab from './PoblacionTab';
import ObjetivosTab from './ObjetivosTab';
import CadenaValorTab from './CadenaValorTab';
import AlternativasTab from './AlternativasTab';

export type MgaMainStageId =
  | 'identificacion'
  | 'preparacion'
  | 'evaluacion'
  | 'programacion'
  | 'presentar';

/** Pestañas del menú lateral MGA (incluye plan de desarrollo y mapeo problemática → identificación). */
export type MgaLayoutTabId = MgaAuditTabId | 'plan-desarrollo';

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

const SUB_SECTIONS: MgaSubSection[] = [
  { id: 'plan-desarrollo', label: 'Plan de desarrollo' },
  { id: 'identificacion', label: 'Problemática' },
  { id: 'participantes', label: 'Participantes' },
  { id: 'poblacion', label: 'Población' },
  { id: 'objetivos', label: 'Objetivos' },
  { id: 'cadena-valor', label: 'Cadena de Valor' },
  { id: 'alternativas', label: 'Alternativas' },
];

export type MGALayoutProps = {
  project: Project;
  activeTab: MgaLayoutTabId;
  onChangeSubTab: (tab: MgaLayoutTabId) => void;
  projectTitle?: string;
  userName?: string;
  userRole?: string;
  onEditTitle?: () => void;
  onNavigateHome?: () => void;
  /** Contenido opcional sobre el área de trabajo (alertas, estado de guardado). */
  headerSlot?: ReactNode;
  /** Panel de auditoría u otros bloques bajo el área de trabajo. */
  footerSlot?: ReactNode;
};

function CheckBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2e7d32] text-[11px] font-bold text-white ${className}`}
      aria-hidden
    >
      ✓
    </span>
  );
}

function PlanDesarrolloPlaceholder() {
  return (
    <div className="rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-8 text-center text-sm text-outline">
      <p className="font-medium text-gray-700">Plan de desarrollo</p>
      <p className="mt-2 text-gray-500">
        Vincule el proyecto con el plan de desarrollo territorial o sectorial correspondiente.
      </p>
    </div>
  );
}

function renderWorkArea(project: Project, activeTab: MgaLayoutTabId) {
  switch (activeTab) {
    case 'plan-desarrollo':
      return <PlanDesarrolloPlaceholder />;
    case 'identificacion':
      return <IdentificacionTab project={project} />;
    case 'participantes':
      return <ParticipantesTab project={project} />;
    case 'poblacion':
      return <PoblacionTab project={project} />;
    case 'objetivos':
      return <ObjetivosTab project={project} skipInitialFetch />;
    case 'cadena-valor':
      return <CadenaValorTab project={project} />;
    case 'alternativas':
      return <AlternativasTab project={project} />;
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
  onEditTitle,
  onNavigateHome,
  headerSlot,
  footerSlot,
}: MGALayoutProps) {
  const activeMainStage: MgaMainStageId = 'identificacion';

  const resolvedTitle =
    projectTitle?.trim() ||
    project.name?.trim() ||
    'Proyecto sin título';

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
            return (
              <button
                key={stage.id}
                type="button"
                disabled={stage.id !== 'identificacion'}
                className={`flex shrink-0 items-center gap-2 border-b-4 px-4 py-3 text-sm font-medium transition-colors sm:px-5 ${
                  isActive
                    ? 'border-white bg-primary-container/30 text-white'
                    : 'cursor-not-allowed border-transparent text-white/50'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <CheckBadge className={isActive ? 'bg-white text-[#2e7d32]' : ''} />
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
          <p className="max-w-4xl text-sm font-medium leading-relaxed text-gray-800 sm:text-base">
            {resolvedTitle}
          </p>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <button
              type="button"
              onClick={onEditTitle}
              className="inline-flex items-center gap-2 rounded-md border border-[#2980b9] bg-white px-3 py-1.5 text-sm font-medium text-[#2980b9] transition-colors hover:bg-[#2980b9]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2980b9]"
            >
              <Pencil className="h-4 w-4" aria-hidden />
              <span>Editar Título</span>
            </button>
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
            {SUB_SECTIONS.map((section) => {
              const isActive = activeTab === section.id;

              return (
                <li key={section.id} className="min-w-[9.5rem] lg:min-w-0">
                  <button
                    type="button"
                    onClick={() => onChangeSubTab(section.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                      isActive
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-gray-700 hover:bg-primary/5 hover:text-primary'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <CheckBadge className={isActive ? 'bg-white text-[#2e7d32]' : ''} />
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
            <div className="mx-auto w-full max-w-6xl">{renderWorkArea(project, activeTab)}</div>
          </div>
          {footerSlot && (
            <div className="shrink-0 border-t border-outline-variant/40 bg-white px-4 py-4 sm:px-6">
              <div className="mx-auto w-full max-w-6xl">{footerSlot}</div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
