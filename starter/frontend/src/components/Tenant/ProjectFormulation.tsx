import MgaFormulationShell from './MGA/MgaFormulationShell';
import type { MgaAuditTabId } from './MGA/FormulationAuditPanel';
import { useProjectStore, type Project } from '../../store/projectStore';

type ProjectFormulationProps = {
  project: Project;
  pendingMgaTab?: MgaAuditTabId | null;
  onPendingMgaTabConsumed?: () => void;
  formulationAnchorRef?: React.RefObject<HTMLDivElement | null>;
};

export default function ProjectFormulation({
  project,
  pendingMgaTab,
  onPendingMgaTabConsumed,
  formulationAnchorRef,
}: ProjectFormulationProps) {
  const currentProject = useProjectStore((s) => s.currentProject) ?? project;

  return (
    <div ref={formulationAnchorRef} className="scroll-mt-6">
      <MgaFormulationShell
        project={currentProject}
        pendingTab={pendingMgaTab}
        onPendingTabConsumed={onPendingMgaTabConsumed}
      />
    </div>
  );
}
