import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const API_URL = 'http://localhost:8080/api/v1';

/** Construye una URL absoluta del API para registrar handlers MSW. */
export const apiUrl = (path: string): string => `${API_URL}${path}`;

/**
 * Handlers por defecto: devuelven respuestas vacías y válidas.
 * Cada test sobreescribe lo que necesita con `server.use(...)`.
 */
export const defaultHandlers = [
  http.post(apiUrl('/ai/aurora/chat'), () =>
    HttpResponse.json({
      reply: 'Respuesta por defecto de Aurora.',
      action_cards: [],
      model: 'claude-haiku-4-5-20251001',
      session_id: 'session-default',
      user_message_id: 'user-1',
      assistant_message_id: 'assistant-1',
    }),
  ),
  http.get(apiUrl('/projects'), () =>
    HttpResponse.json({ data: [], page: 1, page_size: 100, total: 0, total_pages: 1 }),
  ),
  http.get(apiUrl('/projects/evaluations/summary'), () => HttpResponse.json({ data: [] })),
  http.get(apiUrl('/catalog/sectors'), () =>
    HttpResponse.json({ data: [], meta: { page: 1, limit: 20, total: 0, last_page: 1 } }),
  ),
];

export const server = setupServer(...defaultHandlers);

/** Atajo para simular un error del backend con el JSON estructurado de la API. */
export const errorResponse = (status: number, message: string) =>
  HttpResponse.json({ error: message }, { status });
