import { useCallback, useMemo, useState } from 'react';
import { Copy, Eye, Lock, Trash2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../ui/Toast';
import type { ProjectTemplate } from '../../../data/mgaSeedTemplate';
import { selectVisibleTemplates, useProjectTemplateStore } from '../../../store/projectTemplateStore';
import DeleteTemplateDialog from './DeleteTemplateDialog';
import TemplatePreviewModal from './TemplatePreviewModal';

type ProjectTemplatesSectionProps = {
  canCreate: boolean;
  onUseTemplate: (template: ProjectTemplate) => void;
};

export default function ProjectTemplatesSection({ canCreate, onUseTemplate }: ProjectTemplatesSectionProps) {
  const { user } = useAuth();
  const toast = useToast();
  const customTemplates = useProjectTemplateStore((s) => s.customTemplates);
  const deleteProjectTemplate = useProjectTemplateStore((s) => s.deleteProjectTemplate);

  const templates = useMemo(
    () => selectVisibleTemplates(customTemplates, user?.tenant_id ?? null),
    [customTemplates, user?.tenant_id],
  );

  const [previewing, setPreviewing] = useState<ProjectTemplate | null>(null);
  const [deleting, setDeleting] = useState<ProjectTemplate | null>(null);

  const closePreview = useCallback(() => setPreviewing(null), []);
  const cancelDelete = useCallback(() => setDeleting(null), []);

  const handleUse = (template: ProjectTemplate) => {
    setPreviewing(null);
    onUseTemplate(template);
  };

  const handleConfirmDelete = (template: ProjectTemplate) => {
    try {
      deleteProjectTemplate(template.id);
      toast.success(`Plantilla "${template.name}" eliminada.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar la plantilla.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <section aria-labelledby="project-templates-title" className="mb-10">
      <h3 id="project-templates-title" className="mb-1 text-xl font-semibold text-gray-900">
        Plantillas de proyectos
      </h3>
      <p className="mb-4 text-sm text-gray-500">
        Revise una formulación MGA de referencia y úsela como punto de partida para un borrador nuevo.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {templates.map((template) => (
          <article
            key={template.id}
            className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-5"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold uppercase ${
                  template.isSystem ? 'bg-amber-100 text-amber-800' : 'bg-teal-100 text-[#006162]'
                }`}
              >
                {template.isSystem && <Lock size={12} aria-hidden="true" />}
                {template.isSystem ? 'Sistema' : 'Personalizada'}
              </span>
              {!template.isSystem && (
                <button
                  type="button"
                  onClick={() => setDeleting(template)}
                  aria-label={`Eliminar plantilla ${template.name}`}
                  title="Eliminar plantilla"
                  className="rounded p-1 text-red-600 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              )}
            </div>
            <h4 className="mb-1 line-clamp-3 text-base font-semibold leading-tight text-gray-900">{template.name}</h4>
            <p className="mb-1 text-xs text-gray-500">{template.sector || 'Sin sector'}</p>
            <p className="mb-4 line-clamp-4 text-sm text-gray-600">{template.description}</p>
            <div className="mt-auto flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPreviewing(template)}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-[#006162] px-3 text-sm font-medium text-[#006162] hover:bg-teal-50"
              >
                <Eye size={16} aria-hidden="true" />
                Ver Plantilla
              </button>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => handleUse(template)}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#006162] px-3 text-sm font-semibold text-white hover:bg-[#004f50]"
                >
                  <Copy size={16} aria-hidden="true" />
                  Clonar Proyecto
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      <TemplatePreviewModal
        template={previewing}
        onClose={closePreview}
        onUse={handleUse}
        canUse={canCreate}
      />
      <DeleteTemplateDialog template={deleting} onCancel={cancelDelete} onConfirm={handleConfirmDelete} />
    </section>
  );
}
