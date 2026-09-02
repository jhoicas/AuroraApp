export const MGA_CAUSES_EFFECTS_ROUTE = 'mga:identificacion:causas-efectos';

export type MgaProjectContext = {
  problem_description?: string;
  situacion_existente?: string;
  magnitud_problema?: string;
};

export type MgaCausesEffectsFocus = 'effects' | 'causes' | 'both';

export function buildMgaCausesEffectsPrompt(
  focus: MgaCausesEffectsFocus,
  projectName: string,
  parentId?: string,
): string {
  const focusLine =
    focus === 'effects'
      ? 'Prioriza sugerir efectos (directos e indirectos) verificables en el Knowledge Graph.'
      : focus === 'causes'
        ? 'Prioriza sugerir causas (directas e indirectas) verificables en el Knowledge Graph.'
        : 'Sugiere causas y efectos verificables en el Knowledge Graph para el árbol de problemas.';

  const lines = [
    `Proyecto: "${projectName}".`,
    focusLine,
    'Usa únicamente nodos del Knowledge Graph provisto. Incluye action cards mga_apply para aplicar cada sugerencia.',
  ];

  if (parentId) {
    lines.push(`Sugiere nodos indirectos hijos del nodo padre con ID ${parentId}.`);
  }

  return lines.join(' ');
}
