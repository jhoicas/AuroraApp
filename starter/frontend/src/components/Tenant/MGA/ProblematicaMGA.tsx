import type { Project } from '../../../store/projectStore';
import IdentificacionTab from './IdentificacionTab';

export type ProblematicaMGAProps = {
  project: Project;
};

/**
 * Vista de problemática MGA (árbol de problemas, causas y efectos).
 * Integra la formulación de identificación existente en el layout oficial.
 */
export default function ProblematicaMGA({ project }: ProblematicaMGAProps) {
  return <IdentificacionTab project={project} />;
}
