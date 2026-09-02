import {
  COPILOT_CATALOG_ROUTES,
  type ActionCardPayload,
  type CreationContext,
} from '../store/auroraCopilotStore';
import { useCatalogStore } from '../store/catalogStore';
import { useProjectStore } from '../store/projectStore';
import { useProjectMgaStore } from '../store/projectMgaStore';

export type DispatchActionOptions = {
  navigate?: (path: string) => void;
  pathname?: string;
  variant?: 'floating' | 'embedded';
  onCloseAssistant?: () => void;
  creationContext?: CreationContext | null;
};

function payloadString(payload: Record<string, unknown> | undefined, key: string): string {
  const raw = payload?.[key];
  return typeof raw === 'string' ? raw.trim() : '';
}

function payloadStringSlice(payload: Record<string, unknown> | undefined, key: string): string[] {
  const raw = payload?.[key];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function resolveCardType(card: ActionCardPayload): string {
  if (card.type) return card.type;
  if (card.catalog && card.code) return 'catalog_search';
  return '';
}

export async function dispatchActionCard(
  card: ActionCardPayload,
  projectId: string,
  options: DispatchActionOptions = {},
): Promise<void> {
  const type = resolveCardType(card);

  switch (type) {
    case 'mga_generate_project':
      await dispatchMgaGenerateProject(card, options);
      return;

    case 'mga_apply':
      await dispatchMgaApply(card, projectId);
      return;

    case 'catalog_search':
      dispatchCatalogSearch(card, options);
      return;

    case 'navigate':
      dispatchNavigate(card, options);
      return;

    default:
      throw new Error('Tipo de tarjeta de acción no soportado');
  }
}

async function dispatchMgaGenerateProject(
  card: ActionCardPayload,
  options: DispatchActionOptions,
): Promise<void> {
  const payload = card.payload;
  if (!payload) {
    throw new Error('La tarjeta de generación no incluye datos del proyecto');
  }

  const name = payloadString(payload, 'name');
  const problemDescription = payloadString(payload, 'problem_description');
  const generalObjective = payloadString(payload, 'general_objective');
  const causes = payloadStringSlice(payload, 'causes');
  const effects = payloadStringSlice(payload, 'effects');

  if (!name || !problemDescription || !generalObjective) {
    throw new Error('Faltan campos obligatorios en la propuesta de proyecto');
  }
  if (causes.length < 2 || effects.length < 2) {
    throw new Error('Se requieren al menos 2 causas y 2 efectos directos');
  }

  const ctx = options.creationContext;
  const sector =
    payloadString(payload, 'sector') ||
    ctx?.sectorName?.trim() ||
    ctx?.sectorCode?.trim() ||
    'Sin sector';

  const projectStore = useProjectStore.getState();
  const mgaStore = useProjectMgaStore.getState();

  const project = await projectStore.createProject({
    name,
    sector,
    description: problemDescription,
    ...(ctx?.sectorId ? { sector_id: ctx.sectorId } : {}),
    ...(ctx?.programCodes?.[0] ? { program_code: ctx.programCodes[0] } : {}),
    ...(payloadString(payload, 'product_code') || ctx?.productCodes?.[0]
      ? { product_code: payloadString(payload, 'product_code') || ctx?.productCodes?.[0] }
      : {}),
  });

  await projectStore.updateProjectDetails(project.id, {
    problem_description: problemDescription,
    general_objective: generalObjective,
    situacion_existente: '',
    magnitud_problema: '',
  });

  for (let i = 0; i < causes.length; i++) {
    await mgaStore.addCause(project.id, {
      cause_type: 'directa',
      description: causes[i],
      sort_order: i,
      specific_objective: 'Redacte el objetivo específico asociado.',
    });
  }

  for (let i = 0; i < effects.length; i++) {
    await mgaStore.addEffect(project.id, {
      effect_type: 'directo',
      description: effects[i],
      sort_order: i,
    });
  }

  if (!options.navigate) {
    throw new Error('No hay navegador disponible para abrir el proyecto creado');
  }

  options.navigate(`/tenant/projects/${project.id}/formulation`);
}

async function dispatchMgaApply(card: ActionCardPayload, projectId: string): Promise<void> {
  const field = payloadString(card.payload, 'field');
  const value = payloadString(card.payload, 'value');
  if (!field || !value) {
    throw new Error('La tarjeta MGA no incluye campo o valor sugerido');
  }

  const projectStore = useProjectStore.getState();
  const mgaStore = useProjectMgaStore.getState();
  const project = projectStore.currentProject;

  if (!project || project.id !== projectId) {
    throw new Error('No se encontró el proyecto activo para aplicar la sugerencia');
  }

  switch (field) {
    case 'general_objective': {
      projectStore.patchCurrentProject({ general_objective: value });
      await projectStore.updateProjectDetails(projectId, {
        problem_description: project.problem_description ?? '',
        general_objective: value,
        situacion_existente: project.situacion_existente ?? '',
        magnitud_problema: project.magnitud_problema ?? '',
      });
      return;
    }
    case 'problem_description': {
      projectStore.patchCurrentProject({ problem_description: value });
      await projectStore.updateProjectDetails(projectId, {
        problem_description: value,
        general_objective: project.general_objective ?? '',
        situacion_existente: project.situacion_existente ?? '',
        magnitud_problema: project.magnitud_problema ?? '',
      });
      return;
    }
    case 'situacion_existente': {
      projectStore.patchCurrentProject({ situacion_existente: value });
      await projectStore.updateProjectDetails(projectId, {
        problem_description: project.problem_description ?? '',
        general_objective: project.general_objective ?? '',
        situacion_existente: value,
        magnitud_problema: project.magnitud_problema ?? '',
      });
      return;
    }
    case 'magnitud_problema': {
      projectStore.patchCurrentProject({ magnitud_problema: value });
      await projectStore.updateProjectDetails(projectId, {
        problem_description: project.problem_description ?? '',
        general_objective: project.general_objective ?? '',
        situacion_existente: project.situacion_existente ?? '',
        magnitud_problema: value,
      });
      return;
    }
    case 'specific_objective': {
      const relationId = payloadString(card.payload, 'relation_id');
      if (!relationId) {
        throw new Error('Falta relation_id para aplicar el objetivo específico');
      }
      await mgaStore.updateSpecificObjective(projectId, relationId, value);
      return;
    }
    case 'effect_description': {
      const effectId = payloadString(card.payload, 'effect_id');
      if (!effectId) {
        throw new Error('Falta effect_id para aplicar la descripción del efecto');
      }
      await mgaStore.editEffect(projectId, effectId, { description: value });
      return;
    }
    case 'add_cause': {
      const causeType = payloadString(card.payload, 'cause_type') as 'directa' | 'indirecta';
      if (causeType !== 'directa' && causeType !== 'indirecta') {
        throw new Error('cause_type inválido en la tarjeta de acción');
      }
      const parentId = payloadString(card.payload, 'parent_id');
      const formulation = mgaStore.getFormulation(projectId);
      await mgaStore.addCause(projectId, {
        cause_type: causeType,
        description: value,
        sort_order: formulation.causeRelations.length,
        ...(parentId ? { parent_id: parentId } : {}),
        specific_objective: 'Redacte el objetivo específico asociado.',
      });
      return;
    }
    case 'add_effect': {
      const effectType = payloadString(card.payload, 'effect_type') as 'directo' | 'indirecto';
      if (effectType !== 'directo' && effectType !== 'indirecto') {
        throw new Error('effect_type inválido en la tarjeta de acción');
      }
      const parentId = payloadString(card.payload, 'parent_id');
      const formulation = mgaStore.getFormulation(projectId);
      await mgaStore.addEffect(projectId, {
        effect_type: effectType,
        description: value,
        sort_order: formulation.effects.length,
        ...(parentId ? { parent_id: parentId } : {}),
      });
      return;
    }
    default:
      throw new Error(`Campo MGA no soportado: ${field}`);
  }
}

function dispatchCatalogSearch(card: ActionCardPayload, options: DispatchActionOptions): void {
  if (!card.catalog) {
    throw new Error('La tarjeta de catálogo no incluye catálogo');
  }
  const query = card.code?.trim() || card.label?.trim();

  if (!query) {
    throw new Error('La tarjeta de catálogo no incluye código ni etiqueta de búsqueda');
  }

  const { navigate, pathname = '', variant, onCloseAssistant } = options;

  if (navigate) {
    if (pathname.startsWith('/tenant')) {
      navigate('/tenant/catalog');
    } else {
      const route = COPILOT_CATALOG_ROUTES[card.catalog];
      if (route && pathname !== route) {
        navigate(route);
      }
    }
  }

  useCatalogStore.getState().applyCopilotSearch(card.catalog, query);

  if (variant === 'floating' && onCloseAssistant) {
    onCloseAssistant();
  }
}

function dispatchNavigate(card: ActionCardPayload, options: DispatchActionOptions): void {
  const path = payloadString(card.payload, 'path');
  if (!path) {
    throw new Error('La tarjeta de navegación no incluye ruta');
  }
  if (!options.navigate) {
    throw new Error('No hay navegador disponible para esta acción');
  }
  options.navigate(path);
  if (options.variant === 'floating' && options.onCloseAssistant) {
    options.onCloseAssistant();
  }
}
