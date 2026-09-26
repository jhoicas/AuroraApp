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
import debounce from 'lodash.debounce';
import { useProjectStore, type Project } from './projectStore';
import type { ProjectEdtChainState } from './projectEdtStore';

export type CauseType = 'Causa directa' | 'Causa indirecta';
export type EffectType = 'Efecto directo' | 'Efecto indirecto';

export type CauseObjectiveRelation = {
  id: string;
  objectiveId?: string;
  parentId?: string | null;
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

export type PlanDesarrolloPndLink = {
  id: string;
  transformacion: string;
  pilar: string;
  catalizador: string;
  componente: string;
};

export type PlanDesarrolloData = {
  pndLinks: PlanDesarrolloPndLink[];
  departamental: {
    plan: string;
    estrategia: string;
    programa: string;
  };
  municipal: {
    plan: string;
    estrategia: string;
    programa: string;
  };
  etnico: {
    tipoComunidad: string;
    instrumentos: string;
  };
  otros: {
    plan: string;
    estrategia: string;
    programa: string;
  };
};

export type ProjectMgaLocalizationItem = {
  region_id: number | null;
  departamento_id: number | null;
  municipio_id: number | null;
  tipo_agrupacion_id?: number | null;
  agrupacion_id?: number | null;
};

export type ProjectMgaFormulation = {
  causeRelations: CauseObjectiveRelation[];
  generalIndicators: GeneralObjectiveIndicator[];
  effects: MgaEffect[];
  participants: MgaParticipant[];
  populations: MgaPopulation[];
  alternatives: MgaAlternative[];
  planDesarrollo?: PlanDesarrolloData;
  necesidades?: Record<string, any>;
  analisisTecnico?: Record<string, any>;
  localizacion?: Record<string, any>;
  localizaciones?: ProjectMgaLocalizationItem[];
  factores_analizados?: string[];
  localizaciones_factores?: string[];
  riesgos?: Record<string, any>;
  ingresosBeneficios?: Record<string, any>;
  prestamos?: Record<string, any>;
  depreciacion?: Record<string, any>;
  evaluacion?: Record<string, any>;
  programacion?: Record<string, any>;
  completedSections: Record<string, boolean>;
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
  addCause: (projectId: string, payload: CreateMgaCausePayload) => Promise<CauseObjectiveRelation>;
  removeCause: (projectId: string, causeId: string) => Promise<void>;
  addEffect: (projectId: string, payload: CreateMgaEffectPayload) => Promise<MgaEffect>;
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
  savePlanDesarrollo: (projectId: string, data: PlanDesarrolloData) => Promise<void>;
  saveProblematica: (projectId: string) => Promise<void>;
  saveParticipantes: (projectId: string) => Promise<void>;
  savePoblacion: (projectId: string) => Promise<void>;
  saveObjetivos: (projectId: string) => Promise<void>;
  saveCadenaDeValor: (projectId: string, data?: Record<string, any>) => Promise<void>;
  saveAlternativas: (projectId: string) => Promise<void>;
  saveNecesidades: (projectId: string, data: Record<string, any>) => Promise<void>;
  saveAnalisisTecnico: (projectId: string, data: Record<string, any>) => Promise<void>;
  saveLocalizacion: (projectId: string, data: Record<string, any>) => Promise<void>;
  saveRiesgos: (projectId: string, data: Record<string, any>) => Promise<void>;
  saveIngresosBeneficios: (projectId: string, data: Record<string, any>) => Promise<void>;
  savePrestamos: (projectId: string, data: Record<string, any>) => Promise<void>;
  saveDepreciacion: (projectId: string, data: Record<string, any>) => Promise<void>;
  saveEvaluacion: (projectId: string, data: Record<string, any>) => Promise<void>;
  saveProgramacion: (projectId: string, data: Record<string, any>) => Promise<void>;
  isSectionManaged: (projectId: string, sectionId: string) => boolean;
  clearError: () => void;
};

const EMPTY_FORMULATION: ProjectMgaFormulation = {
  causeRelations: [],
  generalIndicators: [],
  effects: [],
  participants: [],
  populations: [],
  alternatives: [],
  completedSections: {},
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
    parentId: cause.parent_id ?? null,
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
    // As we don't have this in API yet, it will be undefined initially
    planDesarrollo: undefined,
    necesidades: undefined,
    analisisTecnico: undefined,
    localizacion: undefined,
    riesgos: undefined,
    ingresosBeneficios: undefined,
    prestamos: undefined,
    depreciacion: undefined,
    evaluacion: undefined,
    programacion: undefined,
    completedSections: {},
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

export const debouncedPatchProject = debounce(async (projectId: string, patchData: Record<string, any>) => {
  try {
    await useProjectStore.getState().patchProject(projectId, { mga_formulation_data: patchData });
  } catch (err) {
    console.error('Auto-save error', err);
  }
}, 1000);

export const useProjectMgaStore = create<ProjectMgaState>((set, get) => ({
  byProjectId: {},
  isLoading: false,
  isSaving: false,
  error: null,

  clearError: () => set({ error: null }),

  isSectionManaged: (projectId, sectionId) => {
    const formulation = get().byProjectId[projectId] ?? EMPTY_FORMULATION;
    const store = useProjectStore.getState();
    const proj = (store.currentProject?.id === projectId ? store.currentProject : null) || store.projects.find((p) => p.id === projectId);
    return hasMgaSectionData(sectionId, proj, formulation);
  },

  savePlanDesarrollo: async (projectId, data) => {
    set({ isSaving: true, error: null });
    try {
      set((state) => {
        const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        const newCompleted = { ...formulation.completedSections, 'plan-desarrollo': true };
        debouncedPatchProject(projectId, { planDesarrollo: data, completedSections: newCompleted });
        return {
          byProjectId: {
            ...state.byProjectId,
            [projectId]: { 
              ...formulation, 
              planDesarrollo: data,
              completedSections: newCompleted
            },
          },
          isSaving: false,
        };
      });
    } catch (err) {
      set({ isLoading: false, error: 'Error guardando plan de desarrollo', isSaving: false });
      throw err;
    }
  },

  saveNecesidades: async (projectId, data) => {
    set({ isSaving: true, error: null });
    try {
      set((state) => {
        const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        const newCompleted = { ...formulation.completedSections, necesidades: true };
        debouncedPatchProject(projectId, { necesidades: data, completedSections: newCompleted });
        return {
          byProjectId: { ...state.byProjectId, [projectId]: { ...formulation, necesidades: data, completedSections: newCompleted } },
          isSaving: false,
        };
      });
    } catch (err) {
      set({ isLoading: false, error: 'Error guardando necesidades', isSaving: false });
      throw err;
    }
  },

  saveAnalisisTecnico: async (projectId, data) => {
    set({ isSaving: true, error: null });
    try {
      set((state) => {
        const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        const newCompleted = { ...formulation.completedSections, analisisTecnico: true };
        debouncedPatchProject(projectId, { analisisTecnico: data, completedSections: newCompleted });
        return {
          byProjectId: { ...state.byProjectId, [projectId]: { ...formulation, analisisTecnico: data, completedSections: newCompleted } },
          isSaving: false,
        };
      });
    } catch (err) {
      set({ isLoading: false, error: 'Error guardando analisis tecnico', isSaving: false });
      throw err;
    }
  },

  saveLocalizacion: async (projectId, data) => {
    set({ isSaving: true, error: null });
    try {
      set((state) => {
        const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        const newCompleted = { ...formulation.completedSections, localizacion: true };
        const localizacionesArray = data.localizaciones || (Array.isArray(data) ? data : formulation.localizaciones);
        const factoresArray = data.factores_analizados || data.factoresAnalizados || data.factores || formulation.factores_analizados;
        debouncedPatchProject(projectId, { 
          localizaciones: localizacionesArray, 
          localizacion: data, 
          factores_analizados: factoresArray,
          localizaciones_factores: factoresArray,
          completedSections: newCompleted 
        });
        return {
          byProjectId: { 
            ...state.byProjectId, 
            [projectId]: { 
              ...formulation, 
              localizaciones: localizacionesArray,
              localizacion: data, 
              factores_analizados: factoresArray,
              localizaciones_factores: factoresArray,
              completedSections: newCompleted 
            } 
          },
          isSaving: false,
        };
      });
    } catch (err) {
      set({ isLoading: false, error: 'Error guardando localizacion', isSaving: false });
      throw err;
    }
  },

  saveRiesgos: async (projectId, data) => {
    set({ isSaving: true, error: null });
    try {
      set((state) => {
        const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        const newCompleted = { ...formulation.completedSections, riesgos: true };
        debouncedPatchProject(projectId, { riesgos: data, completedSections: newCompleted });
        return {
          byProjectId: { ...state.byProjectId, [projectId]: { ...formulation, riesgos: data, completedSections: newCompleted } },
          isSaving: false,
        };
      });
    } catch (err) {
      set({ isLoading: false, error: 'Error guardando riesgos', isSaving: false });
      throw err;
    }
  },

  saveIngresosBeneficios: async (projectId, data) => {
    set({ isSaving: true, error: null });
    try {
      set((state) => {
        const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        const newCompleted = { ...formulation.completedSections, ingresosBeneficios: true };
        debouncedPatchProject(projectId, { ingresosBeneficios: data, completedSections: newCompleted });
        return {
          byProjectId: { ...state.byProjectId, [projectId]: { ...formulation, ingresosBeneficios: data, completedSections: newCompleted } },
          isSaving: false,
        };
      });
    } catch (err) {
      set({ isLoading: false, error: 'Error guardando ingresos y beneficios', isSaving: false });
      throw err;
    }
  },

  savePrestamos: async (projectId, data) => {
    set({ isSaving: true, error: null });
    try {
      set((state) => {
        const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        const newCompleted = { ...formulation.completedSections, prestamos: true };
        debouncedPatchProject(projectId, { prestamos: data, completedSections: newCompleted });
        return {
          byProjectId: { ...state.byProjectId, [projectId]: { ...formulation, prestamos: data, completedSections: newCompleted } },
          isSaving: false,
        };
      });
    } catch (err) {
      set({ isLoading: false, error: 'Error guardando prestamos', isSaving: false });
      throw err;
    }
  },

  saveDepreciacion: async (projectId, data) => {
    set({ isSaving: true, error: null });
    try {
      set((state) => {
        const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        const newCompleted = { ...formulation.completedSections, depreciacion: true };
        debouncedPatchProject(projectId, { depreciacion: data, completedSections: newCompleted });
        return {
          byProjectId: { ...state.byProjectId, [projectId]: { ...formulation, depreciacion: data, completedSections: newCompleted } },
          isSaving: false,
        };
      });
    } catch (err) {
      set({ isLoading: false, error: 'Error guardando depreciacion', isSaving: false });
      throw err;
    }
  },

  saveEvaluacion: async (projectId, data) => {
    set({ isSaving: true, error: null });
    try {
      set((state) => {
        const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        const newCompleted = { ...formulation.completedSections, evaluacion: true };
        debouncedPatchProject(projectId, { evaluacion: data, completedSections: newCompleted });
        return {
          byProjectId: { ...state.byProjectId, [projectId]: { ...formulation, evaluacion: data, completedSections: newCompleted } },
          isSaving: false,
        };
      });
    } catch (err) {
      set({ isLoading: false, error: 'Error guardando evaluacion', isSaving: false });
      throw err;
    }
  },

  saveProgramacion: async (projectId, data) => {
    set({ isSaving: true, error: null });
    try {
      set((state) => {
        const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        const newCompleted = { ...formulation.completedSections, programacion: true };
        debouncedPatchProject(projectId, { programacion: data, completedSections: newCompleted });
        return {
          byProjectId: { ...state.byProjectId, [projectId]: { ...formulation, programacion: data, completedSections: newCompleted } },
          isSaving: false,
        };
      });
    } catch (err) {
      set({ isLoading: false, error: 'Error guardando programacion', isSaving: false });
      throw err;
    }
  },

  saveProblematica: async (projectId) => {
    set({ isSaving: true, error: null });
    set((state) => {
      const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
      const newCompleted = { ...formulation.completedSections, problematica: true };
      debouncedPatchProject(projectId, { completedSections: newCompleted });
      return { byProjectId: { ...state.byProjectId, [projectId]: { ...formulation, completedSections: newCompleted } }, isSaving: false };
    });
  },

  saveParticipantes: async (projectId) => {
    set({ isSaving: true, error: null });
    set((state) => {
      const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
      const newCompleted = { ...formulation.completedSections, participantes: true };
      debouncedPatchProject(projectId, { completedSections: newCompleted });
      return { byProjectId: { ...state.byProjectId, [projectId]: { ...formulation, completedSections: newCompleted } }, isSaving: false };
    });
  },

  savePoblacion: async (projectId) => {
    set({ isSaving: true, error: null });
    set((state) => {
      const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
      const newCompleted = { ...formulation.completedSections, poblacion: true };
      debouncedPatchProject(projectId, { completedSections: newCompleted });
      return { byProjectId: { ...state.byProjectId, [projectId]: { ...formulation, completedSections: newCompleted } }, isSaving: false };
    });
  },

  saveObjetivos: async (projectId) => {
    set({ isSaving: true, error: null });
    set((state) => {
      const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
      const newCompleted = { ...formulation.completedSections, objetivos: true };
      debouncedPatchProject(projectId, { completedSections: newCompleted });
      return { byProjectId: { ...state.byProjectId, [projectId]: { ...formulation, completedSections: newCompleted } }, isSaving: false };
    });
  },

  saveCadenaDeValor: async (projectId, data) => {
    set({ isSaving: true, error: null });
    set((state) => {
      const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
      const newCompleted = { ...formulation.completedSections, 'cadena-valor': true };
      const patchData: Record<string, any> = { completedSections: newCompleted };
      if (data) {
        patchData.cadena_valor = data;
        patchData.cadenaValor = data;
      }
      debouncedPatchProject(projectId, patchData);
      return {
        byProjectId: {
          ...state.byProjectId,
          [projectId]: {
            ...formulation,
            completedSections: newCompleted,
            ...(data ? { cadenaValor: data, cadena_valor: data } : {}),
          },
        },
        isSaving: false,
      };
    });
  },

  saveAlternativas: async (projectId) => {
    set({ isSaving: true, error: null });
    set((state) => {
      const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
      const newCompleted = { ...formulation.completedSections, alternativas: true };
      debouncedPatchProject(projectId, { completedSections: newCompleted });
      return { byProjectId: { ...state.byProjectId, [projectId]: { ...formulation, completedSections: newCompleted } }, isSaving: false };
    });
  },

  getFormulation: (projectId) => get().byProjectId[projectId] ?? EMPTY_FORMULATION,

  fetchFormulation: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      const data = await fetchMgaFormulation(projectId);
      const formulation = formulationFromApi(data);
      
      const store = useProjectStore.getState();
      const project = (store.currentProject?.id === projectId ? store.currentProject : null) || store.projects.find((p) => p.id === projectId);
      if (project?.mga_formulation_data) {
        const pData = project.mga_formulation_data;
        if (pData.planDesarrollo) formulation.planDesarrollo = pData.planDesarrollo as PlanDesarrolloData;
        if (pData.necesidades) formulation.necesidades = pData.necesidades;
        if (pData.analisisTecnico) formulation.analisisTecnico = pData.analisisTecnico;
        if (pData.localizacion) formulation.localizacion = pData.localizacion;
        if (pData.localizaciones) formulation.localizaciones = pData.localizaciones;
        else if (pData.localizacion?.localizaciones) formulation.localizaciones = pData.localizacion.localizaciones;
        if (pData.factores_analizados) {
          formulation.factores_analizados = pData.factores_analizados;
          formulation.localizaciones_factores = pData.factores_analizados;
        } else if (pData.localizaciones_factores) {
          formulation.factores_analizados = pData.localizaciones_factores;
          formulation.localizaciones_factores = pData.localizaciones_factores;
        } else if (pData.localizacion?.factores_analizados) {
          formulation.factores_analizados = pData.localizacion.factores_analizados;
          formulation.localizaciones_factores = pData.localizacion.factores_analizados;
        }
        if (pData.riesgos) formulation.riesgos = pData.riesgos;
        if (pData.ingresosBeneficios) formulation.ingresosBeneficios = pData.ingresosBeneficios;
        if (pData.prestamos) formulation.prestamos = pData.prestamos;
        if (pData.depreciacion) formulation.depreciacion = pData.depreciacion;
        if (pData.evaluacion) formulation.evaluacion = pData.evaluacion;
        if (pData.programacion) formulation.programacion = pData.programacion;
        if (pData.completedSections) formulation.completedSections = pData.completedSections;
      }

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
      const relation = mapCauseToRelation(created);
      set((state) => {
        const formulation = state.byProjectId[projectId] ?? EMPTY_FORMULATION;
        return {
          byProjectId: patchFormulation(state, projectId, {
            causeRelations: [...formulation.causeRelations, relation],
          }),
          isSaving: false,
        };
      });
      return relation;
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
      return created;
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

function hasText(val: unknown): boolean {
  return typeof val === 'string' && val.trim().length > 0;
}

/**
 * Evalúa si una sección del MGA cuenta con datos registrados o gestionados
 * en el proyecto, la formulación actual o la cadena de valor (EDT).
 */
export function hasMgaSectionData(
  sectionId: string,
  project?: Project | null,
  formulation?: ProjectMgaFormulation | null,
  edtChain?: ProjectEdtChainState | null,
): boolean {
  if (!project) return false;
  const pData = project.mga_formulation_data || {};
  const form = formulation;

  const normalizedId =
    sectionId === 'problematica' ? 'identificacion' :
    sectionId === 'analisisTecnico' ? 'analisis-tecnico' :
    sectionId === 'ingresosBeneficios' ? 'ingresos-beneficios' :
    sectionId;

  switch (normalizedId) {
    case 'plan-desarrollo': {
      const pd = form?.planDesarrollo || pData.planDesarrollo;
      if (!pd) {
        return Boolean(form?.completedSections?.['plan-desarrollo'] || pData.completedSections?.['plan-desarrollo']);
      }
      const hasLinks = Array.isArray(pd.pndLinks) && pd.pndLinks.length > 0;
      const hasDep = Boolean(hasText(pd.departamental?.plan) || hasText(pd.departamental?.estrategia) || hasText(pd.departamental?.programa));
      const hasMun = Boolean(hasText(pd.municipal?.plan) || hasText(pd.municipal?.estrategia) || hasText(pd.municipal?.programa));
      const hasEtnico = Boolean(hasText(pd.etnico?.tipoComunidad) || hasText(pd.etnico?.instrumentos));
      const hasOtros = Boolean(hasText(pd.otros?.plan) || hasText(pd.otros?.estrategia) || hasText(pd.otros?.programa));
      return hasLinks || hasDep || hasMun || hasEtnico || hasOtros || Boolean(form?.completedSections?.['plan-desarrollo'] || pData.completedSections?.['plan-desarrollo']);
    }

    case 'identificacion': {
      const problemDesc = hasText(project.problem_description) || hasText(pData.problem_description);
      const generalObj = hasText(project.general_objective) || hasText(pData.general_objective);
      const causesCount = form?.causeRelations?.length || 0;
      const effectsCount = form?.effects?.length || 0;
      const hasCompleted = Boolean(
        form?.completedSections?.['problematica'] ||
        form?.completedSections?.['identificacion'] ||
        pData.completedSections?.['problematica'] ||
        pData.completedSections?.['identificacion']
      );
      return Boolean(problemDesc || generalObj || causesCount > 0 || effectsCount > 0 || hasCompleted);
    }

    case 'participantes': {
      const partCount = form?.participants?.length || 0;
      const pDataPartCount = Array.isArray(pData.participants) ? pData.participants.length : 0;
      const hasAnalisis = hasText(pData.analisis_participantes);
      const hasCompleted = Boolean(form?.completedSections?.['participantes'] || pData.completedSections?.['participantes']);
      return partCount > 0 || pDataPartCount > 0 || hasAnalisis || hasCompleted;
    }

    case 'poblacion': {
      const popCount = form?.populations?.length || 0;
      const pDataPopCount = Array.isArray(pData.populations) ? pData.populations.length : 0;
      const hasActivePop = (form?.populations || []).some(
        (p) =>
          (typeof p.total_number === 'number' && p.total_number > 0) ||
          hasText(p.source) ||
          (typeof p.locations === 'string' ? hasText(p.locations) : Boolean(p.locations))
      );
      const hasPDataPop = Boolean(pData.poblacion && (typeof pData.poblacion === 'object' ? Object.keys(pData.poblacion).length > 0 : true));
      const hasCompleted = Boolean(form?.completedSections?.['poblacion'] || pData.completedSections?.['poblacion']);
      return popCount > 0 || pDataPopCount > 0 || hasActivePop || hasPDataPop || hasCompleted;
    }

    case 'objetivos': {
      const generalObj = hasText(project.general_objective) || hasText(pData.general_objective);
      const indicatorsCount = form?.generalIndicators?.length || 0;
      const pDataIndicatorsCount = Array.isArray(pData.generalIndicators) ? pData.generalIndicators.length : 0;
      const hasSpecificObjectives = (form?.causeRelations || []).some((c) => hasText(c.specificObjective));
      const hasCompleted = Boolean(form?.completedSections?.['objetivos'] || pData.completedSections?.['objetivos']);
      return Boolean(generalObj || indicatorsCount > 0 || pDataIndicatorsCount > 0 || hasSpecificObjectives || hasCompleted);
    }

    case 'alternativas': {
      const altCount = form?.alternatives?.length || 0;
      const pDataAltCount = Array.isArray(pData.alternatives) ? pData.alternatives.length : 0;
      const hasCompleted = Boolean(form?.completedSections?.['alternativas'] || pData.completedSections?.['alternativas']);
      return altCount > 0 || pDataAltCount > 0 || hasCompleted;
    }

    case 'necesidades': {
      const formItems = form?.necesidades?.items;
      const pDataItems = pData.necesidades?.items;
      const hasItems = (Array.isArray(formItems) && formItems.length > 0) || (Array.isArray(pDataItems) && pDataItems.length > 0);
      const hasCompleted = Boolean(form?.completedSections?.['necesidades'] || pData.completedSections?.['necesidades']);
      return hasItems || hasCompleted;
    }

    case 'analisis-tecnico': {
      const formItems = form?.analisisTecnico?.items;
      const pDataItems = pData.analisisTecnico?.items;
      const hasFormItems = Boolean(formItems && typeof formItems === 'object' && Object.values(formItems).some(hasText));
      const hasPDataItems = Boolean(pDataItems && typeof pDataItems === 'object' && Object.values(pDataItems).some(hasText));
      const hasCompleted = Boolean(
        form?.completedSections?.['analisisTecnico'] ||
        form?.completedSections?.['analisis-tecnico'] ||
        pData.completedSections?.['analisisTecnico'] ||
        pData.completedSections?.['analisis-tecnico']
      );
      return hasFormItems || hasPDataItems || hasCompleted;
    }

    case 'localizacion': {
      const locList = form?.localizaciones || pData.localizaciones || form?.localizacion?.localizaciones || pData.localizacion?.localizaciones;
      const hasLocList = Array.isArray(locList) && locList.length > 0;
      const hasBaseLocation = Boolean(
        (project as any).region_id ||
        (project as any).departamento_id ||
        (project as any).municipio_id ||
        pData.region_id ||
        pData.departamento_id ||
        pData.municipio_id
      );
      const hasFormLoc = Boolean(form?.localizacion && Object.keys(form.localizacion).length > 0);
      const hasPDataLoc = Boolean(pData.localizacion && Object.keys(pData.localizacion).length > 0);
      const hasCompleted = Boolean(form?.completedSections?.['localizacion'] || pData.completedSections?.['localizacion']);
      return Boolean(hasLocList || hasBaseLocation || hasFormLoc || hasPDataLoc || hasCompleted);
    }

    case 'cadena-valor': {
      const hasEdt = Boolean(
        edtChain &&
        ((edtChain.activities && edtChain.activities.length > 0) ||
         (edtChain.edtNodes && edtChain.edtNodes.length > 0) ||
         (edtChain.deliverables && edtChain.deliverables.length > 0) ||
         edtChain.catalogLink !== null)
      );
      const hasProductCode = Boolean(hasText(project.product_code) || hasText(pData.product_code));
      const hasCompleted = Boolean(form?.completedSections?.['cadena-valor'] || pData.completedSections?.['cadena-valor']);
      return hasEdt || hasProductCode || hasCompleted;
    }

    case 'riesgos': {
      const formItems = form?.riesgos?.items;
      const pDataItems = pData.riesgos?.items;
      const hasItems = (Array.isArray(formItems) && formItems.length > 0) || (Array.isArray(pDataItems) && pDataItems.length > 0);
      const hasCompleted = Boolean(form?.completedSections?.['riesgos'] || pData.completedSections?.['riesgos']);
      return hasItems || hasCompleted;
    }

    case 'ingresos-beneficios': {
      const formItems = form?.ingresosBeneficios?.items;
      const pDataItems = pData.ingresosBeneficios?.items;
      const hasItems = (Array.isArray(formItems) && formItems.length > 0) || (Array.isArray(pDataItems) && pDataItems.length > 0);
      const hasCompleted = Boolean(
        form?.completedSections?.['ingresosBeneficios'] ||
        form?.completedSections?.['ingresos-beneficios'] ||
        pData.completedSections?.['ingresosBeneficios'] ||
        pData.completedSections?.['ingresos-beneficios']
      );
      return hasItems || hasCompleted;
    }

    case 'prestamos': {
      const formItems = form?.prestamos?.items;
      const pDataItems = pData.prestamos?.items;
      const hasItems = (Array.isArray(formItems) && formItems.length > 0) || (Array.isArray(pDataItems) && pDataItems.length > 0);
      const hasCompleted = Boolean(form?.completedSections?.['prestamos'] || pData.completedSections?.['prestamos']);
      return hasItems || hasCompleted;
    }

    case 'depreciacion': {
      const formItems = form?.depreciacion?.items;
      const pDataItems = pData.depreciacion?.items;
      const hasItems = (Array.isArray(formItems) && formItems.length > 0) || (Array.isArray(pDataItems) && pDataItems.length > 0);
      const hasCompleted = Boolean(form?.completedSections?.['depreciacion'] || pData.completedSections?.['depreciacion']);
      return hasItems || hasCompleted;
    }

    case 'evaluacion': {
      const resumen = form?.evaluacion?.resumen || pData.evaluacion?.resumen;
      const hasResumen = hasText(resumen);
      const hasCompleted = Boolean(form?.completedSections?.['evaluacion'] || pData.completedSections?.['evaluacion']);
      return hasResumen || hasCompleted;
    }

    case 'programacion': {
      const prog = form?.programacion || pData.programacion;
      const hasFuentes = Array.isArray(prog?.fuentes) && prog.fuentes.length > 0;
      const hasIndicadores = Array.isArray(prog?.indicadores) && prog.indicadores.length > 0;
      const hasCompleted = Boolean(form?.completedSections?.['programacion'] || pData.completedSections?.['programacion']);
      return hasFuentes || hasIndicadores || hasCompleted;
    }

    default:
      return Boolean(form?.completedSections?.[normalizedId] || pData.completedSections?.[normalizedId]);
  }
}
