import { useEffect, useState } from 'react';
import { useProjectStore, type Project } from '../../store/projectStore';
import { useToast } from '../ui/Toast';

/** Estados en los que se exige una confirmación doble (escribir el nombre del proyecto). */
const ADVANCED_STATUSES = ['SUBMITTED', 'APPROVED'];

export const isAdvancedProject = (project: Project): boolean =>
  ADVANCED_STATUSES.includes(project.status);

type Props = {
  project: Project | null;
  onClose: () => void;
};

/** Confirmación segura para eliminar (borrado lógico) un proyecto del tablero. */
export default function DeleteProjectModal({ project, onClose }: Props) {
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const fetchProjects = useProjectStore((s) => s.fetchProjects);
  const toast = useToast();
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTyped('');
    setError(null);
  }, [project]);

  if (!project) return null;

  const advanced = isAdvancedProject(project);
  const confirmed = !advanced || typed.trim() === project.name.trim();

  const submit = async () => {
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteProject(project.id);
      toast.success(`Proyecto "${project.name}" eliminado.`);
      onClose();
      await fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el proyecto');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-project-title"
    >
      <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
        <h2 id="delete-project-title" className="text-lg font-semibold text-red-700 mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined">warning</span>
          Eliminar proyecto
        </h2>
        <p className="text-sm text-gray-700">
          ¿Estás seguro de que deseas eliminar el proyecto{' '}
          <strong className="break-words">{project.name}</strong>? Esta acción eliminará toda su
          formulación, cadena de valor y presupuesto asociados.
        </p>

        {advanced && (
          <div className="mt-4">
            <label htmlFor="delete-project-confirm" className="block text-sm font-medium text-gray-700 mb-1">
              Este proyecto está en un estado avanzado. Escribe su nombre para confirmar:
            </label>
            <input
              id="delete-project-confirm"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={deleting}
              autoComplete="off"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!confirmed || deleting}
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? 'Eliminando…' : 'Eliminar Definitivamente'}
          </button>
        </div>
      </div>
    </div>
  );
}
