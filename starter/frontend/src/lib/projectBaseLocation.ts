import type { Project } from '../store/projectStore';

/**
 * Regla de negocio (localización estricta): el proyecto tiene un Departamento base y, en
 * Identificación → Población y Preparación → Localización, solo se pueden elegir municipios
 * de ese departamento. El backend la valida (HTTP 400); aquí se usa para bloquear la UI.
 */
export type ProjectBaseLocation = {
  regionId: number | null;
  departamentoId: number;
  /** Solo si el proyecto se creó fijando hasta Municipio: entonces el municipio también es de solo lectura. */
  municipioId?: number | null;
};

function toNum(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pick(obj: Record<string, unknown> | null | undefined, ...keys: string[]): number | null {
  if (!obj) return null;
  for (const key of keys) {
    const n = toNum(obj[key]);
    if (n !== null) return n;
  }
  return null;
}

/**
 * Departamento/región base del proyecto. Prioridad: base_* del backend, la clave reservada
 * mga_formulation_data.localizacion_base y, para respuestas antiguas, la localización principal
 * (departamento_id/region_id). Se prueba cada fuente en orden y se usa la primera con departamento.
 * Devuelve null si el proyecto no tiene departamento registrado.
 */
export function resolveProjectBaseLocation(
  ...sources: Array<Partial<Project> | null | undefined>
): ProjectBaseLocation | null {
  for (const source of sources) {
    if (!source) continue;
    const stored = (source.mga_formulation_data as Record<string, unknown> | null | undefined)?.localizacion_base as
      | Record<string, unknown>
      | undefined;
    const src = source as Record<string, unknown>;

    const departamentoId =
      toNum(source.base_departamento_id) ??
      pick(stored, 'departamento_id', 'departamentoId') ??
      pick(src, 'departamento_id', 'departamentoId');
    if (departamentoId === null) continue;

    const regionId =
      toNum(source.base_region_id) ?? pick(stored, 'region_id', 'regionId') ?? pick(src, 'region_id', 'regionId');
    const municipioId =
      toNum(source.base_municipio_id) ?? pick(stored, 'municipio_id', 'municipioId');
    return municipioId !== null ? { regionId, departamentoId, municipioId } : { regionId, departamentoId };
  }
  return null;
}

export type BaseLocatedRow = {
  region_id: number | null;
  departamento_id: number | null;
  municipio_id: number | null;
  agrupacion_id?: number | null;
  tipo_agrupacion_id?: number | null;
};

/**
 * Fuerza una fila de localización al departamento base. Si la fila apuntaba a otro departamento
 * (datos previos a la regla), se limpian municipio y agrupación porque dejan de ser válidos.
 */
export function applyBaseToRow<T extends BaseLocatedRow>(row: T, base: ProjectBaseLocation): { row: T; adjusted: boolean } {
  const outside = row.departamento_id !== null && row.departamento_id !== undefined && row.departamento_id !== base.departamentoId;
  const next: T = { ...row, region_id: base.regionId ?? row.region_id, departamento_id: base.departamentoId };
  if (base.municipioId != null) next.municipio_id = base.municipioId;
  if (outside) {
    next.municipio_id = null;
    if ('agrupacion_id' in next) next.agrupacion_id = null;
    if ('tipo_agrupacion_id' in next) next.tipo_agrupacion_id = null;
  }
  return { row: next, adjusted: outside };
}

export function applyBaseToRows<T extends BaseLocatedRow>(
  rows: T[],
  base: ProjectBaseLocation,
): { rows: T[]; adjusted: number } {
  let adjusted = 0;
  const next = rows.map((r) => {
    const res = applyBaseToRow(r, base);
    if (res.adjusted) adjusted += 1;
    return res.row;
  });
  return { rows: next, adjusted };
}
