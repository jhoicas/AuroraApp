import { create } from 'zustand';
import { isAxiosError } from 'axios';
import { api } from '../lib/api';

/** Límite alto para cargar listados completos en wizard tenant (sectores/productos). */
export const CATALOG_FULL_LIST_LIMIT = 5000;

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

/** Producto ligado a programa (tabla products) — explorador DNP. */
export type CatalogProduct = {
  id: string;
  program_id: string;
  code: string;
  code_bpin?: string | null;
  name: string;
};

/**
 * Producto del catálogo maestro (24 columnas MGA).
 * Alias `Product` solicitado por la UI de administración.
 */
export type Product = {
  id: string;
  tenant_id?: string | null;
  sector: string;
  nombre_del_sector: string;
  codigo_del_programa: string;
  nombre_del_programa: string;
  codigo_del_producto: string;
  producto: string;
  descripcion: string;
  medido_a_traves_de: string;
  codigo_del_indicador_de_producto: string;
  indicador_de_producto: string;
  unidad_de_medida: string;
  indicador_principal: boolean;
  es_nacional: boolean;
  es_territorial: boolean;
  objetivos_de_desarrollo_sostenible_ods: string;
  meta_ods: string;
  tipologia_general_suifp: string;
  tipologia_d: boolean;
  tipologia_e: boolean;
  tipologia_a: boolean;
  tipologia_b: boolean;
  tipologia_c: boolean;
  tiene_edt: boolean;
  edt: string;
  created_at?: string;
};

/** @deprecated Preferir `Product` — se mantiene por compatibilidad. */
export type CatalogProductRow = Product;

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

/** Payload crudo del backend (nombres internos de columna). */
type ApiCatalogProduct = {
  id: string;
  tenant_id?: string | null;
  sector: string;
  nombre_sector: string;
  codigo_programa: string;
  nombre_programa: string;
  codigo_producto: string;
  producto: string;
  descripcion: string;
  medido_a_traves_de: string;
  codigo_indicador_producto: string;
  indicador_producto: string;
  unidad_de_medida: string;
  indicador_principal: boolean;
  es_nacional: boolean;
  es_territorial: boolean;
  ods: string;
  meta_ods: string;
  tipologia_general_suifp: string;
  tipologia_d: boolean;
  tipologia_e: boolean;
  tipologia_a_piip: boolean;
  tipologia_b_piip: boolean;
  tipologia_c_piip: boolean;
  tiene_edt: boolean;
  edt: string;
  created_at?: string;
};

type PaginatedCatalogProducts = {
  data: ApiCatalogProduct[];
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

export type CatalogImportRowError = {
  row?: number;
  codigo_producto?: string;
  message: string;
};

export type CatalogImportResult = {
  status: string;
  message: string;
  inserted: number;
  updated: number;
  skipped: number;
  total_rows_parsed: number;
  errors?: CatalogImportRowError[];
  details?: CatalogImportRowError[] | string;
};

export type CreateSectorInput = {
  code: string;
  name: string;
  application?: string;
  observations?: string;
};

/** Alta manual programas_subprogramas (matriz DNP aplanada). */
export type CreateProgramInput = {
  codigo_sector: string;
  nombre_sector?: string;
  codigo_programa: string;
  nombre_programa: string;
  ambito_aplicacion?: string;
  codigo_subprograma: string;
  nombre_subprograma: string;
  observaciones?: string;
};

/** Alta/edición productos — 24 campos exactos MGA. */
export type CreateProductInput = {
  sector: string;
  nombre_del_sector: string;
  codigo_del_programa: string;
  nombre_del_programa: string;
  codigo_del_producto: string;
  producto: string;
  descripcion: string;
  medido_a_traves_de: string;
  codigo_del_indicador_de_producto: string;
  indicador_de_producto: string;
  unidad_de_medida: string;
  indicador_principal: boolean;
  es_nacional: boolean;
  es_territorial: boolean;
  objetivos_de_desarrollo_sostenible_ods: string;
  meta_ods: string;
  tipologia_general_suifp: string;
  tipologia_d: boolean;
  tipologia_e: boolean;
  tipologia_a: boolean;
  tipologia_b: boolean;
  tipologia_c: boolean;
  tiene_edt: boolean;
  edt: string;
};

/** Fila del catálogo EDT (matriz de entregables / actividades). */
export type CatalogEdt = {
  id: string;
  tenant_id?: string | null;
  codigo_producto_estandarizado: string;
  nombre_producto: string;
  codigo_entregable_l1: string;
  nombre_entregable_l1: string;
  codigo_entregable_l2: string;
  nombre_entregable_l2: string;
  codigo_entregable_l3: string;
  nombre_entregable_l3: string;
  codigo_actividad: string;
  actividad: string;
  unidad_de_medida: string;
  created_at?: string;
};

type PaginatedCatalogEdt = {
  data: CatalogEdt[];
  meta: CatalogPageMeta;
};

/** Fila del catálogo de entregables (lista DNP). */
export type CatalogDeliverable = {
  id: string;
  tenant_id?: string | null;
  codigo_entregable: string;
  listado_de_entregables: string;
  created_at?: string;
};

type PaginatedCatalogDeliverables = {
  data: CatalogDeliverable[];
  meta: CatalogPageMeta;
};

/** Fila del catálogo de actividades (lista DNP). */
export type CatalogActivity = {
  id: string;
  tenant_id?: string | null;
  codigo_actividad: string;
  listado_de_actividades: string;
  unidad_de_medida: string;
  created_at?: string;
};

type PaginatedCatalogActivities = {
  data: CatalogActivity[];
  meta: CatalogPageMeta;
};

/** Fila del catálogo ODS (objetivo + meta). */
export type CatalogOds = {
  id: string;
  tenant_id?: string | null;
  cod_objetivo_ods: string;
  descripcion_objetivo_ods: string;
  codigo_meta_ods: string;
  descripcion_meta_ods: string;
  created_at?: string;
};

type PaginatedCatalogOds = {
  data: CatalogOds[];
  meta: CatalogPageMeta;
};

export type CopilotCatalogTarget =
  | 'ods'
  | 'products'
  | 'sectors'
  | 'programs'
  | 'edt'
  | 'deliverables'
  | 'activities';

type CatalogState = {
  sectors: CatalogSector[];
  sectorsMeta: CatalogPageMeta | null;
  programs: CatalogProgram[];
  programSubprograms: CatalogProgramSubprogram[];
  programsMeta: CatalogPageMeta | null;
  /** Sector cuyos programas están en `programs` (evita respuestas obsoletas). */
  programsSectorId: string | null;
  products: CatalogProduct[];
  catalogProducts: Product[];
  catalogProductsMeta: CatalogPageMeta | null;
  /** Programa cuyos productos están en `catalogProducts`. */
  catalogProductsProgramCode: string | null;
  catalogEdt: CatalogEdt[];
  catalogEdtMeta: CatalogPageMeta | null;
  catalogDeliverables: CatalogDeliverable[];
  catalogDeliverablesMeta: CatalogPageMeta | null;
  catalogActivities: CatalogActivity[];
  catalogActivitiesMeta: CatalogPageMeta | null;
  catalogOds: CatalogOds[];
  catalogOdsMeta: CatalogPageMeta | null;
  isLoading: boolean;
  /** Carga de programas por sector (wizard tenant /tenant/catalog). */
  isLoadingSectorPrograms: boolean;
  isLoadingPrograms: boolean;
  isLoadingProducts: boolean;
  isLoadingEdt: boolean;
  isLoadingDeliverables: boolean;
  isLoadingActivities: boolean;
  isLoadingOds: boolean;
  error: string | null;
  fetchSectors: (opts?: { page?: number; limit?: number; search?: string }) => Promise<void>;
  createSector: (input: CreateSectorInput) => Promise<CatalogSector>;
  importSectors: (file: File) => Promise<CatalogImportResult>;
  fetchProgramsBySector: (sectorId: string) => Promise<void>;
  fetchPrograms: (opts?: { page?: number; limit?: number; search?: string }) => Promise<void>;
  createProgram: (input: CreateProgramInput) => Promise<CatalogProgramSubprogram>;
  importPrograms: (file: File) => Promise<CatalogImportResult>;
  fetchCatalogProducts: (opts?: { page?: number; limit?: number; search?: string }) => Promise<void>;
  createProduct: (input: CreateProductInput) => Promise<Product>;
  updateProduct: (id: string, input: CreateProductInput) => Promise<Product>;
  deleteProduct: (id: string) => Promise<void>;
  importProducts: (file: File) => Promise<CatalogImportResult>;
  searchProducts: (query: string) => Promise<void>;
  fetchCatalogEdt: (opts?: { page?: number; limit?: number; search?: string }) => Promise<void>;
  importEdt: (file: File) => Promise<CatalogImportResult>;
  fetchCatalogDeliverables: (opts?: {
    page?: number;
    limit?: number;
    search?: string;
  }) => Promise<void>;
  importDeliverables: (file: File) => Promise<CatalogImportResult>;
  fetchCatalogActivities: (opts?: {
    page?: number;
    limit?: number;
    search?: string;
  }) => Promise<void>;
  importActivities: (file: File) => Promise<CatalogImportResult>;
  fetchCatalogOds: (opts?: { page?: number; limit?: number; search?: string }) => Promise<void>;
  importOds: (file: File) => Promise<CatalogImportResult>;
  clearPrograms: () => void;
  clearProducts: () => void;
  clearEdt: () => void;
  clearDeliverables: () => void;
  clearActivities: () => void;
  clearOds: () => void;
  clearError: () => void;
  copilotSearch: { catalog: CopilotCatalogTarget; query: string } | null;
  applyCopilotSearch: (catalog: CopilotCatalogTarget, query: string) => void;
  consumeCopilotSearch: (catalog: CopilotCatalogTarget) => void;
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

/** Normaliza respuesta API → 24 campos MGA del frontend. */
export function mapApiProductToMga(row: ApiCatalogProduct): Product {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    sector: row.sector ?? '',
    nombre_del_sector: row.nombre_sector ?? '',
    codigo_del_programa: row.codigo_programa ?? '',
    nombre_del_programa: row.nombre_programa ?? '',
    codigo_del_producto: row.codigo_producto ?? '',
    producto: row.producto ?? '',
    descripcion: row.descripcion ?? '',
    medido_a_traves_de: row.medido_a_traves_de ?? '',
    codigo_del_indicador_de_producto: row.codigo_indicador_producto ?? '',
    indicador_de_producto: row.indicador_producto ?? '',
    unidad_de_medida: row.unidad_de_medida ?? '',
    indicador_principal: Boolean(row.indicador_principal),
    es_nacional: Boolean(row.es_nacional),
    es_territorial: Boolean(row.es_territorial),
    objetivos_de_desarrollo_sostenible_ods: row.ods ?? '',
    meta_ods: row.meta_ods ?? '',
    tipologia_general_suifp: row.tipologia_general_suifp ?? '',
    tipologia_d: Boolean(row.tipologia_d),
    tipologia_e: Boolean(row.tipologia_e),
    tipologia_a: Boolean(row.tipologia_a_piip),
    tipologia_b: Boolean(row.tipologia_b_piip),
    tipologia_c: Boolean(row.tipologia_c_piip),
    tiene_edt: Boolean(row.tiene_edt),
    edt: row.edt ?? '',
    created_at: row.created_at,
  };
}

/** Mapea formulario MGA → payload del backend. */
function mapMgaProductToApi(input: CreateProductInput) {
  return {
    sector: input.sector.trim(),
    nombre_sector: input.nombre_del_sector.trim(),
    codigo_programa: input.codigo_del_programa.trim(),
    nombre_programa: input.nombre_del_programa.trim(),
    codigo_producto: input.codigo_del_producto.trim(),
    producto: input.producto.trim(),
    descripcion: input.descripcion.trim(),
    medido_a_traves_de: input.medido_a_traves_de.trim(),
    codigo_indicador_producto: input.codigo_del_indicador_de_producto.trim(),
    indicador_producto: input.indicador_de_producto.trim(),
    unidad_de_medida: input.unidad_de_medida.trim(),
    indicador_principal: input.indicador_principal,
    es_nacional: input.es_nacional,
    es_territorial: input.es_territorial,
    ods: input.objetivos_de_desarrollo_sostenible_ods.trim(),
    meta_ods: input.meta_ods.trim(),
    tipologia_general_suifp: input.tipologia_general_suifp.trim(),
    tipologia_d: input.tipologia_d,
    tipologia_e: input.tipologia_e,
    tipologia_a_piip: input.tipologia_a,
    tipologia_b_piip: input.tipologia_b,
    tipologia_c_piip: input.tipologia_c,
    tiene_edt: input.tiene_edt,
    edt: input.edt.trim(),
  };
}

export const useCatalogStore = create<CatalogState>((set) => ({
  sectors: [],
  sectorsMeta: null,
  programs: [],
  programSubprograms: [],
  programsMeta: null,
  programsSectorId: null,
  products: [],
  catalogProducts: [],
  catalogProductsMeta: null,
  catalogProductsProgramCode: null,
  catalogEdt: [],
  catalogEdtMeta: null,
  catalogDeliverables: [],
  catalogDeliverablesMeta: null,
  catalogActivities: [],
  catalogActivitiesMeta: null,
  catalogOds: [],
  catalogOdsMeta: null,
  isLoading: false,
  isLoadingSectorPrograms: false,
  isLoadingPrograms: false,
  isLoadingProducts: false,
  isLoadingEdt: false,
  isLoadingDeliverables: false,
  isLoadingActivities: false,
  isLoadingOds: false,
  error: null,
  copilotSearch: null,

  clearError: () => set({ error: null }),
  applyCopilotSearch: (catalog, query) =>
    set({ copilotSearch: { catalog, query: query.trim() } }),
  consumeCopilotSearch: (catalog) =>
    set((s) => (s.copilotSearch?.catalog === catalog ? { copilotSearch: null } : {})),
  clearPrograms: () =>
    set({
      programs: [],
      programSubprograms: [],
      programsMeta: null,
      programsSectorId: null,
    }),
  clearProducts: () =>
    set({
      products: [],
      catalogProducts: [],
      catalogProductsMeta: null,
      catalogProductsProgramCode: null,
    }),
  clearEdt: () => set({ catalogEdt: [], catalogEdtMeta: null }),
  clearDeliverables: () => set({ catalogDeliverables: [], catalogDeliverablesMeta: null }),
  clearActivities: () => set({ catalogActivities: [], catalogActivitiesMeta: null }),
  clearOds: () => set({ catalogOds: [], catalogOdsMeta: null }),

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
      set({
        programs: [],
        programsSectorId: null,
        isLoadingSectorPrograms: false,
      });
      return;
    }

    set({
      isLoadingSectorPrograms: true,
      error: null,
      programs: [],
      programsSectorId: sectorId,
    });

    try {
      const { data } = await api.get<CatalogProgram[]>(
        `/catalog/sectors/${sectorId}/programs`,
      );
      const programs = Array.isArray(data) ? data : [];
      set((state) => {
        if (state.programsSectorId !== sectorId) {
          return { isLoadingSectorPrograms: false };
        }
        return {
          programs,
          isLoadingSectorPrograms: false,
        };
      });
    } catch (err) {
      set((state) => {
        if (state.programsSectorId !== sectorId) {
          return { isLoadingSectorPrograms: false };
        }
        return {
          isLoadingSectorPrograms: false,
          error: extractError(err, 'No se pudieron cargar los programas del sector'),
          programs: [],
        };
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

  createProgram: async (input) => {
    try {
      const { data } = await api.post<CatalogProgramSubprogram>('/catalog/programs', {
        codigo_sector: input.codigo_sector.trim(),
        nombre_sector: input.nombre_sector?.trim() ?? '',
        codigo_programa: input.codigo_programa.trim(),
        nombre_programa: input.nombre_programa.trim(),
        ambito_aplicacion: input.ambito_aplicacion?.trim() ?? '',
        codigo_subprograma: input.codigo_subprograma.trim(),
        nombre_subprograma: input.nombre_subprograma.trim(),
        observaciones: input.observaciones?.trim() ?? '',
      });
      return data;
    } catch (err) {
      throw new Error(extractError(err, 'No se pudo crear el programa/subprograma'));
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

  fetchCatalogProducts: async (opts) => {
    const programCode = opts?.search?.trim() ?? '';
    set({
      isLoadingProducts: true,
      error: null,
      catalogProducts: [],
      catalogProductsProgramCode: programCode || null,
    });
    try {
      const { data } = await api.get<PaginatedCatalogProducts>('/catalog/products', {
        params: {
          page: opts?.page ?? 1,
          limit: opts?.limit ?? CATALOG_FULL_LIST_LIMIT,
          search: programCode || undefined,
        },
      });
      const products = (data.data ?? []).map(mapApiProductToMga);
      set((state) => {
        if (state.catalogProductsProgramCode !== (programCode || null)) {
          return { isLoadingProducts: false };
        }
        return {
          catalogProducts: products,
          catalogProductsMeta: data.meta ?? null,
          isLoadingProducts: false,
        };
      });
    } catch (err) {
      set((state) => {
        if (state.catalogProductsProgramCode !== (programCode || null)) {
          return { isLoadingProducts: false };
        }
        return {
          isLoadingProducts: false,
          error: extractError(err, 'No se pudieron cargar los productos'),
          catalogProducts: [],
          catalogProductsMeta: null,
        };
      });
    }
  },

  createProduct: async (input) => {
    try {
      const { data } = await api.post<ApiCatalogProduct>(
        '/catalog/products',
        mapMgaProductToApi(input),
      );
      return mapApiProductToMga(data);
    } catch (err) {
      throw new Error(extractError(err, 'No se pudo crear el producto'));
    }
  },

  updateProduct: async (id, input) => {
    try {
      const { data } = await api.put<ApiCatalogProduct>(
        `/catalog/products/${id}`,
        mapMgaProductToApi(input),
      );
      return mapApiProductToMga(data);
    } catch (err) {
      throw new Error(extractError(err, 'No se pudo actualizar el producto'));
    }
  },

  deleteProduct: async (id) => {
    try {
      await api.delete(`/catalog/products/${id}`);
    } catch (err) {
      throw new Error(extractError(err, 'No se pudo eliminar el producto'));
    }
  },

  importProducts: async (file) => {
    const form = new FormData();
    form.append('file', file);
    try {
      const { data } = await api.post<CatalogImportResult>('/catalog/products/import', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000,
      });
      return data;
    } catch (err) {
      throw new Error(extractError(err, 'No se pudo importar el archivo de productos'));
    }
  },

  searchProducts: async (query) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get<PaginatedProducts>('/catalog/products/search', {
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

  fetchCatalogEdt: async (opts) => {
    set({ isLoadingEdt: true, error: null });
    try {
      const { data } = await api.get<PaginatedCatalogEdt>('/catalog/edt', {
        params: {
          page: opts?.page ?? 1,
          limit: opts?.limit ?? 10,
          search: opts?.search?.trim() || undefined,
        },
      });
      set({
        catalogEdt: data.data ?? [],
        catalogEdtMeta: data.meta ?? null,
        isLoadingEdt: false,
      });
    } catch (err) {
      set({
        isLoadingEdt: false,
        error: extractError(err, 'No se pudo cargar el catálogo EDT'),
        catalogEdt: [],
        catalogEdtMeta: null,
      });
    }
  },

  importEdt: async (file) => {
    const form = new FormData();
    form.append('file', file);
    try {
      const { data } = await api.post<CatalogImportResult>('/catalog/edt/import', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000,
      });
      return data;
    } catch (err) {
      throw new Error(extractError(err, 'No se pudo importar el archivo EDT'));
    }
  },

  fetchCatalogDeliverables: async (opts) => {
    set({ isLoadingDeliverables: true, error: null });
    try {
      const { data } = await api.get<PaginatedCatalogDeliverables>('/catalog/deliverables', {
        params: {
          page: opts?.page ?? 1,
          limit: opts?.limit ?? 10,
          search: opts?.search?.trim() || undefined,
        },
      });
      set({
        catalogDeliverables: data.data ?? [],
        catalogDeliverablesMeta: data.meta ?? null,
        isLoadingDeliverables: false,
      });
    } catch (err) {
      set({
        isLoadingDeliverables: false,
        error: extractError(err, 'No se pudo cargar el catálogo de entregables'),
        catalogDeliverables: [],
        catalogDeliverablesMeta: null,
      });
    }
  },

  importDeliverables: async (file) => {
    const form = new FormData();
    form.append('file', file);
    try {
      const { data } = await api.post<CatalogImportResult>('/catalog/deliverables/import', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000,
      });
      return data;
    } catch (err) {
      throw new Error(extractError(err, 'No se pudo importar el archivo de entregables'));
    }
  },

  fetchCatalogActivities: async (opts) => {
    set({ isLoadingActivities: true, error: null });
    try {
      const { data } = await api.get<PaginatedCatalogActivities>('/catalog/activities', {
        params: {
          page: opts?.page ?? 1,
          limit: opts?.limit ?? 10,
          search: opts?.search?.trim() || undefined,
        },
      });
      set({
        catalogActivities: data.data ?? [],
        catalogActivitiesMeta: data.meta ?? null,
        isLoadingActivities: false,
      });
    } catch (err) {
      set({
        isLoadingActivities: false,
        error: extractError(err, 'No se pudo cargar la lista de actividades'),
        catalogActivities: [],
        catalogActivitiesMeta: null,
      });
    }
  },

  importActivities: async (file) => {
    const form = new FormData();
    form.append('file', file);
    try {
      const { data } = await api.post<CatalogImportResult>('/catalog/activities/import', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000,
      });
      return data;
    } catch (err) {
      throw new Error(extractError(err, 'No se pudo importar el archivo de actividades'));
    }
  },

  fetchCatalogOds: async (opts) => {
    set({ isLoadingOds: true, error: null });
    try {
      const { data } = await api.get<PaginatedCatalogOds>('/catalog/ods', {
        params: {
          page: opts?.page ?? 1,
          limit: opts?.limit ?? 10,
          search: opts?.search?.trim() || undefined,
        },
      });
      set({
        catalogOds: data.data ?? [],
        catalogOdsMeta: data.meta ?? null,
        isLoadingOds: false,
      });
    } catch (err) {
      set({
        isLoadingOds: false,
        error: extractError(err, 'No se pudo cargar el catálogo ODS'),
        catalogOds: [],
        catalogOdsMeta: null,
      });
    }
  },

  importOds: async (file) => {
    const form = new FormData();
    form.append('file', file);
    try {
      const { data } = await api.post<CatalogImportResult>('/catalog/ods/import', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000,
      });
      return data;
    } catch (err) {
      throw new Error(extractError(err, 'No se pudo importar el archivo ODS'));
    }
  },
}));
