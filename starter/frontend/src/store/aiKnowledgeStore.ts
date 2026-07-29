import { create } from 'zustand';
import { isAxiosError } from 'axios';
import { api } from '../lib/api';

export type KnowledgeIngestSummary = {
  project_key: string;
  project_name: string;
  nodes_created: number;
  links_created: number;
  alternatives: number;
  products: number;
  activities: number;
  causes: number;
  effects: number;
  central_problem: boolean;
  specific_objective: boolean;
  message: string;
};

export type KnowledgeGraphNode = {
  id: string;
  label: string;
  type: string;
  group: string;
  content?: string;
};

export type KnowledgeGraphLink = {
  source: string;
  target: string;
  relationship: string;
};

export type KnowledgeGraph = {
  nodes: KnowledgeGraphNode[];
  links: KnowledgeGraphLink[];
};

type AiKnowledgeState = {
  graph: KnowledgeGraph | null;
  lastIngest: KnowledgeIngestSummary | null;
  loadingGraph: boolean;
  ingesting: boolean;
  error: string | null;
  fetchGraph: () => Promise<void>;
  ingestXml: (file: File) => Promise<KnowledgeIngestSummary>;
  logTelemetry: (action: string) => Promise<void>;
  clearError: () => void;
};

function extractError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    return (err.response?.data as { error?: string } | undefined)?.error || fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

export const useAiKnowledgeStore = create<AiKnowledgeState>((set, get) => ({
  graph: null,
  lastIngest: null,
  loadingGraph: false,
  ingesting: false,
  error: null,

  clearError: () => set({ error: null }),

  logTelemetry: async (action: string) => {
    try {
      await api.post('/ai/telemetry/log', { action }, { timeout: 5000 });
    } catch {
      /* telemetría silenciosa — no interrumpe UX */
    }
  },

  fetchGraph: async () => {
    set({ loadingGraph: true, error: null });
    try {
      const { data } = await api.get<KnowledgeGraph>('/ai/knowledge/graph');
      set({ graph: data, loadingGraph: false });
      void get().logTelemetry('view_graph');
    } catch (err: unknown) {
      set({ loadingGraph: false, error: extractError(err, 'No se pudo cargar el grafo de conocimiento') });
    }
  },

  ingestXml: async (file: File) => {
    set({ ingesting: true, error: null });
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post<KnowledgeIngestSummary>('/ai/knowledge/ingest', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      set({ lastIngest: data, ingesting: false });
      await get().fetchGraph();
      return data;
    } catch (err: unknown) {
      const message = extractError(err, 'Error al ingerir el XML MGA');
      set({ ingesting: false, error: message });
      throw new Error(message);
    }
  },
}));

/** Colores Obsidian: Problema=Rojo, Causa=Naranja, Alternativa=Verde, Proyecto=Azul */
export const nodeTypeColors: Record<string, string> = {
  project: '#2563eb',
  central_problem: '#dc2626',
  cause: '#ea580c',
  effect: '#f97316',
  specific_objective: '#6366f1',
  alternative: '#16a34a',
  product: '#0891b2',
  activity: '#65a30d',
};

export const nodeTypeLabels: Record<string, string> = {
  project: 'Proyecto',
  central_problem: 'Problema central',
  cause: 'Causa',
  effect: 'Efecto',
  specific_objective: 'Objetivo específico',
  alternative: 'Alternativa',
  product: 'Producto',
  activity: 'Actividad',
};

export const relationshipLabels: Record<string, string> = {
  has_problem: 'tiene problema',
  has_cause: 'tiene causa',
  has_effect: 'tiene efecto',
  has_objective: 'tiene objetivo',
  has_alternative: 'tiene alternativa',
  has_product: 'tiene producto',
  has_activity: 'tiene actividad',
};
