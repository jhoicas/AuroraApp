import { create } from 'zustand';
import { isAxiosError } from 'axios';
import { api } from '../lib/api';

export type AIRole = 'user' | 'assistant';

export type AIMessage = {
  id: string;
  role: AIRole;
  content: string;
  created_at?: string;
};

type ChatResponse = {
  reply: string;
  model: string;
  user_message_id: string;
  assistant_message_id: string;
  project_id?: string | null;
};

type PaginatedHistory = {
  data: Array<{
    id: string;
    role: string;
    content: string;
    created_at: string;
  }>;
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

type AIState = {
  messages: AIMessage[];
  isTyping: boolean;
  error: string | null;
  rateLimited: boolean;
  fetchHistory: (projectId: string) => Promise<void>;
  sendMessage: (projectId: string, message: string) => Promise<void>;
  clearError: () => void;
  clearMessages: () => void;
};

function extractError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const msg = (err.response?.data as { error?: string } | undefined)?.error;
    return msg || fallback;
  }
  return fallback;
}

export const useAIStore = create<AIState>((set, get) => ({
  messages: [],
  isTyping: false,
  error: null,
  rateLimited: false,

  clearError: () => set({ error: null, rateLimited: false }),
  clearMessages: () => set({ messages: [], error: null, rateLimited: false }),

  fetchHistory: async (projectId) => {
    set({ error: null, rateLimited: false });
    try {
      const { data } = await api.get<PaginatedHistory>(
        `/ai/projects/${projectId}/history`,
        { params: { page: 1, page_size: 100 } },
      );

      const messages: AIMessage[] = (data.data ?? [])
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          id: m.id,
          role: m.role as AIRole,
          content: m.content,
          created_at: m.created_at,
        }));

      set({ messages });
    } catch (err) {
      set({
        error: extractError(err, 'No se pudo cargar el historial del chat'),
        messages: [],
      });
    }
  },

  sendMessage: async (projectId, message) => {
    const trimmed = message.trim();
    if (!trimmed) return;

    const tempUserId = `temp-user-${Date.now()}`;
    const optimistic: AIMessage = {
      id: tempUserId,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    };

    set({
      messages: [...get().messages, optimistic],
      isTyping: true,
      error: null,
      rateLimited: false,
    });

    try {
      const { data } = await api.post<ChatResponse>('/ai/chat', {
        message: trimmed,
        project_id: projectId,
      });

      set({
        messages: [
          ...get().messages.filter((m) => m.id !== tempUserId),
          {
            id: data.user_message_id,
            role: 'user',
            content: trimmed,
          },
          {
            id: data.assistant_message_id,
            role: 'assistant',
            content: data.reply,
          },
        ],
        isTyping: false,
      });
    } catch (err) {
      set({
        messages: get().messages.filter((m) => m.id !== tempUserId),
        isTyping: false,
      });

      if (isAxiosError(err) && err.response?.status === 429) {
        set({
          rateLimited: true,
          error:
            'Has alcanzado el límite de mensajes (10 por minuto). Espera un minuto e intenta de nuevo.',
        });
        return;
      }

      set({
        error: extractError(err, 'No se pudo enviar el mensaje'),
      });
      throw err;
    }
  },
}));
