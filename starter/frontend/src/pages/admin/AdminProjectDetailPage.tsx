import ProjectDetailPage from '../tenant/ProjectDetailPage';

/** Detalle y formulación completa de un proyecto para el Super Admin: solo lectura. */
export default function AdminProjectDetailPage() {
  return <ProjectDetailPage readOnly backPath="/admin/projects" backLabel="Volver a Proyectos Admin" />;
}
