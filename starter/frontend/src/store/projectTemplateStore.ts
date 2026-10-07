import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api';
import { cloneFormulation } from '../lib/projectTemplates';
import {
  MGA_SEED_TEMPLATE,
  type ProjectTemplate,
  type TemplateFormulation,
} from '../data/mgaSeedTemplate';
import type { Project } from './projectStore';

/** Claves de `mga_formulation_data` que son del proyecto concreto y no se heredan en una plantilla. */
const PROJECT_SPECIFIC_KEYS = ['base_location', 'baseLocation', 'documentosSoporte', 'estadoProyecto'] as const;

type ProjectTemplateState = {
  /** Plantillas personalizadas (la del sistema vive en código y nunca se persiste ni se borra). */
  customTemplates: ProjectTemplate[];
  saveProjectAsTemplate: (projectId: string, tenantId: string | null, name?: string) => Promise<ProjectTemplate>;
  deleteProjectTemplate: (templateId: string) => void;
};

export function isSystemTemplate(template: Pick<ProjectTemplate, 'isSystem'>): boolean {
  return template.isSystem;
}

export const useProjectTemplateStore = create<ProjectTemplateState>()(
  persist(
    (set, get) => ({
      customTemplates: [],

      saveProjectAsTemplate: async (projectId, tenantId, name) => {
        const { data: project } = await api.get<Project>(`/projects/${projectId}`);
        const raw: Record<string, unknown> = { ...(project.mga_formulation_data ?? {}) };
        for (const key of PROJECT_SPECIFIC_KEYS) delete raw[key];

        const template: ProjectTemplate = {
          id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          name: (name ?? project.name).trim() || 'Plantilla sin nombre',
          description: project.description ?? '',
          sector: project.sector ?? '',
          isSystem: false,
          tenantId,
          objeto: project.description ?? '',
          problem_description: project.problem_description ?? '',
          general_objective: project.general_objective ?? '',
          situacion_existente: project.situacion_existente ?? project.situation ?? '',
          magnitud_problema: project.magnitud_problema ?? project.magnitude ?? '',
          formulation: cloneFormulation(raw) as unknown as TemplateFormulation,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ customTemplates: [template, ...state.customTemplates] }));
        return template;
      },

      deleteProjectTemplate: (templateId) => {
        if (templateId === MGA_SEED_TEMPLATE.id) {
          throw new Error('La plantilla del sistema no se puede eliminar.');
        }
        const target = get().customTemplates.find((t) => t.id === templateId);
        if (!target || target.isSystem) {
          throw new Error('La plantilla no existe o está protegida.');
        }
        set((state) => ({
          customTemplates: state.customTemplates.filter((t) => t.id !== templateId),
        }));
      },
    }),
    {
      name: 'aurora-project-templates',
      version: 1,
      partialize: (state) => ({ customTemplates: state.customTemplates }),
    },
  ),
);

/** Plantilla del sistema + personalizadas visibles para el tenant dado. */
export function selectVisibleTemplates(
  customTemplates: ProjectTemplate[],
  tenantId: string | null,
): ProjectTemplate[] {
  return [
    MGA_SEED_TEMPLATE,
    ...customTemplates.filter((t) => !t.isSystem && (!t.tenantId || t.tenantId === tenantId)),
  ];
}
