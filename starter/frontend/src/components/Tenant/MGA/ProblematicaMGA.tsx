import type { Project } from '../../../store/projectStore';
import ProblematicaTab from './ProblematicaTab';

export type ProblematicaMGAProps = {
  project: Project;
};

/**
 * Vista de problemática MGA (árbol de problemas, causas y efectos).
 * Integra la formulación de identificación existente en el layout oficial.
 */
export default function ProblematicaMGA({ project }: ProblematicaMGAProps) {
  return <ProblematicaTab project={project} />;
}
