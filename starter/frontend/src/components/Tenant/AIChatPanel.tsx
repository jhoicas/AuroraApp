import { type FormEvent, useEffect, useRef } from 'react';
import { useAIStore } from '../../store/aiStore';

type AIChatPanelProps = {
  projectId: string;
  className?: string;
};

export default function AIChatPanel({ projectId, className = '' }: AIChatPanelProps) {
  const messages = useAIStore((s) => s.messages);
  const isTyping = useAIStore((s) => s.isTyping);
  const error = useAIStore((s) => s.error);
  const rateLimited = useAIStore((s) => s.rateLimited);
  const fetchHistory = useAIStore((s) => s.fetchHistory);
  const sendMessage = useAIStore((s) => s.sendMessage);
  const clearError = useAIStore((s) => s.clearError);
  const clearMessages = useAIStore((s) => s.clearMessages);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchHistory(projectId);
    return () => clearMessages();
  }, [projectId, fetchHistory, clearMessages]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isTyping]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const value = inputRef.current?.value ?? '';
    if (!value.trim() || isTyping) return;

    if (inputRef.current) {
      inputRef.current.value = '';
    }

    try {
      await sendMessage(projectId, value);
    } catch {
      // error en store
    }
  };

  return (
    <aside
      className={`print:hidden flex flex-col bg-white border border-gray-100 rounded-lg shadow overflow-hidden ${className}`}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-[#006162] text-white">
        <span className="material-symbols-outlined">smart_toy</span>
        <div>
          <h3 className="text-sm font-semibold leading-tight">Aurora · Asistente MGA</h3>
          <p className="text-xs text-white/80">Ayuda en formulación de proyectos</p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className={`mx-3 mt-3 flex items-start justify-between gap-2 rounded px-3 py-2 text-xs ${
            rateLimited
              ? 'border border-amber-200 bg-amber-50 text-amber-900'
              : 'border border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <div className="flex items-start gap-1.5">
            <span className="material-symbols-outlined text-base mt-0.5">
              {rateLimited ? 'hourglass_top' : 'error'}
            </span>
            <span>{error}</span>
          </div>
          <button type="button" onClick={clearError} aria-label="Cerrar alerta">
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3 min-h-0">
        {messages.length === 0 && !isTyping && (
          <div className="text-center text-sm text-gray-500 py-8 px-2">
            <span className="material-symbols-outlined text-3xl text-[#006162] mb-2">forum</span>
            <p>
              Pregunta sobre el árbol de problemas, objetivos, productos DNP o la estructura MGA de
              este proyecto.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? 'bg-[#006162] text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-800 rounded-bl-md'
                }`}
              >
                {!isUser && (
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-500 mb-1">
                    <span className="material-symbols-outlined text-sm">smart_toy</span>
                    Aurora
                  </div>
                )}
                {msg.content}
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-600 rounded-2xl rounded-bl-md px-3 py-2 text-sm inline-flex items-center gap-2">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.1s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" />
              </span>
              Aurora está pensando…
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-gray-100 p-3 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          disabled={isTyping}
          placeholder="Escribe tu consulta MGA…"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006162] disabled:bg-gray-50"
        />
        <button
          type="submit"
          disabled={isTyping}
          className="inline-flex items-center justify-center rounded bg-[#006162] hover:bg-[#004f50] disabled:opacity-50 text-white w-10 h-10 shrink-0"
          aria-label="Enviar mensaje"
          title="Enviar"
        >
          <span className="material-symbols-outlined text-base">send</span>
        </button>
      </form>
    </aside>
  );
}
