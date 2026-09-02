export const MGA_CAUSES_EFFECTS_ROUTE = 'mga:identificacion:causas-efectos';
export const MGA_SITUACION_EXISTENTE_ROUTE = 'mga:identificacion:situacion-existente';
export const MGA_MAGNITUD_PROBLEMA_ROUTE = 'mga:identificacion:magnitud-problema';

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

export function buildMgaSituacionExistentePrompt(problemDescription: string): string {
  const problem = problemDescription.trim() || 'sin definir aún';
  return [
    'Busca en la base de conocimiento global de proyectos.',
    `¿Cómo debería redactar la "Descripción de la situación existente" para un proyecto con el problema central: "${problem}"?`,
    'Dame un ejemplo estructurado basado ÚNICAMENTE en el historial del Knowledge Graph.',
    'Incluye una action card mga_apply con field "situacion_existente" si propones texto aplicable.',
  ].join(' ');
}

export function buildMgaMagnitudProblemaPrompt(problemDescription: string): string {
  const problem = problemDescription.trim() || 'sin definir aún';
  return [
    'Busca en la base de conocimiento global de proyectos.',
    `Ayúdame a redactar la "Magnitud actual del problema e indicadores de referencia" para el problema: "${problem}".`,
    'Sugiere qué métricas cuantitativas debería usar basándote ÚNICAMENTE en proyectos similares del Knowledge Graph.',
    'Incluye una action card mga_apply con field "magnitud_problema" si propones texto aplicable.',
  ].join(' ');
}
