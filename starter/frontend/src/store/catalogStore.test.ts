import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { act } from '@testing-library/react';
import { apiUrl, errorResponse, server } from '../test/server';
import {
  mapApiProductToMga,
  useCatalogStore,
  type CreateProductInput,
  type CopilotCatalogTarget,
} from './catalogStore';

const initialState = useCatalogStore.getState();
const store = () => useCatalogStore.getState();

beforeEach(() => {
  useCatalogStore.setState(initialState, true);
});

const apiProduct = {
  id: 'p-1',
  tenant_id: null,
  sector: '40',
  nombre_sector: 'Transporte',
  codigo_programa: '4001',
  nombre_programa: 'Infraestructura vial',
  codigo_producto: '4001001',
  producto: 'Vía terciaria mejorada',
  descripcion: 'Descripción',
  medido_a_traves_de: 'Kilómetros',
  codigo_indicador_producto: 'IND-1',
  indicador_producto: 'Km mejorados',
  unidad_de_medida: 'Km',
  indicador_principal: true,
  es_nacional: true,
  es_territorial: false,
  ods: '9',
  meta_ods: '9.1',
  tipologia_general_suifp: 'A',
  tipologia_d: false,
  tipologia_e: false,
  tipologia_a_piip: true,
  tipologia_b_piip: false,
  tipologia_c_piip: false,
  tiene_edt: true,
  edt: 'EDT-1',
  created_at: '2026-01-01T00:00:00Z',
};

const productInput: CreateProductInput = {
  sector: ' 40 ',
  nombre_del_sector: ' Transporte ',
  codigo_del_programa: ' 4001 ',
  nombre_del_programa: ' Infraestructura vial ',
  codigo_del_producto: ' 4001001 ',
  producto: ' Vía terciaria mejorada ',
  descripcion: ' Descripción ',
  medido_a_traves_de: ' Kilómetros ',
  codigo_del_indicador_de_producto: ' IND-1 ',
  indicador_de_producto: ' Km mejorados ',
  unidad_de_medida: ' Km ',
  indicador_principal: true,
  es_nacional: true,
  es_territorial: false,
  objetivos_de_desarrollo_sostenible_ods: ' 9 ',
  meta_ods: ' 9.1 ',
  tipologia_general_suifp: ' A ',
  tipologia_d: false,
  tipologia_e: false,
  tipologia_a: true,
  tipologia_b: false,
  tipologia_c: false,
  tiene_edt: true,
  edt: ' EDT-1 ',
};

const meta = { total: 1, page: 1, limit: 10, last_page: 1 };

describe('catalogStore — integración con Aurora Copilot', () => {
  it('applyCopilotSearch normaliza la query y fija el catálogo destino', () => {
    act(() => store().applyCopilotSearch('edt', '  E-100  '));
    expect(store().copilotSearch).toEqual({ catalog: 'edt', query: 'E-100' });
  });

  it('Action Card: el código sugerido por Aurora llega al filtro del catálogo activo', () => {
    // Replica el contrato de AuroraCopilot.onApplyAction:
    // applyCopilotSearch(card.catalog, card.code || card.label)
    const actionCard = {
      catalog: 'ods' as const,
      code: '6.1',
      label: 'Agua limpia y saneamiento',
      description: 'Meta ODS para acueducto',
    };

    act(() => store().applyCopilotSearch(actionCard.catalog, actionCard.code || actionCard.label));

    expect(store().copilotSearch).toEqual({
      catalog: 'ods',
      query: '6.1',
    });
  });

  it('Action Card: usa el label cuando el código viene vacío', () => {
    const cardCode = '';
    const cardLabel = 'Vía terciaria mejorada';
    const query = cardCode.length > 0 ? cardCode : cardLabel;

    act(() => store().applyCopilotSearch('products', query));

    expect(store().copilotSearch).toEqual({
      catalog: 'products',
      query: 'Vía terciaria mejorada',
    });
  });

  it('applyCopilotSearch sobreescribe una búsqueda anterior', () => {
    act(() => store().applyCopilotSearch('ods', '1.1'));
    act(() => store().applyCopilotSearch('products', 'P-9'));
    expect(store().copilotSearch).toEqual({ catalog: 'products', query: 'P-9' });
  });

  it('consumeCopilotSearch limpia solo el catálogo que la consumió', () => {
    act(() => store().applyCopilotSearch('ods', '1.1'));

    act(() => store().consumeCopilotSearch('products'));
    expect(store().copilotSearch).toEqual({ catalog: 'ods', query: '1.1' });

    act(() => store().consumeCopilotSearch('ods'));
    expect(store().copilotSearch).toBeNull();
  });

  it('consumeCopilotSearch sin búsqueda pendiente es idempotente', () => {
    act(() => store().consumeCopilotSearch('ods'));
    expect(store().copilotSearch).toBeNull();
  });

  it.each<CopilotCatalogTarget>(['ods', 'products', 'sectors', 'programs', 'edt', 'deliverables', 'activities'])(
    'acepta el catálogo %s como destino',
    (catalog) => {
      act(() => store().applyCopilotSearch(catalog, 'x'));
      expect(store().copilotSearch?.catalog).toBe(catalog);
    },
  );
});

describe('catalogStore — fetchSectors', () => {
  it('acepta una respuesta paginada', async () => {
    server.use(
      http.get(apiUrl('/catalog/sectors'), () =>
        HttpResponse.json({ data: [{ id: 's1', code: '40', name: 'Transporte' }], meta }),
      ),
    );

    await act(async () => {
      await store().fetchSectors();
    });

    expect(store().sectors).toHaveLength(1);
    expect(store().sectorsMeta).toEqual(meta);
    expect(store().isLoading).toBe(false);
    expect(store().error).toBeNull();
  });

  it('acepta una respuesta como array plano', async () => {
    server.use(
      http.get(apiUrl('/catalog/sectors'), () =>
        HttpResponse.json([{ id: 's1', code: '40', name: 'Transporte' }]),
      ),
    );

    await act(async () => {
      await store().fetchSectors();
    });

    expect(store().sectors).toHaveLength(1);
    expect(store().sectorsMeta).toBeNull();
  });

  it('devuelve lista vacía ante un payload inesperado', async () => {
    server.use(http.get(apiUrl('/catalog/sectors'), () => HttpResponse.json({ unexpected: true })));

    await act(async () => {
      await store().fetchSectors();
    });

    expect(store().sectors).toEqual([]);
    expect(store().sectorsMeta).toBeNull();
  });

  it('envía los parámetros de paginación y búsqueda normalizados', async () => {
    let received: URLSearchParams | null = null;
    server.use(
      http.get(apiUrl('/catalog/sectors'), ({ request }) => {
        received = new URL(request.url).searchParams;
        return HttpResponse.json({ data: [], meta });
      }),
    );

    await act(async () => {
      await store().fetchSectors({ page: 3, limit: 50, search: '  vial  ' });
    });

    expect(received!.get('page')).toBe('3');
    expect(received!.get('limit')).toBe('50');
    expect(received!.get('search')).toBe('vial');
  });

  it('omite el parámetro search cuando está vacío', async () => {
    let received: URLSearchParams | null = null;
    server.use(
      http.get(apiUrl('/catalog/sectors'), ({ request }) => {
        received = new URL(request.url).searchParams;
        return HttpResponse.json({ data: [], meta });
      }),
    );

    await act(async () => {
      await store().fetchSectors({ search: '   ' });
    });

    expect(received!.has('search')).toBe(false);
    expect(received!.get('page')).toBe('1');
    expect(received!.get('limit')).toBe('20');
  });

  it('registra el error del backend y limpia los datos', async () => {
    server.use(
      http.get(apiUrl('/catalog/sectors'), () => errorResponse(500, 'sectores caídos')),
    );

    useCatalogStore.setState({ sectors: [{ id: 'viejo', code: '1', name: 'Previo' }] });

    await act(async () => {
      await store().fetchSectors();
    });

    expect(store().error).toBe('sectores caídos');
    expect(store().sectors).toEqual([]);
    expect(store().sectorsMeta).toBeNull();
    expect(store().isLoading).toBe(false);
  });

  it('usa el mensaje de fallback si el error no es estructurado', async () => {
    server.use(
      http.get(apiUrl('/catalog/sectors'), () => new HttpResponse('nope', { status: 500 })),
    );

    await act(async () => {
      await store().fetchSectors();
    });

    expect(store().error).toBe('No se pudieron cargar los sectores');
  });
});

describe('catalogStore — programas', () => {
  it('fetchProgramsBySector sin id limpia la lista sin llamar al API', async () => {
    useCatalogStore.setState({ programs: [{ id: 'p', sector_id: 's', code: 'c', name: 'n' }] });

    await act(async () => {
      await store().fetchProgramsBySector('');
    });

    expect(store().programs).toEqual([]);
    expect(store().isLoadingSectorPrograms).toBe(false);
  });

  it('fetchProgramsBySector activa el flag de carga del sector', async () => {
    let resolve!: () => void;
    const gate = new Promise<void>((r) => {
      resolve = r;
    });

    server.use(
      http.get(apiUrl('/catalog/sectors/s-1/programs'), async () => {
        await gate;
        return HttpResponse.json([]);
      }),
    );

    const pending = store().fetchProgramsBySector('s-1');
    expect(store().isLoadingSectorPrograms).toBe(true);
    expect(store().programs).toEqual([]);

    resolve();
    await act(async () => {
      await pending;
    });

    expect(store().isLoadingSectorPrograms).toBe(false);
  });

  it('fetchProgramsBySector carga los programas del sector', async () => {
    server.use(
      http.get(apiUrl('/catalog/sectors/s-1/programs'), () =>
        HttpResponse.json([{ id: 'pr-1', sector_id: 's-1', code: '4001', name: 'Vial' }]),
      ),
    );

    await act(async () => {
      await store().fetchProgramsBySector('s-1');
    });

    expect(store().programs).toHaveLength(1);
    expect(store().error).toBeNull();
  });

  it('fetchProgramsBySector tolera un payload que no es array', async () => {
    server.use(
      http.get(apiUrl('/catalog/sectors/s-1/programs'), () => HttpResponse.json({ nope: 1 })),
    );

    await act(async () => {
      await store().fetchProgramsBySector('s-1');
    });

    expect(store().programs).toEqual([]);
  });

  it('fetchProgramsBySector registra el error', async () => {
    server.use(
      http.get(apiUrl('/catalog/sectors/s-1/programs'), () => errorResponse(404, 'sector inexistente')),
    );

    await act(async () => {
      await store().fetchProgramsBySector('s-1');
    });

    expect(store().error).toBe('sector inexistente');
    expect(store().programs).toEqual([]);
  });

  it('fetchPrograms usa su propio flag de carga', async () => {
    server.use(
      http.get(apiUrl('/catalog/programs'), () =>
        HttpResponse.json({ data: [{ id: 'ps-1' }], meta }),
      ),
    );

    await act(async () => {
      await store().fetchPrograms({ page: 2 });
    });

    expect(store().programSubprograms).toHaveLength(1);
    expect(store().programsMeta).toEqual(meta);
    expect(store().isLoadingPrograms).toBe(false);
  });

  it('fetchPrograms tolera respuesta sin data ni meta', async () => {
    server.use(http.get(apiUrl('/catalog/programs'), () => HttpResponse.json({})));

    await act(async () => {
      await store().fetchPrograms();
    });

    expect(store().programSubprograms).toEqual([]);
    expect(store().programsMeta).toBeNull();
  });

  it('fetchPrograms registra el error', async () => {
    server.use(http.get(apiUrl('/catalog/programs'), () => errorResponse(500, 'programas caídos')));

    await act(async () => {
      await store().fetchPrograms();
    });

    expect(store().error).toBe('programas caídos');
    expect(store().isLoadingPrograms).toBe(false);
  });

  it('createProgram recorta los campos y devuelve la fila creada', async () => {
    let body: Record<string, string> | null = null;
    server.use(
      http.post(apiUrl('/catalog/programs'), async ({ request }) => {
        body = (await request.json()) as Record<string, string>;
        return HttpResponse.json({ id: 'ps-nuevo' });
      }),
    );

    let created: unknown;
    await act(async () => {
      created = await store().createProgram({
        codigo_sector: ' 40 ',
        codigo_programa: ' 4001 ',
        nombre_programa: ' Vial ',
        codigo_subprograma: ' 400101 ',
        nombre_subprograma: ' Terciaria ',
      });
    });

    expect(created).toEqual({ id: 'ps-nuevo' });
    expect(body).toMatchObject({
      codigo_sector: '40',
      nombre_sector: '',
      codigo_programa: '4001',
      ambito_aplicacion: '',
      observaciones: '',
    });
  });

  it('createProgram lanza un Error con el mensaje del backend', async () => {
    server.use(http.post(apiUrl('/catalog/programs'), () => errorResponse(409, 'código duplicado')));

    await expect(
      store().createProgram({
        codigo_sector: '40',
        codigo_programa: '4001',
        nombre_programa: 'Vial',
        codigo_subprograma: '400101',
        nombre_subprograma: 'Terciaria',
      }),
    ).rejects.toThrow('código duplicado');
  });
});

describe('catalogStore — productos', () => {
  it('mapApiProductToMga normaliza los 24 campos MGA', () => {
    const mapped = mapApiProductToMga(apiProduct);

    expect(mapped).toMatchObject({
      id: 'p-1',
      nombre_del_sector: 'Transporte',
      codigo_del_producto: '4001001',
      codigo_del_indicador_de_producto: 'IND-1',
      objetivos_de_desarrollo_sostenible_ods: '9',
      tipologia_a: true,
      tipologia_b: false,
      tiene_edt: true,
    });
  });

  it('mapApiProductToMga rellena con vacíos y booleanos falsos los campos ausentes', () => {
    const mapped = mapApiProductToMga({ id: 'p-2' } as unknown as typeof apiProduct);

    expect(mapped.sector).toBe('');
    expect(mapped.nombre_del_sector).toBe('');
    expect(mapped.edt).toBe('');
    expect(mapped.indicador_principal).toBe(false);
    expect(mapped.tipologia_c).toBe(false);
  });

  it('fetchCatalogProducts usa CATALOG_FULL_LIST_LIMIT por defecto', async () => {
    let received: URLSearchParams | null = null;
    server.use(
      http.get(apiUrl('/catalog/products'), ({ request }) => {
        received = new URL(request.url).searchParams;
        return HttpResponse.json({ data: [], meta });
      }),
    );

    await act(async () => {
      await store().fetchCatalogProducts({ search: '4001' });
    });

    expect(received!.get('limit')).toBe('5000');
    expect(received!.get('search')).toBe('4001');
  });

  it('fetchCatalogProducts mapea el payload del backend', async () => {
    server.use(
      http.get(apiUrl('/catalog/products'), () =>
        HttpResponse.json({ data: [apiProduct], meta }),
      ),
    );

    await act(async () => {
      await store().fetchCatalogProducts({ page: 1, limit: 10, search: 'vial' });
    });

    expect(store().catalogProducts).toHaveLength(1);
    expect(store().catalogProducts[0].nombre_del_programa).toBe('Infraestructura vial');
    expect(store().catalogProductsMeta).toEqual(meta);
    expect(store().isLoadingProducts).toBe(false);
  });

  it('fetchCatalogProducts registra el error y vacía el listado', async () => {
    server.use(http.get(apiUrl('/catalog/products'), () => errorResponse(500, 'productos caídos')));

    await act(async () => {
      await store().fetchCatalogProducts();
    });

    expect(store().error).toBe('productos caídos');
    expect(store().catalogProducts).toEqual([]);
    expect(store().catalogProductsMeta).toBeNull();
  });

  it('createProduct convierte el formulario MGA al payload del API', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(apiUrl('/catalog/products'), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(apiProduct);
      }),
    );

    let created: unknown;
    await act(async () => {
      created = await store().createProduct(productInput);
    });

    expect(body).toMatchObject({
      sector: '40',
      nombre_sector: 'Transporte',
      codigo_indicador_producto: 'IND-1',
      ods: '9',
      tipologia_a_piip: true,
      tipologia_b_piip: false,
      edt: 'EDT-1',
    });
    expect(created).toMatchObject({ id: 'p-1', codigo_del_producto: '4001001' });
  });

  it('createProduct lanza el error del backend', async () => {
    server.use(http.post(apiUrl('/catalog/products'), () => errorResponse(400, 'producto inválido')));
    await expect(store().createProduct(productInput)).rejects.toThrow('producto inválido');
  });

  it('updateProduct envía PUT y devuelve la fila mapeada', async () => {
    server.use(
      http.put(apiUrl('/catalog/products/p-1'), () => HttpResponse.json(apiProduct)),
    );

    let updated: unknown;
    await act(async () => {
      updated = await store().updateProduct('p-1', productInput);
    });

    expect(updated).toMatchObject({ id: 'p-1' });
  });

  it('updateProduct lanza el error del backend', async () => {
    server.use(http.put(apiUrl('/catalog/products/p-1'), () => errorResponse(404, 'no existe')));
    await expect(store().updateProduct('p-1', productInput)).rejects.toThrow('no existe');
  });

  it('deleteProduct resuelve sin error', async () => {
    server.use(http.delete(apiUrl('/catalog/products/p-1'), () => new HttpResponse(null, { status: 204 })));
    await expect(store().deleteProduct('p-1')).resolves.toBeUndefined();
  });

  it('deleteProduct lanza el error del backend', async () => {
    server.use(http.delete(apiUrl('/catalog/products/p-1'), () => errorResponse(403, 'sin permisos')));
    await expect(store().deleteProduct('p-1')).rejects.toThrow('sin permisos');
  });

  it('searchProducts consulta el endpoint de búsqueda', async () => {
    let params: URLSearchParams | null = null;
    server.use(
      http.get(apiUrl('/catalog/products/search'), ({ request }) => {
        params = new URL(request.url).searchParams;
        return HttpResponse.json({ data: [{ id: 'pp-1', program_id: 'x', code: 'c', name: 'n' }] });
      }),
    );

    await act(async () => {
      await store().searchProducts('  vía  ');
    });

    expect(params!.get('q')).toBe('vía');
    expect(params!.get('page_size')).toBe('50');
    expect(store().products).toHaveLength(1);
    expect(store().isLoading).toBe(false);
  });

  it('searchProducts registra el error', async () => {
    server.use(
      http.get(apiUrl('/catalog/products/search'), () => errorResponse(500, 'búsqueda caída')),
    );

    await act(async () => {
      await store().searchProducts('x');
    });

    expect(store().error).toBe('búsqueda caída');
    expect(store().products).toEqual([]);
  });
});

describe('catalogStore — catálogos EDT, entregables, actividades y ODS', () => {
  const cases = [
    {
      name: 'EDT',
      path: '/catalog/edt',
      fetch: () => store().fetchCatalogEdt(),
      rows: () => store().catalogEdt,
      metaOf: () => store().catalogEdtMeta,
      loading: () => store().isLoadingEdt,
      fallback: 'No se pudo cargar el catálogo EDT',
    },
    {
      name: 'entregables',
      path: '/catalog/deliverables',
      fetch: () => store().fetchCatalogDeliverables(),
      rows: () => store().catalogDeliverables,
      metaOf: () => store().catalogDeliverablesMeta,
      loading: () => store().isLoadingDeliverables,
      fallback: 'No se pudo cargar el catálogo de entregables',
    },
    {
      name: 'actividades',
      path: '/catalog/activities',
      fetch: () => store().fetchCatalogActivities(),
      rows: () => store().catalogActivities,
      metaOf: () => store().catalogActivitiesMeta,
      loading: () => store().isLoadingActivities,
      fallback: 'No se pudo cargar la lista de actividades',
    },
    {
      name: 'ODS',
      path: '/catalog/ods',
      fetch: () => store().fetchCatalogOds(),
      rows: () => store().catalogOds,
      metaOf: () => store().catalogOdsMeta,
      loading: () => store().isLoadingOds,
      fallback: 'No se pudo cargar el catálogo ODS',
    },
  ];

  it.each(cases)('carga el catálogo de $name', async ({ path, fetch, rows, metaOf, loading }) => {
    server.use(http.get(apiUrl(path), () => HttpResponse.json({ data: [{ id: 'r-1' }], meta })));

    await act(async () => {
      await fetch();
    });

    expect(rows()).toHaveLength(1);
    expect(metaOf()).toEqual(meta);
    expect(loading()).toBe(false);
  });

  it.each(cases)('usa el fallback de error del catálogo de $name', async ({ path, fetch, rows, loading, fallback }) => {
    server.use(http.get(apiUrl(path), () => new HttpResponse('boom', { status: 500 })));

    await act(async () => {
      await fetch();
    });

    expect(store().error).toBe(fallback);
    expect(rows()).toEqual([]);
    expect(loading()).toBe(false);
  });

  it.each(cases)('tolera respuesta sin data ni meta en $name', async ({ path, fetch, rows, metaOf }) => {
    server.use(http.get(apiUrl(path), () => HttpResponse.json({})));

    await act(async () => {
      await fetch();
    });

    expect(rows()).toEqual([]);
    expect(metaOf()).toBeNull();
  });
});

describe('catalogStore — importaciones masivas', () => {
  const file = () => new File(['contenido'], 'catalogo.xlsx', { type: 'application/vnd.ms-excel' });

  const imports = [
    { name: 'sectores', path: '/catalog/sectors/import', run: () => store().importSectors(file()), fallback: 'No se pudo importar el archivo de sectores' },
    { name: 'programas', path: '/catalog/programs/import', run: () => store().importPrograms(file()), fallback: 'No se pudo importar el archivo de programas' },
    { name: 'productos', path: '/catalog/products/import', run: () => store().importProducts(file()), fallback: 'No se pudo importar el archivo de productos' },
    { name: 'EDT', path: '/catalog/edt/import', run: () => store().importEdt(file()), fallback: 'No se pudo importar el archivo EDT' },
    { name: 'entregables', path: '/catalog/deliverables/import', run: () => store().importDeliverables(file()), fallback: 'No se pudo importar el archivo de entregables' },
    { name: 'actividades', path: '/catalog/activities/import', run: () => store().importActivities(file()), fallback: 'No se pudo importar el archivo de actividades' },
    { name: 'ODS', path: '/catalog/ods/import', run: () => store().importOds(file()), fallback: 'No se pudo importar el archivo ODS' },
  ];

  it.each(imports)('importa $name enviando multipart/form-data', async ({ path, run }) => {
    let contentType: string | null = null;
    let hasFileField = false;

    server.use(
      http.post(apiUrl(path), async ({ request }) => {
        contentType = request.headers.get('content-type');
        const form = await request.formData();
        hasFileField = form.has('file');
        return HttpResponse.json({
          status: 'ok',
          message: 'importado',
          inserted: 3,
          updated: 1,
          skipped: 0,
          total_rows_parsed: 4,
        });
      }),
    );

    const result = await run();

    expect(contentType).toContain('multipart/form-data');
    expect(hasFileField).toBe(true);
    expect(result).toMatchObject({ inserted: 3, updated: 1 });
  });

  it.each(imports)('propaga el error del backend al importar $name', async ({ path, run }) => {
    server.use(http.post(apiUrl(path), () => errorResponse(400, 'archivo inválido')));
    await expect(run()).rejects.toThrow('archivo inválido');
  });

  it.each(imports)('usa el fallback de $name cuando el error no es estructurado', async ({ path, run, fallback }) => {
    server.use(http.post(apiUrl(path), () => new HttpResponse('boom', { status: 500 })));
    await expect(run()).rejects.toThrow(fallback);
  });
});

describe('catalogStore — limpieza de estado', () => {
  it('createSector recorta los campos y devuelve el sector', async () => {
    let body: Record<string, string> | null = null;
    server.use(
      http.post(apiUrl('/catalog/sectors'), async ({ request }) => {
        body = (await request.json()) as Record<string, string>;
        return HttpResponse.json({ id: 's-1', code: '40', name: 'Transporte' });
      }),
    );

    const created = await store().createSector({ code: ' 40 ', name: ' Transporte ' });

    expect(body).toEqual({ code: '40', name: 'Transporte', application: '', observations: '' });
    expect(created).toMatchObject({ id: 's-1' });
  });

  it('createSector lanza el error del backend', async () => {
    server.use(http.post(apiUrl('/catalog/sectors'), () => errorResponse(409, 'sector duplicado')));
    await expect(store().createSector({ code: '40', name: 'X' })).rejects.toThrow('sector duplicado');
  });

  it('los clear* dejan cada colección vacía', () => {
    useCatalogStore.setState({
      programs: [{ id: 'p', sector_id: 's', code: 'c', name: 'n' }],
      programSubprograms: [{ id: 'ps' } as never],
      programsMeta: meta,
      products: [{ id: 'pr', program_id: 'x', code: 'c', name: 'n' }],
      catalogProducts: [mapApiProductToMga(apiProduct)],
      catalogProductsMeta: meta,
      catalogEdt: [{ id: 'e' } as never],
      catalogEdtMeta: meta,
      catalogDeliverables: [{ id: 'd' } as never],
      catalogDeliverablesMeta: meta,
      catalogActivities: [{ id: 'a' } as never],
      catalogActivitiesMeta: meta,
      catalogOds: [{ id: 'o' } as never],
      catalogOdsMeta: meta,
      error: 'algo falló',
    });

    act(() => {
      store().clearPrograms();
      store().clearProducts();
      store().clearEdt();
      store().clearDeliverables();
      store().clearActivities();
      store().clearOds();
      store().clearError();
    });

    const s = store();
    expect(s.programs).toEqual([]);
    expect(s.programSubprograms).toEqual([]);
    expect(s.programsMeta).toBeNull();
    expect(s.products).toEqual([]);
    expect(s.catalogProducts).toEqual([]);
    expect(s.catalogProductsMeta).toBeNull();
    expect(s.catalogEdt).toEqual([]);
    expect(s.catalogEdtMeta).toBeNull();
    expect(s.catalogDeliverables).toEqual([]);
    expect(s.catalogDeliverablesMeta).toBeNull();
    expect(s.catalogActivities).toEqual([]);
    expect(s.catalogActivitiesMeta).toBeNull();
    expect(s.catalogOds).toEqual([]);
    expect(s.catalogOdsMeta).toBeNull();
    expect(s.error).toBeNull();
  });
});
