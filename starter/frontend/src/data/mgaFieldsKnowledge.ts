/**
 * Catálogo de conocimiento de campos MGA.
 *
 * Cada entrada describe la regla normativa DNP, el patrón estructural
 * y una función `buildSuggestion` que genera un texto borrador
 * formal contextualizado al proyecto activo.
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type ProjectContext = {
  projectName?: string;
  sector?: string;
  productCode?: string;
  productName?: string;
  municipio?: string;
  departamento?: string;
  procesoName?: string;
  problemDescription?: string;
  generalObjective?: string;
  objeto?: string;
};

export type MgaFieldKnowledge = {
  fieldId: string;
  displayName: string;
  /** 1 oración: qué se debe escribir en este campo. */
  whatGoesHere: string;
  /** 1 oración: la regla o norma DNP que lo sustenta. */
  whyRule: string;
  /** Patrón de redacción (plantilla). */
  templatePattern: string;
  /** Texto de ejemplo estático. */
  exampleText: string;
  /** Genera un borrador formal usando datos reales del proyecto. */
  buildSuggestion: (ctx: ProjectContext) => string;
};

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function loc(ctx: ProjectContext): string {
  const parts: string[] = [];
  if (ctx.municipio) parts.push(ctx.municipio);
  if (ctx.departamento) parts.push(ctx.departamento);
  return parts.length > 0 ? parts.join(', ') : 'el territorio priorizado';
}

function sectorOrDefault(ctx: ProjectContext): string {
  return ctx.sector?.trim() || 'el sector definido';
}

function productoOrDefault(ctx: ProjectContext): string {
  return ctx.productName?.trim() || ctx.productCode?.trim() || 'el bien o servicio del proyecto';
}

// ---------------------------------------------------------------------------
// Diccionario de Campos
// ---------------------------------------------------------------------------

export const MGA_FIELD_KNOWLEDGE: Record<string, MgaFieldKnowledge> = {

  // ── Nombre del proyecto ──────────────────────────────────────────────
  name: {
    fieldId: 'name',
    displayName: 'Nombre del proyecto',
    whatGoesHere:
      'Concatenación de [Proceso de Inversión] + [Objeto/Bien o Servicio] + [Localización geográfica].',
    whyRule:
      'Según la MGA del DNP, el nombre debe identificar unívocamente el proyecto indicando el tipo de intervención, el bien/servicio y la ubicación.',
    templatePattern: '[Proceso de Inversión] + [Objeto/Bien o Servicio] + [Localización]',
    exampleText:
      'Construcción y dotación del centro de desarrollo infantil en el municipio de Santiago de Cali, Valle del Cauca.',
    buildSuggestion: (ctx) => {
      const proceso = ctx.procesoName?.trim() || 'Mejoramiento';
      const objeto = ctx.objeto?.trim() || productoOrDefault(ctx);
      return `${proceso} de ${objeto} en ${loc(ctx)}.`;
    },
  },

  // ── Objeto del proyecto ──────────────────────────────────────────────
  objeto: {
    fieldId: 'objeto',
    displayName: 'Objeto del proyecto',
    whatGoesHere:
      'Descripción concisa que combina [Sustantivo de Acción] + [Bien/Servicio] + [Localización o Población beneficiaria].',
    whyRule:
      'El objeto define la intervención central del proyecto según el manual de inversión pública del DNP; debe tener al menos 10 caracteres.',
    templatePattern: '[Sustantivo de Acción] + [Bien/Servicio] + [Localización/Población]',
    exampleText:
      'Construcción y dotación del centro de desarrollo infantil en el municipio de Santiago de Cali, Valle del Cauca.',
    buildSuggestion: (ctx) => {
      const producto = productoOrDefault(ctx);
      const sector = sectorOrDefault(ctx);
      return `Fortalecimiento de ${producto} del sector ${sector} en ${loc(ctx)}.`;
    },
  },

  // ── Objetivo General ─────────────────────────────────────────────────
  general_objective: {
    fieldId: 'general_objective',
    displayName: 'Objetivo General',
    whatGoesHere:
      'Frase que inicia con un verbo en infinitivo, describiendo el efecto positivo central que se busca lograr.',
    whyRule:
      'Según la MGA, el objetivo general debe expresarse como la situación deseada inversa al problema central, iniciando con verbo en infinitivo.',
    templatePattern: '[Verbo en Infinitivo] + [Efecto deseado] + [Población] + [Localización]',
    exampleText:
      'Mejorar las condiciones de atención integral a la primera infancia en el municipio de Santiago de Cali, Valle del Cauca.',
    buildSuggestion: (ctx) => {
      const sector = sectorOrDefault(ctx);
      return `Contribuir al mejoramiento de las condiciones de ${sector} para la población de ${loc(ctx)}.`;
    },
  },

  // ── Problemática / Descripción del problema ──────────────────────────
  problem_description: {
    fieldId: 'problem_description',
    displayName: 'Problemática',
    whatGoesHere:
      'Diagnóstico cuantitativo del problema central, incluyendo causas directas, consecuencias e indicadores del territorio.',
    whyRule:
      'El DNP exige una descripción clara y fundamentada del problema que justifique la inversión pública, con datos verificables.',
    templatePattern: 'Diagnóstico cuantitativo + Causas + Consecuencias en el territorio',
    exampleText:
      'En el municipio se evidencia un déficit del 35% en infraestructura educativa, lo que genera hacinamiento en las aulas y limita la cobertura del servicio de educación básica.',
    buildSuggestion: (ctx) => {
      const sector = sectorOrDefault(ctx);
      return `En ${loc(ctx)} se identifican deficiencias significativas en la prestación de servicios de ${sector}, lo cual afecta directamente a la población objetivo y limita el desarrollo territorial.`;
    },
  },

  // ── Situación existente ──────────────────────────────────────────────
  situacion_existente: {
    fieldId: 'situacion_existente',
    displayName: 'Situación existente',
    whatGoesHere:
      'Descripción detallada del estado actual de la problemática en el territorio, con cifras y fuentes verificables.',
    whyRule:
      'La MGA requiere documentar la línea base para medir el impacto futuro del proyecto de inversión.',
    templatePattern: 'Estado actual + Datos cuantitativos + Fuentes de información',
    exampleText:
      'Actualmente, el municipio cuenta con 12 sedes educativas de las cuales 8 presentan deterioro estructural según el diagnóstico de la Secretaría de Educación 2024.',
    buildSuggestion: (ctx) => {
      const sector = sectorOrDefault(ctx);
      const problem = ctx.problemDescription?.trim();
      if (problem) {
        return `Actualmente, en ${loc(ctx)} se presenta la siguiente situación con respecto a ${sector}: ${problem.endsWith('.') ? problem : problem + '.'} Los indicadores disponibles evidencian la necesidad de intervención.`;
      }
      return `Actualmente, en ${loc(ctx)} se evidencian condiciones deficientes en materia de ${sector}, requiriendo una intervención oportuna para mejorar los indicadores del territorio.`;
    },
  },

  // ── Magnitud del problema ────────────────────────────────────────────
  magnitud_problema: {
    fieldId: 'magnitud_problema',
    displayName: 'Magnitud del problema',
    whatGoesHere:
      'Indicadores cuantitativos de referencia que dimensionan la magnitud del problema y permiten medir el cambio esperado.',
    whyRule:
      'El DNP requiere métricas cuantificables que establezcan la línea base y las metas del proyecto.',
    templatePattern: 'Indicadores de referencia + Valores actuales + Metas esperadas',
    exampleText:
      'Déficit de cobertura: 35%. Hacinamiento: 48 alumnos por aula (estándar máximo: 30). Meta: reducir el déficit al 15% al finalizar el proyecto.',
    buildSuggestion: (ctx) => {
      const sector = sectorOrDefault(ctx);
      return `Indicadores clave de ${sector} en ${loc(ctx)}: se requiere establecer línea base con fuentes oficiales (DANE, Secretaría de Planeación, entre otras) para cuantificar la brecha actual y definir las metas de resultado del proyecto.`;
    },
  },

  // ── Población afectada ───────────────────────────────────────────────
  poblacion_afectada: {
    fieldId: 'poblacion_afectada',
    displayName: 'Población afectada',
    whatGoesHere:
      'Descripción censal de la población total que experimenta el problema, con cifras demográficas y fuentes.',
    whyRule:
      'La MGA exige cuantificar y caracterizar la población afectada para dimensionar el alcance del problema.',
    templatePattern: 'Cantidad + Caracterización demográfica + Fuente censal',
    exampleText:
      'La población afectada asciende a 15,200 habitantes del área urbana del municipio, según proyecciones DANE 2025.',
    buildSuggestion: (ctx) => {
      return `La población afectada corresponde a los habitantes de ${loc(ctx)} que se ven directamente impactados por las condiciones identificadas en la problemática, según datos de proyecciones DANE vigentes.`;
    },
  },

  // ── Población objetivo ───────────────────────────────────────────────
  poblacion_objetivo: {
    fieldId: 'poblacion_objetivo',
    displayName: 'Población objetivo',
    whatGoesHere:
      'Subgrupo específico de la población afectada que será beneficiario directo del proyecto.',
    whyRule:
      'El DNP requiere focalizar la intervención en un grupo poblacional concreto y medible.',
    templatePattern: 'Cantidad + Grupo específico + Criterio de focalización',
    exampleText:
      'La población objetivo comprende 3,500 niños y niñas de 0 a 5 años del área urbana del municipio.',
    buildSuggestion: (ctx) => {
      const sector = sectorOrDefault(ctx);
      return `La población objetivo del proyecto comprende el subgrupo de habitantes de ${loc(ctx)} que será beneficiario directo de la intervención en ${sector}, focalizado según los criterios de priorización definidos.`;
    },
  },
};

// ---------------------------------------------------------------------------
// Función de acceso rápido
// ---------------------------------------------------------------------------

/**
 * Devuelve el conocimiento de un campo MGA, o `undefined` si el fieldId no existe.
 */
export function getFieldKnowledge(fieldId: string): MgaFieldKnowledge | undefined {
  return MGA_FIELD_KNOWLEDGE[fieldId];
}
