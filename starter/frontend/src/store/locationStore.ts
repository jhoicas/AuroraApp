import { create } from 'zustand';
import { isAxiosError } from 'axios';
import { api } from '../lib/api';

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

/** Selección de localización del usuario en el formulario. */
export type LocationSelection = {
  regionId: number | null;
  departamentoId: number | null;
  municipioId: number | null;
};

// ─── Store ───────────────────────────────────────────────────────────

type LocationState = {
  regions: Region[];
  procesos: Proceso[];
  isLoadingLocations: boolean;
  isLoadingProcesos: boolean;
  error: string | null;
  fetchLocations: () => Promise<void>;
  fetchProcesos: () => Promise<void>;
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
  isLoadingLocations: false,
  isLoadingProcesos: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchLocations: async () => {
    // Cache: no recarga si ya tiene datos
    if (get().regions.length > 0) return;

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

  fetchProcesos: async () => {
    // Cache: no recarga si ya tiene datos
    if (get().procesos.length > 0) return;

    set({ isLoadingProcesos: true, error: null });
    try {
      const { data } = await api.get<{ data: Proceso[] }>('/procesos');
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
