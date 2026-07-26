import { create } from 'zustand';
import { isAxiosError } from 'axios';
import { api } from '../lib/api';

export type Project = {
  id: string;
  tenant_id: string;
  creator_id: string;
  name: string;
  description?: string;
  code_bpin?: string | null;
  sector?: string;
  problem_description?: string;
  general_objective?: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type BudgetItem = {
  id: string;
  tenant_id: string;
  project_id: string;
  product_id?: string | null;
  description: string;
  amount: number;
  created_at: string;
  updated_at: string;
};

export type CreateProjectPayload = {
  name: string;
  sector: string;
  description?: string;
  code_bpin?: string;
};

export type UpdateProjectDetailsPayload = {
  problem_description: string;
  general_objective: string;
};

export type CreateBudgetItemPayload = {
  description: string;
  amount: number;
  product_id?: string;
};

type PaginatedProjects = {
  data: Project[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

type ProjectState = {
  projects: Project[];
  currentProject: Project | null;
  budget: BudgetItem[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>;
  createProject: (data: CreateProjectPayload) => Promise<Project>;
  fetchProjectById: (id: string) => Promise<Project>;
  updateProjectDetails: (id: string, data: UpdateProjectDetailsPayload) => Promise<Project>;
  fetchBudget: (projectId: string) => Promise<void>;
  addBudgetItem: (projectId: string, data: CreateBudgetItemPayload) => Promise<BudgetItem>;
  deleteBudgetItem: (projectId: string, itemId: string) => Promise<void>;
  clearError: () => void;
  clearCurrentProject: () => void;
};

function extractError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const msg = (err.response?.data as { error?: string } | undefined)?.error;
    return msg || fallback;
  }
  return fallback;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  budget: [],
  isLoading: false,
  isSaving: false,
  error: null,

  clearError: () => set({ error: null }),
  clearCurrentProject: () => set({ currentProject: null, budget: [] }),

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get<PaginatedProjects>('/projects', {
        params: { page: 1, page_size: 100 },
      });
      set({ projects: data.data ?? [], isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: extractError(err, 'No se pudieron cargar los proyectos'),
      });
    }
  },

  createProject: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const body: Record<string, string> = {
        name: payload.name.trim(),
        sector: payload.sector.trim(),
      };
      if (payload.description?.trim()) {
        body.description = payload.description.trim();
      }
      if (payload.code_bpin?.trim()) {
        body.code_bpin = payload.code_bpin.trim();
      }

      const { data } = await api.post<Project>('/projects', body);
      set((state) => ({
        projects: [data, ...state.projects],
        currentProject: data,
        isLoading: false,
      }));
      return data;
    } catch (err) {
      const message = extractError(err, 'No se pudo crear el proyecto');
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  fetchProjectById: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get<Project>(`/projects/${id}`);
      set({ currentProject: data, isLoading: false });
      return data;
    } catch (err) {
      const message = extractError(err, 'No se pudo cargar el proyecto');
      set({ isLoading: false, error: message, currentProject: null });
      throw new Error(message);
    }
  },

  updateProjectDetails: async (id, payload) => {
    set({ isSaving: true, error: null });
    try {
      const { data } = await api.patch<Project>(`/projects/${id}/details`, {
        problem_description: payload.problem_description.trim(),
        general_objective: payload.general_objective.trim(),
      });
      set((state) => ({
        currentProject: data,
        projects: state.projects.map((p) => (p.id === id ? data : p)),
        isSaving: false,
      }));
      return data;
    } catch (err) {
      const message = extractError(err, 'No se pudieron guardar los detalles');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  fetchBudget: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get<BudgetItem[]>(`/projects/${projectId}/budget`);
      set({ budget: Array.isArray(data) ? data : [], isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: extractError(err, 'No se pudo cargar el presupuesto'),
        budget: [],
      });
    }
  },

  addBudgetItem: async (projectId, payload) => {
    set({ isSaving: true, error: null });
    try {
      const body: CreateBudgetItemPayload = {
        description: payload.description.trim(),
        amount: payload.amount,
      };
      if (payload.product_id) {
        body.product_id = payload.product_id;
      }

      const { data } = await api.post<BudgetItem>(`/projects/${projectId}/budget`, body);
      set({ budget: [...get().budget, data], isSaving: false });
      return data;
    } catch (err) {
      const message = extractError(err, 'No se pudo agregar el ítem');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  deleteBudgetItem: async (projectId, itemId) => {
    set({ error: null });
    try {
      await api.delete(`/projects/${projectId}/budget/${itemId}`);
      set({ budget: get().budget.filter((item) => item.id !== itemId) });
    } catch (err) {
      const message = extractError(err, 'No se pudo eliminar el ítem');
      set({ error: message });
      throw new Error(message);
    }
  },
}));
