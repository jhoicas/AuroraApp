import { create } from 'zustand';
import { isAxiosError } from 'axios';
import { api } from '../lib/api';

export type TenantStatus = 'ACTIVE' | 'SUSPENDED';

export type Tenant = {
  id: string;
  name: string;
  nit?: string | null;
  domain?: string | null;
  contact_email: string;
  status: TenantStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateTenantPayload = {
  name: string;
  nit: string;
  contact_email: string;
  domain?: string;
};

type PaginatedTenants = {
  data: Tenant[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

type TenantState = {
  tenants: Tenant[];
  isLoading: boolean;
  error: string | null;
  fetchTenants: () => Promise<void>;
  createTenant: (data: CreateTenantPayload) => Promise<Tenant>;
  toggleTenantStatus: (id: string, currentStatus: TenantStatus) => Promise<void>;
  clearError: () => void;
};

function extractError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const msg = (err.response?.data as { error?: string } | undefined)?.error;
    return msg || fallback;
  }
  return fallback;
}

export const useTenantStore = create<TenantState>((set, get) => ({
  tenants: [],
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchTenants: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get<PaginatedTenants>('/admin/tenants', {
        params: { page: 1, page_size: 100 },
      });
      set({ tenants: data.data ?? [], isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: extractError(err, 'No se pudieron cargar los tenants'),
      });
    }
  },

  createTenant: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const body: CreateTenantPayload = {
        name: payload.name.trim(),
        nit: payload.nit.trim(),
        contact_email: payload.contact_email.trim().toLowerCase(),
      };
      if (payload.domain?.trim()) {
        body.domain = payload.domain.trim().toLowerCase();
      }

      const { data } = await api.post<Tenant>('/admin/tenants', body);
      set({
        tenants: [data, ...get().tenants],
        isLoading: false,
      });
      return data;
    } catch (err) {
      const message = extractError(err, 'No se pudo crear el tenant');
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  toggleTenantStatus: async (id, currentStatus) => {
    const nextStatus: TenantStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    set({ error: null });
    try {
      const { data } = await api.patch<Tenant>(`/admin/tenants/${id}/status`, {
        status: nextStatus,
      });
      set({
        tenants: get().tenants.map((t) => (t.id === id ? data : t)),
      });
    } catch (err) {
      const message = extractError(err, 'No se pudo actualizar el estado');
      set({ error: message });
      throw new Error(message);
    }
  },
}));
