import { useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import WikiManager from '../../components/WikiManager';
import CatalogImporter from '../../components/CatalogImporter';

type Message = { role: string; text: string; sector?: string; programa?: string; catalogCodes?: string };

export default function AiAssistantPage() {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: '¡Hola! Soy Aurora, tu asistente experta en formulación de proyectos. ¿En qué te puedo ayudar hoy?' }
  ]);
  const [isThinking, setIsThinking] = useState(false);

  const handleSend = async () => {
    if (!query || isThinking) return;
    const userMessage: Message = { role: 'user', text: query };
    setMessages(prev => [...prev, userMessage]);
    setIsThinking(true);

    try {
      const response = await fetch('/api/tenant/ai/formulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const data = await response.json();
      setMessages(prev => [...prev, {
        role: 'ai',
        text: data.response,
        sector: data.sector,
        programa: data.programa,
        catalogCodes: data.catalog_codes,
      }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'No pude procesar la consulta en este momento.' }]);
    } finally {
      setIsThinking(false);
      setQuery('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
        <div className="flex h-[80vh] flex-col overflow-hidden rounded-lg bg-white shadow">
          <div className="bg-emerald-800 p-4 font-bold text-white">Asistente Aurora</div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg p-3 ${m.role === 'user' ? 'bg-blue-100 text-blue-900' : 'bg-gray-100 text-gray-800'}`}>
                  <p>{m.text}</p>
                  {(m.sector || m.programa || m.catalogCodes) && (
                    <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-800">
                      {m.sector && <div><strong>Sector:</strong> {m.sector}</div>}
                      {m.programa && <div><strong>Programa:</strong> {m.programa}</div>}
                      {m.catalogCodes && <div><strong>Códigos:</strong> {m.catalogCodes}</div>}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex justify-start">
                <div className="flex max-w-[80%] items-center gap-2 rounded-lg bg-gray-100 p-3 text-gray-700">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  <span>Estoy consultando el wiki y el catálogo para responder.</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2 border-t p-4">
            <input
              type="text"
              className="flex-1 rounded border p-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Describe tu problema o pide ayuda con un árbol de objetivos..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              disabled={isThinking}
            />
            <button onClick={handleSend} className="rounded bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400" disabled={isThinking}>
              {isThinking ? 'Procesando...' : 'Enviar'}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <WikiManager />
          <CatalogImporter />
        </div>
      </div>
    </div>
  );
}
