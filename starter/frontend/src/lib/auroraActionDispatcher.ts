import {
  COPILOT_CATALOG_ROUTES,
  type ActionCardPayload,
} from '../store/auroraCopilotStore';
import { useCatalogStore } from '../store/catalogStore';
import { useProjectStore } from '../store/projectStore';
import { useProjectMgaStore } from '../store/projectMgaStore';

export type DispatchActionOptions = {
  navigate?: (path: string) => void;
  pathname?: string;
  variant?: 'floating' | 'embedded';
  onCloseAssistant?: () => void;
};

function payloadString(payload: Record<string, unknown> | undefined, key: string): string {
  const raw = payload?.[key];
  return typeof raw === 'string' ? raw.trim() : '';
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
