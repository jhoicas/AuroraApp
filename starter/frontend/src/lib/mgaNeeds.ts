import type { MgaNeedAnnualValue } from './mgaApi';

/** Déficit = demanda - oferta, redondeado a 4 decimales (igual que el backend). */
export function computeNeedDeficit(oferta: number, demanda: number): number {
  return Math.round((demanda - oferta) * 10000) / 10000;
}

/**
 * Convierte el texto de un input numérico a número.
 * Vacío cuenta como 0 (para que el déficit se actualice mientras se digita).
 * Devuelve null si el texto no es un número válido o es negativo.
 */
export function parseNeedInput(raw: string): number | null {
  const text = raw.trim().replace(',', '.');
  if (text === '') return 0;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

export type NeedRowDraft = { oferta: string; demanda: string };

export function draftFromRow(row: MgaNeedAnnualValue): NeedRowDraft {
  return { oferta: String(row.oferta), demanda: String(row.demanda) };
}

/** Déficit en vivo de una fila en edición; null si algún valor no es válido. */
export function draftDeficit(draft: NeedRowDraft): number | null {
  const oferta = parseNeedInput(draft.oferta);
  const demanda = parseNeedInput(draft.demanda);
  if (oferta === null || demanda === null) return null;
  return computeNeedDeficit(oferta, demanda);
}

/** La fila cambió respecto a lo guardado. */
export function isDraftDirty(draft: NeedRowDraft, row: MgaNeedAnnualValue): boolean {
  const oferta = parseNeedInput(draft.oferta);
  const demanda = parseNeedInput(draft.demanda);
  return oferta !== row.oferta || demanda !== row.demanda;
}
