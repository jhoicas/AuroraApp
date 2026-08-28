import { useCallback, useRef } from 'react';
import AssistantChatPanel from '../../components/AuroraAsistente/AssistantChatPanel';
import KnowledgeGraphViewer from '../../components/KnowledgeGraphViewer';
import { useAuroraCopilotStore } from '../../store/auroraCopilotStore';
import type { KnowledgeGraphNode } from '../../store/aiKnowledgeStore';
import { nodeTypeLabels } from '../../store/aiKnowledgeStore';

/**
 * Centro de Exploración Metodológica (`/tenant/ai`):
 * split screen — grafo global (solo lectura) + Aurora Asistente embebido.
 * El FAB flotante del layout se oculta visualmente aquí vía CSS en TenantLayout
 * cuando path === /tenant/ai, pero el chat embebido comparte el mismo store.
 */
export default function AiAssistantPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const appendToDraft = useAuroraCopilotStore((s) => s.appendToDraft);

  const handleNodeSelect = useCallback(
    (node: KnowledgeGraphNode) => {
      const typeLabel = nodeTypeLabels[node.type] ?? node.type;
      const snippet = `"${node.label}" (${typeLabel})`;
      appendToDraft(snippet);
      // Focus al input embebido para continuar la pregunta.
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    },
    [appendToDraft],
  );

  return (
    <div className="-m-6 min-h-[calc(100vh-4rem)] flex flex-col">
      <header className="px-6 py-5 border-b border-gray-200 bg-white shrink-0">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
          Centro de Exploración Metodológica
        </h2>
        <p className="text-sm md:text-base text-gray-600 mt-1 max-w-3xl">
          Explore el Knowledge Graph global y consulte a Aurora Asistente. Haga clic en un nodo para
          insertarlo en el chat.
        </p>
      </header>

      <div className="flex-1 grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] min-h-0">
        <div className="p-4 md:p-5 min-h-[480px] xl:min-h-0 xl:border-r border-gray-200 bg-gray-50/50">
          <KnowledgeGraphViewer
            readOnly
            className="h-full min-h-[520px] xl:min-h-full shadow-sm"
            minHeight={520}
            title="Knowledge Graph global"
            emptyHint="El administrador global aún no ha indexado conocimiento MGA."
            onNodeSelect={handleNodeSelect}
          />
        </div>

        <div className="min-h-[480px] xl:min-h-0 border-t xl:border-t-0 border-gray-200 flex flex-col bg-white">
          <AssistantChatPanel
            variant="embedded"
            className="h-full min-h-[480px]"
            inputRef={inputRef}
          />
        </div>
      </div>
    </div>
  );
}
