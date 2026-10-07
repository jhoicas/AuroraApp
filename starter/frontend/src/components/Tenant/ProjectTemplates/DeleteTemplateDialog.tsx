import { useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import type { ProjectTemplate } from '../../../data/mgaSeedTemplate';

type DeleteTemplateDialogProps = {
  template: ProjectTemplate | null;
  onCancel: () => void;
  onConfirm: (template: ProjectTemplate) => void;
};

export default function DeleteTemplateDialog({ template, onCancel, onConfirm }: DeleteTemplateDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!template) return undefined;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [template, onCancel]);

  if (!template) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-template-title"
        aria-describedby="delete-template-desc"
        className="w-full max-w-md rounded-lg border border-gray-100 bg-white p-6 shadow-lg"
      >
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
            <Trash2 size={20} aria-hidden="true" />
          </span>
          <h3 id="delete-template-title" className="text-lg font-semibold text-gray-900">
            Eliminar plantilla
          </h3>
        </div>
        <p id="delete-template-desc" className="mb-6 text-sm text-gray-600">
          ¿Está seguro de eliminar la plantilla <strong>{template.name}</strong>? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(template)}
            className="h-10 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
