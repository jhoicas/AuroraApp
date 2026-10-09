import { isAxiosError } from 'axios';
import { api } from './api';
import type { CatalogPageMeta } from '../store/catalogStore';

// Diccionarios DNP (Guía "Orientaciones para la definición de actividades").
// La fuente de verdad es la base de datos; el SUPER_ADMIN los administra.

export type DnpVerbKind = 'STRONG' | 'WEAK';

export type DnpUnitTypology =
  | 'SUPERFICIE'
  | 'VOLUMEN'
  | 'TIEMPO'
  | 'LONGITUD'
  | 'ENERGIA'
  | 'MASA'
  | 'CONTEO';

export const DNP_UNIT_TYPOLOGY_LABELS: Record<DnpUnitTypology, string> = {
  SUPERFICIE: 'Superficie',
  VOLUMEN: 'Volumen',
  TIEMPO: 'Tiempo',
  LONGITUD: 'Longitud',
  ENERGIA: 'Energía',
  MASA: 'Masa',
  CONTEO: 'Conteo',
};

export interface DnpVerb {
  id: number;
  verb: string;
  kind: DnpVerbKind;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface DnpStandardUnit {
  id: number;
  name: string;
  symbol: string;
  typology: DnpUnitTypology;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DnpDictionary {
  strong_verbs: string[];
  weak_verbs: string[];
  units: DnpStandardUnit[];
}

export interface DnpPage<T> {
  data: T[];
  meta: CatalogPageMeta;
}

export interface DnpListParams {
  page?: number;
  limit?: number;
  search?: string;
  kind?: DnpVerbKind | '';
  typology?: DnpUnitTypology | '';
}

export type DnpVerbInput = Pick<DnpVerb, 'verb' | 'kind' | 'notes'>;
export type DnpUnitInput = Pick<DnpStandardUnit, 'name' | 'symbol' | 'typology' | 'active'>;

export function dnpErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const status = err.response?.status;
    if (status === 409) return 'Ya existe un registro con ese nombre.';
    const msg = (err.response?.data as { error?: string } | undefined)?.error;
    return msg || fallback;
  }
  return fallback;
}

function toQuery(params: DnpListParams): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.append(k, String(v));
  });
  return q.toString();
}

// ─────────────── Tenant (solo lectura) ───────────────

export const fetchDnpDictionary = async (): Promise<DnpDictionary> => {
  const { data } = await api.get<DnpDictionary>('/catalog/dnp-dictionary');
  return data;
};

// ─────────────── Admin: verbos ───────────────

export const adminListDnpVerbs = async (params: DnpListParams): Promise<DnpPage<DnpVerb>> => {
  const { data } = await api.get<DnpPage<DnpVerb>>(`/admin/catalogs/dnp-verbs?${toQuery(params)}`);
  return data;
};

export const adminCreateDnpVerb = async (input: DnpVerbInput): Promise<DnpVerb> => {
  const { data } = await api.post<DnpVerb>('/admin/catalogs/dnp-verbs', input);
  return data;
};

export const adminUpdateDnpVerb = async (id: number, input: DnpVerbInput): Promise<DnpVerb> => {
  const { data } = await api.put<DnpVerb>(`/admin/catalogs/dnp-verbs/${id}`, input);
  return data;
};

export const adminDeleteDnpVerb = async (id: number): Promise<void> => {
  await api.delete(`/admin/catalogs/dnp-verbs/${id}`);
};

// ─────────────── Admin: unidades ───────────────

export const adminListDnpUnits = async (params: DnpListParams): Promise<DnpPage<DnpStandardUnit>> => {
  const { data } = await api.get<DnpPage<DnpStandardUnit>>(`/admin/catalogs/dnp-units?${toQuery(params)}`);
  return data;
};

export const adminCreateDnpUnit = async (input: DnpUnitInput): Promise<DnpStandardUnit> => {
  const { data } = await api.post<DnpStandardUnit>('/admin/catalogs/dnp-units', input);
  return data;
};

export const adminUpdateDnpUnit = async (id: number, input: DnpUnitInput): Promise<DnpStandardUnit> => {
  const { data } = await api.put<DnpStandardUnit>(`/admin/catalogs/dnp-units/${id}`, input);
  return data;
};

export const adminDeleteDnpUnit = async (id: number): Promise<void> => {
  await api.delete(`/admin/catalogs/dnp-units/${id}`);
};
