import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { List, type ListImperativeAPI, type RowComponentProps } from 'react-window';
import ActionCard from './ActionCard';
import {
  COPILOT_CATALOG_ROUTES,
  useAuroraCopilotStore,
  type ActionCardPayload,
  type CopilotMessage,
} from '../../store/auroraCopilotStore';
import { useCatalogStore } from '../../store/catalogStore';

type ChatRowProps = {
  messages: CopilotMessage[];
  onApply: (card: ActionCardPayload) => void;
};

function ChatRow({ index, style, messages, onApply }: RowComponentProps<ChatRowProps>) {
  const msg = messages[index];
  if (!msg) return null;

  return (
    <div style={style} className="px-1 pb-2">
      <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
            msg.role === 'user'
              ? 'bg-[#006162] text-white rounded-br-md'
              : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm'
          }`}
        >
          <p className="whitespace-pre-wrap">{msg.content}</p>
          {msg.actionCards?.map((card) => (
            <div key={`${card.catalog}-${card.code}`} className="mt-2">
              <ActionCard card={card} onApply={onApply} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AuroraCopilot() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const {
    isOpen,
    messages,
    isTyping,
    error,
    sessionId,
    toggleOpen,
    close,
    sendMessage,
    cancelGeneration,
    clearError,
  } = useAuroraCopilotStore();
  const applyCopilotSearch = useCatalogStore((s) => s.applyCopilotSearch);

  const [input, setInput] = useState('');
  const listRef = useRef<ListImperativeAPI | null>(null);

  useEffect(() => {
    if (messages.length > 0) {
      listRef.current?.scrollToRow({ index: messages.length - 1, align: 'end' });
    }
  }, [messages.length, isTyping]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isTyping) return;
    setInput('');
    await sendMessage(text, pathname);
  }, [input, isTyping, pathname, sendMessage]);

  const handleApply = useCallback(
    (card: ActionCardPayload) => {
      const route = COPILOT_CATALOG_ROUTES[card.catalog];
      if (route && pathname !== route) {
        navigate(route);
      }
      applyCopilotSearch(card.catalog, card.code || card.label);
      close();
    },
    [applyCopilotSearch, close, navigate, pathname],
  );

  const rowProps: ChatRowProps = { messages, onApply: handleApply };

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={toggleOpen}
          aria-label="Abrir Aurora Copilot"
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#006162] hover:bg-[#004f50] text-white shadow-lg flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-2xl">smart_toy</span>
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-label="Aurora Copilot">
          <button type="button" className="absolute inset-0 bg-black/30" aria-label="Cerrar" onClick={close} />
          <aside className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col border-l">
            <header className="px-4 py-4 border-b bg-gradient-to-r from-[#006162] to-[#2c7a7b] text-white shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-lg">Aurora Copilot</h2>
                  <p className="text-xs text-white/80">Claude Haiku · MGA</p>
                </div>
                <button type="button" onClick={close} aria-label="Cerrar">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <p className="text-[11px] mt-2 text-white/75 truncate">{pathname}</p>
            </header>

            <div className="flex-1 min-h-0 bg-[#f9f9ff]">
              {messages.length === 0 && !isTyping && (
                <p className="text-center text-sm text-gray-500 p-8">Pregúntame sobre formulación MGA.</p>
              )}
              {messages.length > 0 && (
                <List<ChatRowProps>
                  listRef={listRef}
                  rowCount={messages.length}
                  rowHeight={120}
                  rowComponent={ChatRow}
                  rowProps={rowProps}
                  style={{ height: '100%', width: '100%' }}
                />
              )}
              {isTyping && <p className="text-center text-xs text-gray-500 py-2">Aurora está escribiendo…</p>}
            </div>

            {error && (
              <div className="px-4 py-2 bg-red-50 border-t text-xs text-red-700 flex justify-between">
                <span>{error}</span>
                <button type="button" onClick={clearError}>Cerrar</button>
              </div>
            )}

            <footer className="p-4 border-t shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Pregunta sobre MGA…"
                  disabled={isTyping}
                  className="flex-1 h-11 px-3 rounded-xl border text-sm"
                />
                {isTyping ? (
                  <button type="button" onClick={cancelGeneration} className="h-11 px-3 border rounded-xl text-red-600">
                    Detener
                  </button>
                ) : (
                  <button type="button" onClick={() => void handleSend()} disabled={!input.trim()} className="h-11 px-4 rounded-xl bg-[#006162] text-white">
                    Enviar
                  </button>
                )}
              </div>
              {sessionId && <p className="text-[10px] text-gray-400 mt-1 truncate">Sesión: {sessionId}</p>}
            </footer>
          </aside>
        </div>
      )}
    </>
  );
}
