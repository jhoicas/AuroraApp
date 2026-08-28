import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ActionCard from '../AuroraCopilot/ActionCard';
import AssistantMarkdown from './AssistantMarkdown';
import {
  COPILOT_CATALOG_ROUTES,
  useAuroraCopilotStore,
  type ActionCardPayload,
} from '../../store/auroraCopilotStore';
import { useCatalogStore } from '../../store/catalogStore';

type AssistantChatPanelProps = {
  /** `floating`: drawer lateral. `embedded`: panel fijo (split /tenant/ai). */
  variant?: 'floating' | 'embedded';
  /** Muestra botón cerrar (solo floating). */
  showClose?: boolean;
  className?: string;
  /** Callback al montar el input (p. ej. focus tras clic en nodo). */
  inputRef?: React.RefObject<HTMLInputElement | null>;
};

/**
 * Panel de chat de Aurora Asistente (contenido compartido por FloatingAssistant
 * y la vista embebida del Centro de Exploración Metodológica).
 */
export default function AssistantChatPanel({
  variant = 'embedded',
  showClose = false,
  className = '',
  inputRef,
}: AssistantChatPanelProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const localInputRef = useRef<HTMLInputElement>(null);
  const resolvedInputRef = inputRef ?? localInputRef;

  const {
    messages,
    isTyping,
    error,
    draftInput,
    close,
    sendMessage,
    cancelGeneration,
    clearError,
    clearChat,
    setDraftInput,
  } = useAuroraCopilotStore();
  const applyCopilotSearch = useCatalogStore((s) => s.applyCopilotSearch);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, isTyping]);

  const handleSend = useCallback(async () => {
    const text = draftInput.trim();
    if (!text || isTyping) return;
    await sendMessage(text, pathname);
  }, [draftInput, isTyping, pathname, sendMessage]);

  const handleApply = useCallback(
    (card: ActionCardPayload) => {
      if (pathname.startsWith('/tenant')) {
        navigate('/tenant/catalog');
      } else {
        const route = COPILOT_CATALOG_ROUTES[card.catalog];
        if (route && pathname !== route) {
          navigate(route);
        }
      }
      applyCopilotSearch(card.catalog, card.code || card.label);
      if (variant === 'floating') {
        close();
      }
    },
    [applyCopilotSearch, close, navigate, pathname, variant],
  );

  const headerTone =
    variant === 'floating'
      ? 'bg-[#006162] text-white'
      : 'bg-white border-b border-gray-200 text-gray-900';

  return (
    <div className={`flex flex-col h-full min-h-0 bg-white ${className}`}>
      <header className={`px-4 py-3.5 shrink-0 ${headerTone}`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold text-lg tracking-tight">Aurora Asistente</h2>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                clearChat();
                setDraftInput('');
              }}
              disabled={messages.length === 0 && !isTyping && !draftInput}
              aria-label="Limpiar chat"
              title="Limpiar chat"
              className={`p-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed ${
                variant === 'floating' ? 'hover:bg-white/15' : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">delete_sweep</span>
            </button>
            {showClose && (
              <button
                type="button"
                onClick={close}
                aria-label="Cerrar"
                className="p-1.5 rounded-lg hover:bg-white/15"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto bg-[#f7faf9] px-3 py-4 space-y-3">
        {messages.length === 0 && !isTyping && (
          <p className="text-center text-sm text-gray-500 px-6 py-10 leading-relaxed">
            Pregúntame sobre formulación MGA, clasificación programática o el conocimiento del grafo.
          </p>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#006162] text-white rounded-br-md'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm'
              }`}
            >
              {msg.role === 'assistant' ? (
                <AssistantMarkdown content={msg.content} />
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
              {msg.actionCards?.map((card) => (
                <div key={`${card.catalog}-${card.code}`} className="mt-2">
                  <ActionCard card={card} onApply={handleApply} />
                </div>
              ))}
            </div>
          </div>
        ))}

        {isTyping && (
          <p className="text-center text-xs text-gray-500 py-1">Aurora está escribiendo…</p>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="px-4 py-2 bg-red-50 border-t text-xs text-red-700 flex justify-between gap-2"
        >
          <span>{error}</span>
          <button type="button" onClick={clearError} className="underline shrink-0">
            Cerrar
          </button>
        </div>
      )}

      <footer className="p-3 border-t border-gray-100 shrink-0 bg-white">
        <div className="flex gap-2">
          <input
            ref={resolvedInputRef}
            type="text"
            value={draftInput}
            onChange={(e) => setDraftInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Pregunta a Aurora…"
            disabled={isTyping}
            aria-label="Mensaje para Aurora Asistente"
            className="flex-1 h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#006162]/40 focus:border-[#006162]"
          />
          {isTyping ? (
            <button
              type="button"
              onClick={cancelGeneration}
              className="h-11 px-3 border border-red-200 rounded-xl text-red-600 text-sm font-medium"
            >
              Detener
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!draftInput.trim()}
              className="h-11 px-4 rounded-xl bg-[#006162] text-white text-sm font-semibold disabled:opacity-50"
            >
              Enviar
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
