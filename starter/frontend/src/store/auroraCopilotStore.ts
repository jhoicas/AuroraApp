import { create } from 'zustand';
import { isAxiosError } from 'axios';
import { useEffect } from 'react';
import { api } from '../lib/api';
import { useCatalogStore, type CopilotCatalogTarget } from './catalogStore';

export type ActionCardPayload = {
  catalog: CopilotCatalogTarget;
  code: string;
  label: string;
  description?: string;
};

export type CopilotMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actionCards?: ActionCardPayload[];
};

type AuroraChatResponse = {
  reply: string;
  action_cards: ActionCardPayload[];
  model: string;
  session_id: string;
  user_message_id: string;
  assistant_message_id: string;
};

type AuroraCopilotState = {
  isOpen: boolean;
  messages: CopilotMessage[];
  isTyping: boolean;
  error: string | null;
  sessionId: string | null;
  abortController: AbortController | null;
  /** Texto pendiente de enviar (grafo, tooltips, FloatingAssistant). */
  draftInput: string;
  toggleOpen: () => void;
  open: () => void;
  close: () => void;
  sendMessage: (message: string, routeContext: string) => Promise<void>;
  cancelGeneration: () => void;
  clearError: () => void;
  /** Reinicia el chat: aborta generación en curso, limpia historial y session_id. */
  clearChat: () => void;
  setDraftInput: (value: string) => void;
  appendToDraft: (text: string) => void;
  /** Abre el asistente flotante e inyecta un prompt en el input. */
  askAurora: (prompt: string) => void;
};

function extractError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    if (err.code === 'ERR_CANCELED') {
      return 'Generación cancelada.';
    }
    return (err.response?.data as { error?: string } | undefined)?.error || fallback;
  }
  return fallback;
}

export const useAuroraCopilotStore = create<AuroraCopilotState>((set, get) => ({
  isOpen: false,
  messages: [],
  isTyping: false,
  error: null,
  sessionId: null,
  abortController: null,
  draftInput: '',

  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen, error: null })),
  open: () => set({ isOpen: true, error: null }),
  close: () => set({ isOpen: false }),

  clearError: () => set({ error: null }),

  setDraftInput: (value) => set({ draftInput: value }),

  appendToDraft: (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const current = get().draftInput.trim();
    set({
      draftInput: current ? `${current} ${trimmed}` : trimmed,
    });
  },

  askAurora: (prompt) => {
    const trimmed = prompt.trim();
    set({
      isOpen: true,
      error: null,
      draftInput: trimmed || get().draftInput,
    });
  },

  clearChat: () => {
    const controller = get().abortController;
    if (controller) {
      controller.abort();
    }
    set({
      messages: [],
      isTyping: false,
      error: null,
      sessionId: null,
      abortController: null,
      draftInput: '',
    });
  },

  cancelGeneration: () => {
    const controller = get().abortController;
    if (controller) {
      controller.abort();
    }
    set({ isTyping: false, abortController: null });
  },

  sendMessage: async (message, routeContext) => {
    const trimmed = message.trim();
    if (!trimmed) return;

    get().abortController?.abort();

    const controller = new AbortController();
    const userMsg: CopilotMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    set({
      messages: [...get().messages, userMsg],
      isTyping: true,
      error: null,
      abortController: controller,
      draftInput: '',
    });

    try {
      const sessionId = get().sessionId;
      const { data } = await api.post<AuroraChatResponse>(
        '/ai/aurora/chat',
        {
          message: trimmed,
          route_context: routeContext,
          ...(sessionId ? { session_id: sessionId } : {}),
        },
        { signal: controller.signal },
      );

      const assistantMsg: CopilotMessage = {
        id: data.assistant_message_id || `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        actionCards: (data.action_cards ?? []).map((c) => ({
          catalog: c.catalog as CopilotCatalogTarget,
          code: c.code,
          label: c.label,
          description: c.description,
        })),
      };

      set({
        messages: [...get().messages, assistantMsg],
        isTyping: false,
        sessionId: data.session_id,
        abortController: null,
      });
    } catch (err) {
      if (isAxiosError(err) && err.code === 'ERR_CANCELED') {
        set({ isTyping: false, abortController: null });
        return;
      }
      set({
        isTyping: false,
        abortController: null,
        error: extractError(err, 'Aurora no pudo responder. Verifica tu conexión.'),
      });
    }
  },
}));

/** Sincroniza búsqueda de catálogo cuando Aurora Copilot aplica una Action Card. */
export function useCopilotSearchSync(
  catalog: CopilotCatalogTarget,
  setQuery: (query: string) => void,
) {
  const copilotSearch = useCatalogStore((s) => s.copilotSearch);
  const consumeCopilotSearch = useCatalogStore((s) => s.consumeCopilotSearch);

  useEffect(() => {
    if (copilotSearch?.catalog === catalog && copilotSearch.query) {
      setQuery(copilotSearch.query);
      consumeCopilotSearch(catalog);
    }
  }, [catalog, copilotSearch, setQuery, consumeCopilotSearch]);
}

export const COPILOT_CATALOG_ROUTES: Record<CopilotCatalogTarget, string> = {
  ods: '/admin/catalogs/ods',
  products: '/admin/catalogs/products',
  sectors: '/admin/catalogs/sectors',
  programs: '/admin/catalogs/programs',
  edt: '/admin/catalogs/edt',
  deliverables: '/admin/catalogs/deliverables',
  activities: '/admin/catalogs/activities',
};
