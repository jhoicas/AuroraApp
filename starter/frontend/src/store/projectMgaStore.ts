import { create } from 'zustand';
import { isAxiosError } from 'axios';
import {
  createMgaAlternative,
  createMgaCause,
  createMgaEffect,
  createMgaIndicator,
  createMgaParticipant,
  createMgaPopulation,
  deleteMgaAlternative,
  deleteMgaCause,
  deleteMgaEffect,
  deleteMgaIndicator,
  deleteMgaParticipant,
  deleteMgaPopulation,
  fetchMgaFormulation,
  updateMgaAlternative,
  updateMgaCause,
  updateMgaEffect,
  updateMgaObjective,
  updateMgaParticipant,
  updateMgaPopulation,
  type CreateMgaAlternativePayload,
  type CreateMgaCausePayload,
  type CreateMgaEffectPayload,
  type CreateMgaIndicatorPayload,
  type CreateMgaParticipantPayload,
  type CreateMgaPopulationPayload,
  type FullMgaFormulation,
  type MgaAlternative,
  type MgaCause,
  type MgaEffect,
  type MgaIndicator,
  type MgaParticipant,
  type MgaPopulation,
  type MgaPopulationType,
  type UpdateMgaAlternativePayload,
  type UpdateMgaCausePayload,
  type UpdateMgaEffectPayload,
  type UpdateMgaParticipantPayload,
} from '../lib/mgaApi';

export type CauseType = 'Causa directa' | 'Causa indirecta';
export type EffectType = 'Efecto directo' | 'Efecto indirecto';

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
  effects: MgaEffect[];
  participants: MgaParticipant[];
  populations: MgaPopulation[];
  alternatives: MgaAlternative[];
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
  addCause: (projectId: string, payload: CreateMgaCausePayload) => Promise<void>;
  removeCause: (projectId: string, causeId: string) => Promise<void>;
  addEffect: (projectId: string, payload: CreateMgaEffectPayload) => Promise<void>;
  editEffect: (projectId: string, effectId: string, payload: UpdateMgaEffectPayload) => Promise<void>;
  removeEffect: (projectId: string, effectId: string) => Promise<void>;
  addParticipant: (projectId: string, payload: CreateMgaParticipantPayload) => Promise<void>;
  editParticipant: (
    projectId: string,
    participantId: string,
    payload: UpdateMgaParticipantPayload,
  ) => Promise<void>;
  removeParticipant: (projectId: string, participantId: string) => Promise<void>;
  savePopulation: (
    projectId: string,
    populationType: MgaPopulationType,
    payload: Omit<CreateMgaPopulationPayload, 'population_type'>,
  ) => Promise<void>;
  removePopulation: (projectId: string, populationId: string) => Promise<void>;
  addAlternative: (projectId: string, payload: CreateMgaAlternativePayload) => Promise<void>;
  editAlternative: (
    projectId: string,
    alternativeId: string,
    payload: UpdateMgaAlternativePayload,
  ) => Promise<void>;
  removeAlternative: (projectId: string, alternativeId: string) => Promise<void>;
  createIndicator: (projectId: string, payload: CreateMgaIndicatorPayload) => Promise<void>;
  deleteIndicator: (projectId: string, indicatorId: string) => Promise<void>;
  clearError: () => void;
};

const EMPTY_FORMULATION: ProjectMgaFormulation = {
  causeRelations: [],
  generalIndicators: [],
  effects: [],
  participants: [],
  populations: [],
  alternatives: [],
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

function formulationFromApi(data: FullMgaFormulation): ProjectMgaFormulation {
  return {
    causeRelations: (data.causes ?? []).map(mapCauseToRelation),
    generalIndicators: (data.indicators ?? []).map(mapIndicatorToUi),
    effects: data.effects ?? [],
    participants: data.participants ?? [],
    populations: data.populations ?? [],
    alternatives: data.alternatives ?? [],
  };
}

function patchFormulation(
  state: ProjectMgaState,
  projectId: string,
  patch: Partial<ProjectMgaFormulation>,
): Record<string, ProjectMgaFormulation> {
  const current = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
  return {
    ...state.byProjectId,
    [projectId]: { ...current, ...patch },
  };
}

export const useProjectMgaStore = create<ProjectMgaState>((set, get) => ({
  byProjectId: {},
  isLoading: false,
  isSaving: false,
  error: null,

  clearError: () => set({ error: null }),

  getFormulation: (projectId) => get().byProjectId[projectId] ?? EMPTY_FORMULATION,

  fetchFormulation: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      const data = await fetchMgaFormulation(projectId);
      const formulation = formulationFromApi(data);
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
      for (const [index, rel] of defaults.entries()) {
        await createMgaCause(projectId, {
          cause_type: causeTypeToApi(rel.causeType),
          description: rel.causeDescription,
          sort_order: index,
          specific_objective: rel.specificObjective,
        });
      }
      await createMgaIndicator(projectId, {
        name: 'Mejoramiento vías urbanas',
        unit: 'Metros lineales',
        target: 301,
        source_type: 'Informe',
        verification_source: 'Informe - Secretaría de Infraestructura Municipal',
      });
      await get().fetchFormulation(projectId);
      set({ isSaving: false });
    } catch (err) {
      const message = extractError(err, 'No se pudo inicializar la formulación MGA');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  updateSpecificObjective: async (projectId, relationId, description) => {
    const relation = get().getFormulation(projectId).causeRelations.find((r) => r.id === relationId);
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
          byProjectId: patchFormulation(state, projectId, {
            causeRelations: formulation.causeRelations.map((rel) =>
              rel.id === relationId
                ? { ...rel, specificObjective: updated.description, objectiveId: updated.id }
                : rel,
            ),
          }),
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
    const relation = get().getFormulation(projectId).causeRelations.find((r) => r.id === relationId);
    if (!relation) throw new Error('Causa no encontrada');

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
            byProjectId: patchFormulation(state, projectId, {
              causeRelations: formulation.causeRelations.map((rel) =>
                rel.id === relationId ? mapCauseToRelation(updatedCause) : rel,
              ),
            }),
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

  addCause: async (projectId, payload) => {
    set({ isSaving: true, error: null });
    try {
      const created = await createMgaCause(projectId, payload);
      set((state) => {
        const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        return {
          byProjectId: patchFormulation(state, projectId, {
            causeRelations: [...formulation.causeRelations, mapCauseToRelation(created)],
          }),
          isSaving: false,
        };
      });
    } catch (err) {
      const message = extractError(err, 'No se pudo crear la causa');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  removeCause: async (projectId, causeId) => {
    set({ isSaving: true, error: null });
    try {
      await deleteMgaCause(projectId, causeId);
      set((state) => {
        const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        return {
          byProjectId: patchFormulation(state, projectId, {
            causeRelations: formulation.causeRelations.filter((c) => c.id !== causeId),
          }),
          isSaving: false,
        };
      });
    } catch (err) {
      const message = extractError(err, 'No se pudo eliminar la causa');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  addEffect: async (projectId, payload) => {
    set({ isSaving: true, error: null });
    try {
      const created = await createMgaEffect(projectId, payload);
      set((state) => {
        const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        return {
          byProjectId: patchFormulation(state, projectId, {
            effects: [...formulation.effects, created],
          }),
          isSaving: false,
        };
      });
    } catch (err) {
      const message = extractError(err, 'No se pudo crear el efecto');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  editEffect: async (projectId, effectId, payload) => {
    set({ isSaving: true, error: null });
    try {
      const updated = await updateMgaEffect(projectId, effectId, payload);
      set((state) => {
        const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        return {
          byProjectId: patchFormulation(state, projectId, {
            effects: formulation.effects.map((e) => (e.id === effectId ? updated : e)),
          }),
          isSaving: false,
        };
      });
    } catch (err) {
      const message = extractError(err, 'No se pudo actualizar el efecto');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  removeEffect: async (projectId, effectId) => {
    set({ isSaving: true, error: null });
    try {
      await deleteMgaEffect(projectId, effectId);
      set((state) => {
        const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        return {
          byProjectId: patchFormulation(state, projectId, {
            effects: formulation.effects.filter((e) => e.id !== effectId),
          }),
          isSaving: false,
        };
      });
    } catch (err) {
      const message = extractError(err, 'No se pudo eliminar el efecto');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  addParticipant: async (projectId, payload) => {
    set({ isSaving: true, error: null });
    try {
      const created = await createMgaParticipant(projectId, payload);
      set((state) => {
        const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        return {
          byProjectId: patchFormulation(state, projectId, {
            participants: [...formulation.participants, created],
          }),
          isSaving: false,
        };
      });
    } catch (err) {
      const message = extractError(err, 'No se pudo crear el participante');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  editParticipant: async (projectId, participantId, payload) => {
    set({ isSaving: true, error: null });
    try {
      const updated = await updateMgaParticipant(projectId, participantId, payload);
      set((state) => {
        const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        return {
          byProjectId: patchFormulation(state, projectId, {
            participants: formulation.participants.map((p) =>
              p.id === participantId ? updated : p,
            ),
          }),
          isSaving: false,
        };
      });
    } catch (err) {
      const message = extractError(err, 'No se pudo actualizar el participante');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  removeParticipant: async (projectId, participantId) => {
    set({ isSaving: true, error: null });
    try {
      await deleteMgaParticipant(projectId, participantId);
      set((state) => {
        const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        return {
          byProjectId: patchFormulation(state, projectId, {
            participants: formulation.participants.filter((p) => p.id !== participantId),
          }),
          isSaving: false,
        };
      });
    } catch (err) {
      const message = extractError(err, 'No se pudo eliminar el participante');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  savePopulation: async (projectId, populationType, payload) => {
    set({ isSaving: true, error: null });
    try {
      const formulation = get().getFormulation(projectId);
      const existing = formulation.populations.find((p) => p.population_type === populationType);

      let saved: MgaPopulation;
      if (existing) {
        saved = await updateMgaPopulation(projectId, existing.id, {
          total_number: payload.total_number,
          source: payload.source,
          locations: payload.locations,
        });
      } else {
        saved = await createMgaPopulation(projectId, {
          population_type: populationType,
          ...payload,
        });
      }

      set((state) => {
        const current = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        const others = current.populations.filter((p) => p.population_type !== populationType);
        return {
          byProjectId: patchFormulation(state, projectId, {
            populations: [...others, saved],
          }),
          isSaving: false,
        };
      });
    } catch (err) {
      const message = extractError(err, 'No se pudo guardar la población');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  removePopulation: async (projectId, populationId) => {
    set({ isSaving: true, error: null });
    try {
      await deleteMgaPopulation(projectId, populationId);
      set((state) => {
        const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        return {
          byProjectId: patchFormulation(state, projectId, {
            populations: formulation.populations.filter((p) => p.id !== populationId),
          }),
          isSaving: false,
        };
      });
    } catch (err) {
      const message = extractError(err, 'No se pudo eliminar el registro de población');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  addAlternative: async (projectId, payload) => {
    set({ isSaving: true, error: null });
    try {
      const created = await createMgaAlternative(projectId, payload);
      set((state) => {
        const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        return {
          byProjectId: patchFormulation(state, projectId, {
            alternatives: [...formulation.alternatives, created],
          }),
          isSaving: false,
        };
      });
    } catch (err) {
      const message = extractError(err, 'No se pudo crear la alternativa');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  editAlternative: async (projectId, alternativeId, payload) => {
    set({ isSaving: true, error: null });
    try {
      const updated = await updateMgaAlternative(projectId, alternativeId, payload);
      set((state) => {
        const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        return {
          byProjectId: patchFormulation(state, projectId, {
            alternatives: formulation.alternatives.map((a) =>
              a.id === alternativeId ? updated : a,
            ),
          }),
          isSaving: false,
        };
      });
    } catch (err) {
      const message = extractError(err, 'No se pudo actualizar la alternativa');
      set({ isSaving: false, error: message });
      throw new Error(message);
    }
  },

  removeAlternative: async (projectId, alternativeId) => {
    set({ isSaving: true, error: null });
    try {
      await deleteMgaAlternative(projectId, alternativeId);
      set((state) => {
        const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        return {
          byProjectId: patchFormulation(state, projectId, {
            alternatives: formulation.alternatives.filter((a) => a.id !== alternativeId),
          }),
          isSaving: false,
        };
      });
    } catch (err) {
      const message = extractError(err, 'No se pudo eliminar la alternativa');
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
          byProjectId: patchFormulation(state, projectId, {
            generalIndicators: [...formulation.generalIndicators, mapIndicatorToUi(created)],
          }),
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
          byProjectId: patchFormulation(state, projectId, {
            generalIndicators: formulation.generalIndicators.filter((i) => i.id !== indicatorId),
          }),
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

export function parseTarget(value: string): number {
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export type PopulationLocationsData = {
  municipalities?: string[];
  departments?: string[];
  demographicNotes?: string;
  localization?: string;
};

export function parsePopulationLocations(raw: unknown): PopulationLocationsData {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return parsePopulationLocations(JSON.parse(raw));
    } catch {
      return { localization: raw };
    }
  }
  if (typeof raw === 'object') return raw as PopulationLocationsData;
  return {};
}
