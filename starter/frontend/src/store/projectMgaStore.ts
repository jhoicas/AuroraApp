import { create } from 'zustand';
import { isAxiosError } from 'axios';
import {
  createMgaCause,
  createMgaIndicator,
  deleteMgaIndicator,
  fetchMgaFormulation,
  updateMgaCause,
  updateMgaObjective,
  type CreateMgaCausePayload,
  type CreateMgaIndicatorPayload,
  type MgaCause,
  type MgaIndicator,
  type UpdateMgaCausePayload,
} from '../lib/mgaApi';

export type CauseType = 'Causa directa' | 'Causa indirecta';

export type CauseObjectiveRelation = {
  id: string;
  objectiveId?: string;
  causeType: CauseType;
  causeDescription: string;
  specificObjective: string;
};

export type GeneralObjectiveIndicator = {
  id: string;
  indicator: string;
  measuredThrough: string;
  target: string;
  sourceType: string;
  verificationSource: string;
};

export type ProjectMgaFormulation = {
  causeRelations: CauseObjectiveRelation[];
  generalIndicators: GeneralObjectiveIndicator[];
};

type ProjectMgaState = {
  byProjectId: Record<string, ProjectMgaFormulation>;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  getFormulation: (projectId: string) => ProjectMgaFormulation;
  fetchFormulation: (projectId: string) => Promise<ProjectMgaFormulation>;
  seedDefaultFormulation: (
    projectId: string,
    problemDescription: string,
    generalObjective: string,
  ) => Promise<void>;
  updateSpecificObjective: (
    projectId: string,
    relationId: string,
    description: string,
  ) => Promise<void>;
  updateCauseRelation: (
    projectId: string,
    relationId: string,
    patch: Partial<Pick<CauseObjectiveRelation, 'causeDescription' | 'specificObjective' | 'causeType'>>,
  ) => Promise<void>;
  createIndicator: (projectId: string, payload: CreateMgaIndicatorPayload) => Promise<void>;
  deleteIndicator: (projectId: string, indicatorId: string) => Promise<void>;
  clearError: () => void;
};

const EMPTY_FORMULATION: ProjectMgaFormulation = {
  causeRelations: [],
  generalIndicators: [],
};

function extractError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const msg = (err.response?.data as { error?: string } | undefined)?.error;
    return msg || fallback;
  }
  return fallback;
}

function causeTypeToApi(type: CauseType): 'directa' | 'indirecta' {
  return type === 'Causa directa' ? 'directa' : 'indirecta';
}

function causeTypeFromApi(type: string): CauseType {
  return type === 'directa' ? 'Causa directa' : 'Causa indirecta';
}

function mapCauseToRelation(cause: MgaCause): CauseObjectiveRelation {
  return {
    id: cause.id,
    objectiveId: cause.specific_objective?.id,
    causeType: causeTypeFromApi(cause.cause_type),
    causeDescription: cause.description,
    specificObjective: cause.specific_objective?.description ?? '',
  };
}

function mapIndicatorToUi(indicator: MgaIndicator): GeneralObjectiveIndicator {
  return {
    id: indicator.id,
    indicator: indicator.name,
    measuredThrough: indicator.unit,
    target: formatTarget(indicator.target),
    sourceType: indicator.source_type,
    verificationSource: indicator.verification_source,
  };
}

function formatTarget(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function parseTarget(value: string): number {
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formulationFromApi(causes: MgaCause[], indicators: MgaIndicator[]): ProjectMgaFormulation {
  return {
    causeRelations: causes.map(mapCauseToRelation),
    generalIndicators: indicators.map(mapIndicatorToUi),
  };
}

export const useProjectMgaStore = create<ProjectMgaState>((set, get) => ({
  byProjectId: {},
  isLoading: false,
  isSaving: false,
  error: null,

  clearError: () => set({ error: null }),

  getFormulation: (projectId) => {
    return get().byProjectId[projectId] ?? EMPTY_FORMULATION;
  },

  fetchFormulation: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      const data = await fetchMgaFormulation(projectId);
      const formulation = formulationFromApi(data.causes, data.indicators);
      set((state) => ({
        byProjectId: { ...state.byProjectId, [projectId]: formulation },
        isLoading: false,
      }));
      return formulation;
    } catch (err) {
      const message = extractError(err, 'No se pudo cargar la formulación MGA');
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  seedDefaultFormulation: async (projectId, problemDescription, generalObjective) => {
    const defaults = buildDefaultCauseRelations(problemDescription, generalObjective);
    set({ isSaving: true, error: null });
    try {
      const createdCauses: MgaCause[] = [];
      for (const [index, rel] of defaults.entries()) {
        const payload: CreateMgaCausePayload = {
          cause_type: causeTypeToApi(rel.causeType),
          description: rel.causeDescription,
          sort_order: index,
          specific_objective: rel.specificObjective,
        };
        const created = await createMgaCause(projectId, payload);
        createdCauses.push(created);
      }

      const indicator = await createMgaIndicator(projectId, {
        name: 'Mejoramiento vías urbanas',
        unit: 'Metros lineales',
        target: 301,
        source_type: 'Informe',
        verification_source: 'Informe - Secretaría de Infraestructura Municipal',
      });

      const formulation = formulationFromApi(createdCauses, [indicator]);
      set((state) => ({
        byProjectId: { ...state.byProjectId, [projectId]: formulation },
        isSaving: false,
      }));
    } catch (err) {
      const message = extractError(err, 'No se pudo inicializar la formulación MGA');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  updateSpecificObjective: async (projectId, relationId, description) => {
    const current = get().getFormulation(projectId);
    const relation = current.causeRelations.find((r) => r.id === relationId);
    if (!relation?.objectiveId) {
      throw new Error('No se encontró el objetivo específico asociado a la causa');
    }

    set({ isSaving: true, error: null });
    try {
      const updated = await updateMgaObjective(projectId, relation.objectiveId, {
        description: description.trim(),
      });
      set((state) => {
        const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        return {
          byProjectId: {
            ...state.byProjectId,
            [projectId]: {
              ...formulation,
              causeRelations: formulation.causeRelations.map((rel) =>
                rel.id === relationId
                  ? { ...rel, specificObjective: updated.description, objectiveId: updated.id }
                  : rel,
              ),
            },
          },
          isSaving: false,
        };
      });
    } catch (err) {
      const message = extractError(err, 'No se pudo actualizar el objetivo específico');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  updateCauseRelation: async (projectId, relationId, patch) => {
    const current = get().getFormulation(projectId);
    const relation = current.causeRelations.find((r) => r.id === relationId);
    if (!relation) {
      throw new Error('Causa no encontrada');
    }

    set({ isSaving: true, error: null });
    try {
      if (patch.causeDescription !== undefined || patch.causeType !== undefined) {
        const causePayload: UpdateMgaCausePayload = {};
        if (patch.causeDescription !== undefined) {
          causePayload.description = patch.causeDescription.trim();
        }
        if (patch.causeType !== undefined) {
          causePayload.cause_type = causeTypeToApi(patch.causeType);
        }
        const updatedCause = await updateMgaCause(projectId, relationId, causePayload);
        set((state) => {
          const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
          return {
            byProjectId: {
              ...state.byProjectId,
              [projectId]: {
                ...formulation,
                causeRelations: formulation.causeRelations.map((rel) =>
                  rel.id === relationId ? mapCauseToRelation(updatedCause) : rel,
                ),
              },
            },
          };
        });
      }

      if (patch.specificObjective !== undefined) {
        await get().updateSpecificObjective(projectId, relationId, patch.specificObjective);
        return;
      }

      set({ isSaving: false });
    } catch (err) {
      const message = extractError(err, 'No se pudo actualizar la relación causa-objetivo');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  createIndicator: async (projectId, payload) => {
    set({ isSaving: true, error: null });
    try {
      const created = await createMgaIndicator(projectId, payload);
      set((state) => {
        const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        return {
          byProjectId: {
            ...state.byProjectId,
            [projectId]: {
              ...formulation,
              generalIndicators: [...formulation.generalIndicators, mapIndicatorToUi(created)],
            },
          },
          isSaving: false,
        };
      });
    } catch (err) {
      const message = extractError(err, 'No se pudo crear el indicador');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  deleteIndicator: async (projectId, indicatorId) => {
    set({ isSaving: true, error: null });
    try {
      await deleteMgaIndicator(projectId, indicatorId);
      set((state) => {
        const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        return {
          byProjectId: {
            ...state.byProjectId,
            [projectId]: {
              ...formulation,
              generalIndicators: formulation.generalIndicators.filter((i) => i.id !== indicatorId),
            },
          },
          isSaving: false,
        };
      });
    } catch (err) {
      const message = extractError(err, 'No se pudo eliminar el indicador');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },
}));

/** Plantilla inicial cuando el proyecto aún no tiene causas en el backend. */
export function buildDefaultCauseRelations(
  problemDescription: string,
  generalObjective: string,
): CauseObjectiveRelation[] {
  const problem = problemDescription.trim() || 'Problema central no registrado.';
  const general = generalObjective.trim();

  return [
    {
      id: '',
      causeType: 'Causa directa',
      causeDescription: problem,
      specificObjective: general || 'Redacte el objetivo específico asociado a la causa directa.',
    },
    {
      id: '',
      causeType: 'Causa indirecta',
      causeDescription: 'Factores estructurales que amplifican el problema central.',
      specificObjective: 'Fortalecer las condiciones habilitantes del territorio.',
    },
  ];
}

export { parseTarget };
