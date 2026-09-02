import { useMatch } from 'react-router-dom';
import AssistantChatPanel from './AssistantChatPanel';
import { useAuroraCopilotStore } from '../../store/auroraCopilotStore';
import { useProjectStore } from '../../store/projectStore';

/**
 * Asistente flotante global: FAB inferior derecho + panel lateral.
 * En detalle de proyecto inyecta el contexto MGA del proyecto activo.
 */
export default function FloatingAssistant() {
  const { isOpen, toggleOpen, close } = useAuroraCopilotStore();
  const projectMatch = useMatch('/tenant/projects/:id');
  const projectId = projectMatch?.params.id;
  const currentProject = useProjectStore((s) => s.currentProject);
  const project =
    projectId && currentProject?.id === projectId ? currentProject : undefined;

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={toggleOpen}
          aria-label="Abrir Aurora Asistente MGA"
          title="Aurora · Asistente MGA"
          className="fixed bottom-6 right-6 z-[100] w-14 h-14 rounded-full bg-[#006162] hover:bg-[#004f50] text-white shadow-lg shadow-teal-900/20 flex items-center justify-center transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#006162]"
        >
          <span className="material-symbols-outlined text-2xl">auto_awesome</span>
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex justify-end"
          role="dialog"
          aria-label="Aurora · Asistente MGA"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
            aria-label="Cerrar panel de Aurora"
            onClick={close}
          />
          <aside className="relative w-full max-w-md h-full bg-white shadow-2xl border-l border-gray-100 flex flex-col animate-in slide-in-from-right">
            <AssistantChatPanel variant="floating" showClose project={project} />
          </aside>
        </div>
      )}
    </>
  );
}
