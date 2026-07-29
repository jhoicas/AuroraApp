import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ActionCard from './ActionCard';
import {
  COPILOT_CATALOG_ROUTES,
  useAuroraCopilotStore,
  type ActionCardPayload,
} from '../../store/auroraCopilotStore';
import { useCatalogStore } from '../../store/catalogStore';

export default function AuroraCopilot() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const {
    isOpen,
    messages,
    isTyping,
    error,
    toggleOpen,
    close,
    sendMessage,
    clearError,
  } = useAuroraCopilotStore();
  const applyCopilotSearch = useCatalogStore((s) => s.applyCopilotSearch);

  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping]);

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

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={toggleOpen}
          aria-label="Abrir Aurora Copilot"
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#006162] hover:bg-[#004f50] text-white shadow-lg shadow-teal-900/25 flex items-center justify-center transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006162] focus-visible:ring-offset-2"
        >
          <span className="material-symbols-outlined text-2xl">smart_toy</span>
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-label="Aurora Copilot">
          <button
            type="button"
            className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
            aria-label="Cerrar copilot"
            onClick={close}
          />
          <aside className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col border-l border-gray-200 animate-in slide-in-from-right">
            <header className="px-4 py-4 border-b border-gray-100 bg-gradient-to-r from-[#006162] to-[#2c7a7b] text-white shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined">psychology</span>
                  <div>
                    <h2 className="font-bold text-lg leading-tight">Aurora Copilot</h2>
                    <p className="text-xs text-white/80">MGA · Claude Haiku</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="p-1.5 rounded-lg hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  aria-label="Cerrar"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <p className="text-[11px] mt-2 text-white/75 truncate" title={pathname}>
                Contexto: {pathname}
              </p>
            </header>

            <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f9f9ff]">
              {messages.length === 0 && (
                <div className="text-center text-sm text-gray-500 py-8 px-4">
                  <span className="material-symbols-outlined text-4xl text-[#006162]/40 mb-2 block">waving_hand</span>
                  Hola, soy Aurora. Pregúntame sobre formulación MGA o pídeme códigos de catálogo.
                </div>
              )}

              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
                        <ActionCard card={card} onApply={handleApply} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-2 text-sm text-gray-500 shadow-sm">
                    Aurora está escribiendo…
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="px-4 py-2 bg-red-50 border-t border-red-100 text-xs text-red-700 flex justify-between gap-2">
                <span>{error}</span>
                <button type="button" onClick={clearError} className="underline shrink-0">
                  Cerrar
                </button>
              </div>
            )}

            <footer className="p-4 border-t border-gray-100 bg-white shrink-0">
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
                  placeholder="Pregunta sobre MGA o catálogos…"
                  disabled={isTyping}
                  className="flex-1 h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006162] disabled:opacity-60"
                  aria-label="Mensaje para Aurora"
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={isTyping || !input.trim()}
                  className="h-11 px-4 rounded-xl bg-[#006162] hover:bg-[#004f50] disabled:opacity-50 text-white font-semibold text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006162]"
                >
                  Enviar
                </button>
              </div>
            </footer>
          </aside>
        </div>
      )}
    </>
  );
}
