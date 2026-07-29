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
};

type AuroraCopilotState = {
  isOpen: boolean;
  messages: CopilotMessage[];
  isTyping: boolean;
  error: string | null;
  toggleOpen: () => void;
  open: () => void;
  close: () => void;
  sendMessage: (message: string, routeContext: string) => Promise<void>;
  clearError: () => void;
};

function extractError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    return (err.response?.data as { error?: string } | undefined)?.error || fallback;
  }
  return fallback;
}

export const useAuroraCopilotStore = create<AuroraCopilotState>((set, get) => ({
  isOpen: false,
  messages: [],
  isTyping: false,
  error: null,

  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen, error: null })),
  open: () => set({ isOpen: true, error: null }),
  close: () => set({ isOpen: false }),
  clearError: () => set({ error: null }),

  sendMessage: async (message, routeContext) => {
    const trimmed = message.trim();
    if (!trimmed) return;

    const userMsg: CopilotMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    set({
      messages: [...get().messages, userMsg],
      isTyping: true,
      error: null,
    });

    try {
      const { data } = await api.post<AuroraChatResponse>('/ai/aurora/chat', {
        message: trimmed,
        route_context: routeContext,
      });

      const assistantMsg: CopilotMessage = {
        id: `assistant-${Date.now()}`,
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
      });
    } catch (err) {
      set({
        isTyping: false,
        error: extractError(err, 'Aurora no pudo responder. Verifica tu conexión o la API key de Anthropic.'),
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
