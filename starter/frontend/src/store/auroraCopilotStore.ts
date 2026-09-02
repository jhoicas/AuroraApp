import { create } from 'zustand';
import { isAxiosError } from 'axios';
import { useEffect } from 'react';
import { api } from '../lib/api';
import { useCatalogStore, type CopilotCatalogTarget } from './catalogStore';

export type ActionCardType = 'mga_apply' | 'mga_generate_project' | 'catalog_search' | 'navigate';

export type ActionCardPayload = {
  type?: ActionCardType;
  catalog?: CopilotCatalogTarget;
  code?: string;
  label: string;
  description?: string;
  payload?: Record<string, unknown>;
};

export type CopilotMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actionCards?: ActionCardPayload[];
};

export type CreationContext = {
  ideaSummary: string;
  sectorCode?: string;
  sectorName?: string;
  sectorId?: string;
  productCodes?: string[];
  programCodes?: string[];
  odsCodes?: string[];
};

/** Ruta backend para la entrevista de creación asistida de proyecto MGA. */
export const ROUTE_PROJECT_CREATION = 'mga:project-creation';

type AuroraChatResponse = {
  reply: string;
  action_cards: Array<{
    type?: ActionCardType;
    catalog?: string;
    code?: string;
    label: string;
    description?: string;
    payload?: Record<string, unknown>;
  }>;
  model: string;
  session_id: string;
  user_message_id: string;
  assistant_message_id: string;
};

export type MgaProjectContext = {
  problem_description?: string;
  situacion_existente?: string;
  magnitud_problema?: string;
};

type AuroraCopilotState = {
  isOpen: boolean;
  messages: CopilotMessage[];
  isTyping: boolean;
  error: string | null;
  sessionId: string | null;
  interviewSessionId: string | null;
  interviewStarted: boolean;
  interviewCreationContext: CreationContext | null;
  abortController: AbortController | null;
  /** Texto pendiente de enviar (grafo, tooltips, FloatingAssistant). */
  draftInput: string;
  toggleOpen: () => void;
  open: () => void;
  close: () => void;
  sendMessage: (message: string, routeContext: string, projectContext?: MgaProjectContext) => Promise<void>;
  startInterview: (context: CreationContext) => Promise<void>;
  endInterview: () => void;
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

function mapCreationContextToApi(ctx: CreationContext) {
  return {
    idea_summary: ctx.ideaSummary,
    ...(ctx.sectorCode ? { sector_code: ctx.sectorCode } : {}),
    ...(ctx.sectorName ? { sector_name: ctx.sectorName } : {}),
    ...(ctx.productCodes?.length ? { product_codes: ctx.productCodes } : {}),
    ...(ctx.programCodes?.length ? { program_codes: ctx.programCodes } : {}),
    ...(ctx.odsCodes?.length ? { ods_codes: ctx.odsCodes } : {}),
  };
}

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useAuroraCopilotStore = create<AuroraCopilotState>((set, get) => ({
  isOpen: false,
  messages: [],
  isTyping: false,
  error: null,
  sessionId: null,
  interviewSessionId: null,
  interviewStarted: false,
  interviewCreationContext: null,
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

  endInterview: () => {
    const controller = get().abortController;
    if (controller) {
      controller.abort();
    }
    set({
      interviewSessionId: null,
      interviewStarted: false,
      interviewCreationContext: null,
      messages: [],
      isTyping: false,
      error: null,
      sessionId: null,
      abortController: null,
      draftInput: '',
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
      interviewSessionId: null,
      interviewStarted: false,
      interviewCreationContext: null,
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

  startInterview: async (context) => {
    const idea = context.ideaSummary.trim();
    if (!idea) return;

    get().abortController?.abort();

    const sessionId = generateSessionId();
    set({
      interviewSessionId: sessionId,
      interviewStarted: true,
      interviewCreationContext: context,
      messages: [],
      sessionId: null,
      error: null,
      draftInput: '',
      isOpen: false,
    });

    const opener = `¡Hola Aurora! Quiero formular este proyecto: ${idea}`;
    await get().sendMessage(opener, ROUTE_PROJECT_CREATION);
  },

  sendMessage: async (message, routeContext, projectContext) => {
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
      ...(routeContext === ROUTE_PROJECT_CREATION ? {} : { isOpen: true }),
    });

    try {
      const interviewSessionId = get().interviewSessionId;
      const sessionId = interviewSessionId ?? get().sessionId;
      const creationContext =
        routeContext === ROUTE_PROJECT_CREATION ? get().interviewCreationContext : null;

      const { data } = await api.post<AuroraChatResponse>(
        '/ai/aurora/chat',
        {
          message: trimmed,
          route_context: routeContext,
          ...(sessionId ? { session_id: sessionId } : {}),
          ...(projectContext ? { project_context: projectContext } : {}),
          ...(creationContext ? { creation_context: mapCreationContextToApi(creationContext) } : {}),
        },
        { signal: controller.signal },
      );

      const assistantMsg: CopilotMessage = {
        id: data.assistant_message_id || `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        actionCards: (data.action_cards ?? [])
          .filter((c) => c.label?.trim())
          .map((c) => ({
            type: c.type,
            catalog: c.catalog as CopilotCatalogTarget | undefined,
            code: c.code ?? '',
            label: c.label,
            description: c.description,
            payload: c.payload,
          })),
      };

      const resolvedSession = data.session_id || sessionId || null;

      set({
        messages: [...get().messages, assistantMsg],
        isTyping: false,
        abortController: null,
        ...(interviewSessionId
          ? { interviewSessionId: resolvedSession }
          : { sessionId: resolvedSession }),
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
