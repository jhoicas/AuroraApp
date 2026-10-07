import type { ProjectTemplate, TemplateFormulation } from '../data/mgaSeedTemplate';

/** Campos de auditoría/propiedad que nunca deben viajar de una plantilla a un proyecto nuevo. */
const AUDIT_KEYS: ReadonlySet<string> = new Set([
  'tenant_id',
  'project_id',
  'creator_id',
  'created_at',
  'updated_at',
  'deleted_at',
  'fechaCarga',
  'code_bpin',
  'codeBpin',
]);

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function collectIds(node: unknown, ids: Map<string, string>): void {
  if (Array.isArray(node)) {
    node.forEach((item) => collectIds(item, ids));
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'id' && typeof value === 'string' && value && !ids.has(value)) {
        ids.set(value, newId());
      } else {
        collectIds(value, ids);
      }
    }
  }
}

function rewrite(node: unknown, ids: Map<string, string>): unknown {
  if (typeof node === 'string') return ids.get(node) ?? node;
  if (Array.isArray(node)) return node.map((item) => rewrite(item, ids));
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (AUDIT_KEYS.has(key)) continue;
      out[ids.get(key) ?? key] = rewrite(value, ids);
    }
    return out;
  }
  return node;
}

/**
 * Copia profunda de una formulación MGA: asigna IDs nuevos a todos los nodos con `id`, mantiene
 * consistentes las referencias cruzadas (claves de objetivos, parentId, referenciaId, etc.) y elimina
 * los campos de auditoría. El resultado no comparte referencias con el original.
 */
export function cloneFormulation<T>(source: T): T {
  const plain: unknown = JSON.parse(JSON.stringify(source));
  const ids = new Map<string, string>();
  collectIds(plain, ids);
  return rewrite(plain, ids) as T;
}

export type ClonedTemplateProject = {
  problem_description: string;
  general_objective: string;
  situacion_existente: string;
  magnitud_problema: string;
  mga_formulation_data: TemplateFormulation;
};

/** Datos listos para aplicar (PATCH) sobre un proyecto recién creado a partir de una plantilla. */
export function buildProjectFromTemplate(template: ProjectTemplate): ClonedTemplateProject {
  return {
    problem_description: template.problem_description,
    general_objective: template.general_objective,
    situacion_existente: template.situacion_existente,
    magnitud_problema: template.magnitud_problema,
    mga_formulation_data: cloneFormulation(template.formulation),
  };
}
