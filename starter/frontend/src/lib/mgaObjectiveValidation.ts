/**
 * Validación normativa MGA: el objetivo debe iniciar con verbo en infinitivo.
 */
const SPANISH_INFINITIVE = /^[\p{L}áéíóúüñ]+(ar|er|ir)$/iu;

const COMMON_INFINITIVES = new Set([
  'construir',
  'mejorar',
  'reducir',
  'aumentar',
  'disminuir',
  'fortalecer',
  'ampliar',
  'garantizar',
  'promover',
  'desarrollar',
  'implementar',
  'optimizar',
  'recuperar',
  'renovar',
  'intervenir',
  'disminuir',
  'eliminar',
  'prevenir',
  'mitigar',
  'articular',
]);

export function validateInfinitiveObjective(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const firstToken = trimmed.split(/\s+/)[0]?.replace(/[.,;:!?]+$/, '') ?? '';
  const normalized = firstToken.toLowerCase();

  if (COMMON_INFINITIVES.has(normalized) || SPANISH_INFINITIVE.test(firstToken)) {
    return null;
  }

  return 'El objetivo debe iniciar con un verbo en infinitivo (ej. Construir, Mejorar, Reducir).';
}

export const MGA_INFINITIVE_GUIDANCE =
  'Redacte el objetivo iniciando con un verbo en infinitivo (Construir, Mejorar, Reducir…). Debe expresar el cambio esperado, ser coherente con el problema central y medible mediante indicadores.';

export const MGA_INFINITIVE_ASK_SUFFIX =
  ' Verifica que inicie con un verbo en infinitivo según el manual MGA del DNP.';
