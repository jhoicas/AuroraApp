import { create } from 'zustand';
import { isAxiosError } from 'axios';
import {
  createActivity,
  createDeliverable,
  createEdtNode,
  deleteActivity,
  deleteDeliverable,
  deleteEdtNode,
  getEdtChain,
  linkCatalogProduct,
  updateActivity,
  updateDeliverable,
  updateEdtNode,
  type CreateActivityPayload,
  type CreateDeliverablePayload,
  type CreateEdtNodePayload,
  type EdtChainResponse,
  type ProjectActivity,
  type ProjectCatalogLink,
  type ProjectDeliverable,
  type ProjectEdtNode,
  type UpdateActivityPayload,
  type UpdateDeliverablePayload,
  type UpdateEdtNodePayload,
} from '../lib/projectEdtApi';

export type ProjectEdtChainState = {
  catalogLink: ProjectCatalogLink | null;
  edtNodes: ProjectEdtNode[];
  deliverables: ProjectDeliverable[];
  activities: ProjectActivity[];
};

type ProjectEdtStoreState = {
  byProjectId: Record<string, ProjectEdtChainState>;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  getChain: (projectId: string) => ProjectEdtChainState;
  clearError: () => void;
  fetchEdtChain: (projectId: string) => Promise<ProjectEdtChainState>;
  linkProduct: (projectId: string, productCode: string) => Promise<ProjectCatalogLink>;
  addEdtNode: (projectId: string, payload: CreateEdtNodePayload) => Promise<void>;
  editEdtNode: (projectId: string, nodeId: string, payload: UpdateEdtNodePayload) => Promise<void>;
  removeEdtNode: (projectId: string, nodeId: string) => Promise<void>;
  addDeliverable: (projectId: string, payload: CreateDeliverablePayload) => Promise<void>;
  editDeliverable: (
    projectId: string,
    deliverableId: string,
    payload: UpdateDeliverablePayload,
  ) => Promise<void>;
  removeDeliverable: (projectId: string, deliverableId: string) => Promise<void>;
  addActivity: (projectId: string, payload: CreateActivityPayload) => Promise<void>;
  editActivity: (
    projectId: string,
    activityId: string,
    payload: UpdateActivityPayload,
  ) => Promise<void>;
  removeActivity: (projectId: string, activityId: string) => Promise<void>;
};

const EMPTY_CHAIN: ProjectEdtChainState = {
  catalogLink: null,
  edtNodes: [],
  deliverables: [],
  activities: [],
};

function extractError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const msg = (err.response?.data as { error?: string } | undefined)?.error;
    return msg || fallback;
  }
  return fallback;
}

function chainFromApi(data: EdtChainResponse): ProjectEdtChainState {
  return {
    catalogLink: data.catalog_link ?? null,
    edtNodes: data.edt_nodes ?? [],
    deliverables: data.deliverables ?? [],
    activities: data.activities ?? [],
  };
}

function patchChain(
  state: ProjectEdtStoreState,
  projectId: string,
  patch: Partial<ProjectEdtChainState>,
): Record<string, ProjectEdtChainState> {
  const current = state.byProjectId[projectId] ?? EMPTY_CHAIN;
  return {
    ...state.byProjectId,
    [projectId]: { ...current, ...patch },
  };
}

export const useProjectEdtStore = create<ProjectEdtStoreState>((set, get) => ({
  byProjectId: {},
  isLoading: false,
  isSaving: false,
  error: null,

  clearError: () => set({ error: null }),

  getChain: (projectId) => get().byProjectId[projectId] ?? EMPTY_CHAIN,

  fetchEdtChain: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      const data = await getEdtChain(projectId);
      const chain = chainFromApi(data);
      set((state) => ({
        byProjectId: { ...state.byProjectId, [projectId]: chain },
        isLoading: false,
      }));
      return chain;
    } catch (err) {
      const message = extractError(err, 'No se pudo cargar la cadena de valor');
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  linkProduct: async (projectId, productCode) => {
    set({ isSaving: true, error: null });
    try {
      const link = await linkCatalogProduct(projectId, productCode.trim());
      await get().fetchEdtChain(projectId);
      set({ isSaving: false });
      return link;
    } catch (err) {
      const message = extractError(err, 'No se pudo vincular el producto del catálogo');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  addEdtNode: async (projectId, payload) => {
    set({ isSaving: true, error: null });
    try {
      const created = await createEdtNode(projectId, payload);
      set((state) => {
        const chain = state.byProjectId[projectId] ?? EMPTY_CHAIN;
        return {
          byProjectId: patchChain(state, projectId, {
            edtNodes: [...chain.edtNodes, created],
          }),
          isSaving: false,
        };
      });
    } catch (err) {
      const message = extractError(err, 'No se pudo crear el nodo EDT');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  editEdtNode: async (projectId, nodeId, payload) => {
    set({ isSaving: true, error: null });
    try {
      const updated = await updateEdtNode(projectId, nodeId, payload);
      set((state) => {
        const chain = state.byProjectId[projectId] ?? EMPTY_CHAIN;
        return {
          byProjectId: patchChain(state, projectId, {
            edtNodes: chain.edtNodes.map((n) => (n.id === nodeId ? updated : n)),
          }),
          isSaving: false,
        };
      });
    } catch (err) {
      const message = extractError(err, 'No se pudo actualizar el nodo EDT');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  removeEdtNode: async (projectId, nodeId) => {
    set({ isSaving: true, error: null });
    try {
      await deleteEdtNode(projectId, nodeId);
      set((state) => {
        const chain = state.byProjectId[projectId] ?? EMPTY_CHAIN;
        return {
          byProjectId: patchChain(state, projectId, {
            edtNodes: chain.edtNodes.filter((n) => n.id !== nodeId),
            deliverables: chain.deliverables.filter((d) => d.project_edt_node_id !== nodeId),
            activities: chain.activities.filter((a) => {
              const del = chain.deliverables.find((d) => d.id === a.project_deliverable_id);
              return del?.project_edt_node_id !== nodeId;
            }),
          }),
          isSaving: false,
        };
      });
    } catch (err) {
      const message = extractError(err, 'No se pudo eliminar el nodo EDT');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  addDeliverable: async (projectId, payload) => {
    set({ isSaving: true, error: null });
    try {
      const created = await createDeliverable(projectId, payload);
      set((state) => {
        const chain = state.byProjectId[projectId] ?? EMPTY_CHAIN;
        return {
          byProjectId: patchChain(state, projectId, {
            deliverables: [...chain.deliverables, created],
          }),
          isSaving: false,
        };
      });
    } catch (err) {
      const message = extractError(err, 'No se pudo crear el entregable');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  editDeliverable: async (projectId, deliverableId, payload) => {
    set({ isSaving: true, error: null });
    try {
      const updated = await updateDeliverable(projectId, deliverableId, payload);
      set((state) => {
        const chain = state.byProjectId[projectId] ?? EMPTY_CHAIN;
        return {
          byProjectId: patchChain(state, projectId, {
            deliverables: chain.deliverables.map((d) =>
              d.id === deliverableId ? updated : d,
            ),
          }),
          isSaving: false,
        };
      });
    } catch (err) {
      const message = extractError(err, 'No se pudo actualizar el entregable');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  removeDeliverable: async (projectId, deliverableId) => {
    set({ isSaving: true, error: null });
    try {
      await deleteDeliverable(projectId, deliverableId);
      set((state) => {
        const chain = state.byProjectId[projectId] ?? EMPTY_CHAIN;
        return {
          byProjectId: patchChain(state, projectId, {
            deliverables: chain.deliverables.filter((d) => d.id !== deliverableId),
            activities: chain.activities.filter((a) => a.project_deliverable_id !== deliverableId),
          }),
          isSaving: false,
        };
      });
    } catch (err) {
      const message = extractError(err, 'No se pudo eliminar el entregable');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  addActivity: async (projectId, payload) => {
    set({ isSaving: true, error: null });
    try {
      const created = await createActivity(projectId, payload);
      set((state) => {
        const chain = state.byProjectId[projectId] ?? EMPTY_CHAIN;
        return {
          byProjectId: patchChain(state, projectId, {
            activities: [...chain.activities, created],
          }),
          isSaving: false,
        };
      });
    } catch (err) {
      const message = extractError(err, 'No se pudo crear la actividad');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  editActivity: async (projectId, activityId, payload) => {
    set({ isSaving: true, error: null });
    try {
      const updated = await updateActivity(projectId, activityId, payload);
      set((state) => {
        const chain = state.byProjectId[projectId] ?? EMPTY_CHAIN;
        return {
          byProjectId: patchChain(state, projectId, {
            activities: chain.activities.map((a) => (a.id === activityId ? updated : a)),
          }),
          isSaving: false,
        };
      });
    } catch (err) {
      const message = extractError(err, 'No se pudo actualizar la actividad');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  removeActivity: async (projectId, activityId) => {
    set({ isSaving: true, error: null });
    try {
      await deleteActivity(projectId, activityId);
      set((state) => {
        const chain = state.byProjectId[projectId] ?? EMPTY_CHAIN;
        return {
          byProjectId: patchChain(state, projectId, {
            activities: chain.activities.filter((a) => a.id !== activityId),
          }),
          isSaving: false,
        };
      });
    } catch (err) {
      const message = extractError(err, 'No se pudo eliminar la actividad');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },
}));
