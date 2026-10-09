import { isAxiosError } from 'axios';
import { api } from './api';
import type { CatalogPageMeta } from '../store/catalogStore';

// Catálogo de bienes producidos con su Razón Precio Cuenta (RPC).
// La fuente de verdad es la base de datos; el SUPER_ADMIN lo administra.

export interface ProducedGood {
  id: number;
  description: string;
  rpc: number;
  created_at?: string;
  updated_at?: string;
}

export type ProducedGoodInput = Pick<ProducedGood, 'description' | 'rpc'>;

export interface ProducedGoodsPage {
  data: ProducedGood[];
  meta: CatalogPageMeta;
}

export interface ProducedGoodsListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export function producedGoodsErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const msg = (err.response?.data as { error?: string } | undefined)?.error;
    return msg || fallback;
  }
  return fallback;
}

// ─────────────── Tenant (solo lectura) ───────────────

export const fetchProducedGoods = async (): Promise<ProducedGood[]> => {
  const { data } = await api.get<ProducedGood[]>('/catalog/produced-goods');
  return Array.isArray(data) ? data : [];
};

// ─────────────── Admin (SUPER_ADMIN) ───────────────

export const adminListProducedGoods = async (params: ProducedGoodsListParams): Promise<ProducedGoodsPage> => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.append(k, String(v));
  });
  const { data } = await api.get<ProducedGoodsPage>(`/admin/catalogs/produced-goods?${q.toString()}`);
  return data;
};

export const adminCreateProducedGood = async (input: ProducedGoodInput): Promise<ProducedGood> => {
  const { data } = await api.post<ProducedGood>('/admin/catalogs/produced-goods', input);
  return data;
};

export const adminUpdateProducedGood = async (id: number, input: ProducedGoodInput): Promise<ProducedGood> => {
  const { data } = await api.put<ProducedGood>(`/admin/catalogs/produced-goods/${id}`, input);
  return data;
};

export const adminDeleteProducedGood = async (id: number): Promise<void> => {
  await api.delete(`/admin/catalogs/produced-goods/${id}`);
};
