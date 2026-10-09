// Hidratación del formulario de proyecto en modo edición: el proyecto puede venir con los datos de
// identificación en distintas rutas (raíz, mga_formulation_data o mga_formulation_data.identificacion)
// y con proceso/tipología guardados como id, nombre o con variaciones de mayúsculas/tildes.

type AnyRecord = Record<string, any>;

export type ProjectEditValues = {
  /** Proceso tal como está guardado (id o nombre); se resuelve contra el catálogo con resolveProcesoId. */
  proceso: string;
  tipoInversion: string;
  tipologia: string;
  sectorId: string;
  /** Nombre o código del sector, respaldo cuando no hay sector_id. */
  sectorName: string;
  productCode: string;
};

/** Normaliza texto para comparar: minúsculas, sin tildes, apóstrofes unificados y espacios colapsados. */
export function normalizeKey(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’´`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function parseMga(raw: unknown): AnyRecord {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? (raw as AnyRecord) : {};
}

function firstFilled(...values: unknown[]): string {
  for (const v of values) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'object') {
      const obj = v as AnyRecord;
      const nested = obj.id ?? obj.value ?? obj.codigo ?? obj.code ?? obj.name ?? obj.nombre;
      if (nested !== null && nested !== undefined && String(nested).trim() !== '') return String(nested).trim();
      continue;
    }
    const s = String(v).trim();
    if (s !== '' && s !== '0') return s;
  }
  return '';
}

export function extractProjectEditValues(project: AnyRecord | null | undefined): ProjectEditValues {
  const p = project ?? {};
  const mga = parseMga(p.mga_formulation_data ?? p.mgaFormulationData);
  const iden: AnyRecord = parseMga(mga.identificacion ?? mga.Identificacion ?? mga.PlanDesarrollo);

  return {
    proceso: firstFilled(
      iden.proceso_id, iden.procesoId, iden.proceso,
      mga.proceso_id, mga.procesoId, mga.proceso,
      p.proceso_id, p.procesoId, p.proceso,
    ),
    tipoInversion:
      firstFilled(iden.tipo_inversion, iden.tipoInversion, mga.tipo_inversion, mga.tipoInversion, p.tipo_inversion, p.tipoInversion) ||
      'Territorial',
    tipologia: firstFilled(
      iden.tipologia, iden.tipologia_proyecto, iden.typology,
      mga.tipologia, mga.tipologia_proyecto, mga.typology,
      p.tipologia, p.tipologia_proyecto, p.typology,
    ),
    sectorId: firstFilled(p.sector_id, p.sectorId, iden.sector_id, iden.sectorId, mga.sector_id, mga.sectorId),
    sectorName: firstFilled(p.sector, iden.sector, mga.sector),
    productCode: firstFilled(
      p.product_code, p.productCode,
      iden.product_code, iden.productCode, iden.producto_principal,
      mga.product_code, mga.productCode, mga.producto_principal,
    ),
  };
}

/** Devuelve el id (como string) del proceso que coincide por id o por nombre; si no hay coincidencia, el valor original. */
export function resolveProcesoId(raw: string, procesos: { id: number | string; name: string }[]): string {
  const value = raw.trim();
  if (!value) return '';
  const byId = procesos.find((p) => String(p.id) === value);
  if (byId) return String(byId.id);
  const key = normalizeKey(value);
  const byName = procesos.find((p) => normalizeKey(p.name) === key);
  return byName ? String(byName.id) : value;
}

/** Ajusta un valor guardado a la opción equivalente del select (ignora mayúsculas, tildes y apóstrofes). */
export function resolveOptionValue(raw: string, options: readonly string[]): string {
  const value = raw.trim();
  if (!value) return '';
  if (options.includes(value)) return value;
  const key = normalizeKey(value);
  return options.find((o) => normalizeKey(o) === key) ?? value;
}

/**
 * Resuelve el id del sector a partir del sector_id guardado o, como respaldo, del nombre/código del sector.
 * Si no hay coincidencia devuelve el sector_id original (puede que el catálogo aún no haya cargado).
 */
export function resolveSectorId(
  rawId: string,
  rawName: string,
  sectors: { id: string; code?: string | null; name?: string | null }[],
): string {
  const id = rawId.trim();
  const candidates = [id, rawName.trim()].filter(Boolean);
  for (const c of candidates) {
    const byId = sectors.find((s) => s.id === c);
    if (byId) return byId.id;
    const key = normalizeKey(c);
    const match = sectors.find((s) => normalizeKey(s.code) === key || normalizeKey(s.name) === key);
    if (match) return match.id;
  }
  return id;
}
