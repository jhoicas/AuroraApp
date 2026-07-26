import { create } from 'zustand';
import { isAxiosError } from 'axios';
import { api } from '../lib/api';

export type CatalogSector = {
  id: string;
  code: string;
  name: string;
  application?: string;
  observations?: string;
};

/** Programa ligado a sector (tabla programs) — explorador DNP. */
export type CatalogProgram = {
  id: string;
  sector_id: string;
  code: string;
  name: string;
};

/** Fila plana programas_subprogramas — catálogo maestro admin. */
export type CatalogProgramSubprogram = {
  id: string;
  tenant_id?: string | null;
  sector_id: string;
  codigo_sector: string;
  nombre_sector: string;
  codigo_programa: string;
  nombre_programa: string;
  ambito_aplicacion: string;
  codigo_subprograma: string;
  nombre_subprograma: string;
  observaciones: string;
  created_at: string;
};

export type CatalogProduct = {
  id: string;
  program_id: string;
  code: string;
  code_bpin?: string | null;
  name: string;
};

export type CatalogPageMeta = {
  total: number;
  page: number;
  limit: number;
  last_page: number;
};

type PaginatedSectors = {
  data: CatalogSector[];
  meta: CatalogPageMeta;
};

type PaginatedPrograms = {
  data: CatalogProgramSubprogram[];
  meta: CatalogPageMeta;
};

type PaginatedProducts = {
  data: CatalogProduct[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  q: string;
};

export type CatalogImportResult = {
  status: string;
  message: string;
  inserted: number;
  updated: number;
  skipped: number;
  total_rows_parsed: number;
};

export type CreateSectorInput = {
  code: string;
  name: string;
  application?: string;
  observations?: string;
};

type CatalogState = {
  sectors: CatalogSector[];
  sectorsMeta: CatalogPageMeta | null;
  programs: CatalogProgram[];
  programSubprograms: CatalogProgramSubprogram[];
  programsMeta: CatalogPageMeta | null;
  products: CatalogProduct[];
  isLoading: boolean;
  isLoadingPrograms: boolean;
  error: string | null;
  fetchSectors: (opts?: { page?: number; limit?: number; search?: string }) => Promise<void>;
  createSector: (input: CreateSectorInput) => Promise<CatalogSector>;
  importSectors: (file: File) => Promise<CatalogImportResult>;
  /** Programas por sector (tabla programs) — DNP explorer. */
  fetchProgramsBySector: (sectorId: string) => Promise<void>;
  /** Listado maestro programas/subprogramas paginado. */
  fetchPrograms: (opts?: { page?: number; limit?: number; search?: string }) => Promise<void>;
  importPrograms: (file: File) => Promise<CatalogImportResult>;
  searchProducts: (query: string) => Promise<void>;
  clearPrograms: () => void;
  clearProducts: () => void;
  clearError: () => void;
};

function extractError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const msg = (err.response?.data as { error?: string } | undefined)?.error;
    return msg || fallback;
  }
  return fallback;
}

function parseSectorsPayload(data: unknown): {
  sectors: CatalogSector[];
  meta: CatalogPageMeta | null;
} {
  if (Array.isArray(data)) {
    return { sectors: data as CatalogSector[], meta: null };
  }
  if (data && typeof data === 'object' && Array.isArray((data as PaginatedSectors).data)) {
    const paginated = data as PaginatedSectors;
    return { sectors: paginated.data, meta: paginated.meta ?? null };
  }
  return { sectors: [], meta: null };
}

export const useCatalogStore = create<CatalogState>((set) => ({
  sectors: [],
  sectorsMeta: null,
  programs: [],
  programSubprograms: [],
  programsMeta: null,
  products: [],
  isLoading: false,
  isLoadingPrograms: false,
  error: null,

  clearError: () => set({ error: null }),
  clearPrograms: () => set({ programs: [], programSubprograms: [], programsMeta: null }),
  clearProducts: () => set({ products: [] }),

  fetchSectors: async (opts) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get<PaginatedSectors | CatalogSector[]>('/catalog/sectors', {
        params: {
          page: opts?.page ?? 1,
          limit: opts?.limit ?? 20,
          search: opts?.search?.trim() || undefined,
        },
      });
      const parsed = parseSectorsPayload(data);
      set({
        sectors: parsed.sectors,
        sectorsMeta: parsed.meta,
        isLoading: false,
      });
    } catch (err) {
      set({
        isLoading: false,
        error: extractError(err, 'No se pudieron cargar los sectores'),
        sectors: [],
        sectorsMeta: null,
      });
    }
  },

  createSector: async (input) => {
    try {
      const { data } = await api.post<CatalogSector>('/catalog/sectors', {
        code: input.code.trim(),
        name: input.name.trim(),
        application: input.application?.trim() ?? '',
        observations: input.observations?.trim() ?? '',
      });
      return data;
    } catch (err) {
      throw new Error(extractError(err, 'No se pudo crear el sector'));
    }
  },

  importSectors: async (file) => {
    const form = new FormData();
    form.append('file', file);
    try {
      const { data } = await api.post<CatalogImportResult>('/catalog/sectors/import', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    } catch (err) {
      throw new Error(extractError(err, 'No se pudo importar el archivo de sectores'));
    }
  },

  fetchProgramsBySector: async (sectorId) => {
    if (!sectorId) {
      set({ programs: [] });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get<CatalogProgram[]>(
        `/catalog/sectors/${sectorId}/programs`,
      );
      set({ programs: Array.isArray(data) ? data : [], isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: extractError(err, 'No se pudieron cargar los programas del sector'),
        programs: [],
      });
    }
  },

  fetchPrograms: async (opts) => {
    set({ isLoadingPrograms: true, error: null });
    try {
      const { data } = await api.get<PaginatedPrograms>('/catalog/programs', {
        params: {
          page: opts?.page ?? 1,
          limit: opts?.limit ?? 10,
          search: opts?.search?.trim() || undefined,
        },
      });
      set({
        programSubprograms: data.data ?? [],
        programsMeta: data.meta ?? null,
        isLoadingPrograms: false,
      });
    } catch (err) {
      set({
        isLoadingPrograms: false,
        error: extractError(err, 'No se pudieron cargar los programas'),
        programSubprograms: [],
        programsMeta: null,
      });
    }
  },

  importPrograms: async (file) => {
    const form = new FormData();
    form.append('file', file);
    try {
      const { data } = await api.post<CatalogImportResult>('/catalog/programs/import', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    } catch (err) {
      throw new Error(extractError(err, 'No se pudo importar el archivo de programas'));
    }
  },

  searchProducts: async (query) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get<PaginatedProducts>('/catalog/products', {
        params: { q: query.trim(), page: 1, page_size: 50 },
      });
      set({ products: data.data ?? [], isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: extractError(err, 'No se pudieron buscar productos'),
        products: [],
      });
    }
  },
}));
