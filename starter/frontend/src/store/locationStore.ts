import { create } from 'zustand';
import { isAxiosError } from 'axios';
import { api } from '../lib/api';
import { adminListLocations } from '../lib/adminApi';
import type { PaginationMeta } from '../lib/adminApi';

// ─── Tipos ───────────────────────────────────────────────────────────

export type Municipio = {
  id: number;
  name: string;
  departamento_id: number;
};

export type Departamento = {
  id: number;
  name: string;
  region_id: number;
  municipios: Municipio[];
};

export type Region = {
  id: number;
  name: string;
  departamentos: Departamento[];
};

export type Proceso = {
  id: number;
  name: string;
};

export type TipoAgrupacion = {
  id: number;
  name: string;
  is_active?: boolean;
};

export type Agrupacion = {
  id: number;
  name: string;
  municipio_id: number;
  tipo_agrupacion_id: number;
  is_active?: boolean;
  municipio?: Municipio;
  tipo_agrupacion?: TipoAgrupacion;
};

/** Selección de localización del usuario en el formulario. */
export type LocationSelection = {
  regionId: number | null;
  departamentoId: number | null;
  municipioId: number | null;
  tipoAgrupacionId?: number | null;
  agrupacionId?: number | null;
};

// ─── Store ───────────────────────────────────────────────────────────

type LocationState = {
  regions: Region[];
  procesos: Proceso[];
  tiposAgrupacion: TipoAgrupacion[];
  agrupaciones: Agrupacion[];
  isLoadingLocations: boolean;
  isLoadingProcesos: boolean;
  isLoadingTiposAgrupacion: boolean;
  isLoadingAgrupaciones: boolean;
  error: string | null;
  fetchLocations: (force?: boolean) => Promise<void>;
  fetchProcesos: () => Promise<void>;
  fetchTiposAgrupacion: (force?: boolean) => Promise<void>;
  fetchAgrupaciones: (params?: { municipio_id?: number; tipo_agrupacion_id?: number }) => Promise<void>;
  adminLocations: any[];
  adminLocationsMeta: PaginationMeta | null;
  fetchAdminLocations: (type: 'regiones' | 'departamentos' | 'municipios' | 'tipos_agrupacion' | 'agrupaciones', search?: string, page?: number, limit?: number) => Promise<void>;
  clearError: () => void;
};

function extractError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const msg = (err.response?.data as { error?: string } | undefined)?.error;
    return msg || fallback;
  }
  return fallback;
}

export const useLocationStore = create<LocationState>((set, get) => ({
  regions: [],
  procesos: [],
  tiposAgrupacion: [],
  agrupaciones: [],
  adminLocations: [],
  adminLocationsMeta: null,
  isLoadingLocations: false,
  isLoadingProcesos: false,
  isLoadingTiposAgrupacion: false,
  isLoadingAgrupaciones: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchAdminLocations: async (type, search, page = 1, limit = 10) => {
    set({ isLoadingLocations: true, error: null });
    try {
      const { data, meta } = await adminListLocations(type, search, page, limit);
      set({ adminLocations: data, adminLocationsMeta: meta, isLoadingLocations: false });
    } catch (err) {
      set({
        isLoadingLocations: false,
        error: extractError(err, 'No se pudieron cargar las localizaciones (admin)'),
        adminLocations: [],
        adminLocationsMeta: null,
      });
    }
  },

  fetchLocations: async (force?: boolean) => {
    // Cache: no recarga si ya tiene datos y no se fuerza
    if (!force && get().regions.length > 0) return;

    set({ isLoadingLocations: true, error: null });
    try {
      const { data } = await api.get<{ data: Region[] }>('/locations');
      set({
        regions: data.data ?? [],
        isLoadingLocations: false,
      });
    } catch (err) {
      set({
        isLoadingLocations: false,
        error: extractError(err, 'No se pudieron cargar las localizaciones'),
      });
    }
  },

  fetchTiposAgrupacion: async (force?: boolean) => {
    if (!force && get().tiposAgrupacion.length > 0) return;

    set({ isLoadingTiposAgrupacion: true, error: null });
    try {
      const { data } = await api.get<{ data: TipoAgrupacion[] }>('/locations/tipos-agrupacion');
      set({
        tiposAgrupacion: data.data ?? [],
        isLoadingTiposAgrupacion: false,
      });
    } catch (err) {
      set({
        isLoadingTiposAgrupacion: false,
        error: extractError(err, 'No se pudieron cargar los tipos de agrupación'),
      });
    }
  },

  fetchAgrupaciones: async (params?: { municipio_id?: number; tipo_agrupacion_id?: number }) => {
    set({ isLoadingAgrupaciones: true, error: null });
    try {
      const q = new URLSearchParams();
      if (params?.municipio_id) q.append('municipio_id', String(params.municipio_id));
      if (params?.tipo_agrupacion_id) q.append('tipo_agrupacion_id', String(params.tipo_agrupacion_id));
      const queryStr = q.toString() ? `?${q.toString()}` : '';
      const { data } = await api.get<{ data: Agrupacion[] }>(`/locations/agrupaciones${queryStr}`);
      set({
        agrupaciones: data.data ?? [],
        isLoadingAgrupaciones: false,
      });
    } catch (err) {
      set({
        isLoadingAgrupaciones: false,
        error: extractError(err, 'No se pudieron cargar las agrupaciones'),
      });
    }
  },

  fetchProcesos: async () => {
    // Cache: no recarga si ya tiene datos
    if (get().procesos.length > 0) return;

    set({ isLoadingProcesos: true, error: null });
    try {
      const { data } = await api.get<{ data: Proceso[] }>('/procesos?limit=1000&page=1');
      set({
        procesos: data.data ?? [],
        isLoadingProcesos: false,
      });
    } catch (err) {
      set({
        isLoadingProcesos: false,
        error: extractError(err, 'No se pudieron cargar los procesos'),
      });
    }
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Resuelve el nombre para mostrar de una selección de localización.
 * Toma el nivel más bajo seleccionado: municipio > departamento > región.
 */
export function resolveLocationDisplayName(
  selection: LocationSelection,
  regions: Region[],
): string {
  const region = regions.find((r) => r.id === selection.regionId);
  if (!region) return '';

  const dep = region.departamentos.find((d) => d.id === selection.departamentoId);
  if (!dep) return region.name;

  const mun = dep.municipios.find((m) => m.id === selection.municipioId);
  if (mun) return mun.name;

  return dep.name;
}

/**
 * Genera la cadena formateada de localidades para el nombre del proyecto.
 * Toma el nivel más bajo de cada selección, unido por comas.
 */
export function formatLocalizaciones(
  selections: LocationSelection[],
  regions: Region[],
): string {
  return selections
    .map((sel) => resolveLocationDisplayName(sel, regions))
    .filter(Boolean)
    .join(', ');
}

/**
 * Genera el nombre del proyecto según la regla MGA:
 * [Proceso.Name] + " " + [Objeto] + " " + [Localidades_Formateadas]
 */
export function generateProjectName(
  procesoName: string,
  objeto: string,
  selections: LocationSelection[],
  regions: Region[],
): string {
  const parts: string[] = [];

  if (procesoName.trim()) {
    parts.push(procesoName.trim());
  }
  if (objeto.trim()) {
    parts.push(objeto.trim());
  }

  const locStr = formatLocalizaciones(selections, regions);
  if (locStr) {
    parts.push(locStr);
  }

  return parts.join(' ');
}
