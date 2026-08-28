import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { act } from '@testing-library/react';
import { apiUrl, errorResponse, server } from '../test/server';
import { useTenantStore, type Tenant } from './tenantStore';

const initialState = useTenantStore.getState();
const store = () => useTenantStore.getState();

beforeEach(() => {
  useTenantStore.setState(initialState, true);
});

const tenant = (overrides: Partial<Tenant> = {}): Tenant => ({
  id: 'tenant-1',
  name: 'Alcaldía de Prueba',
  contact_email: 'contacto@alcaldia.gov.co',
  status: 'ACTIVE',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('tenantStore — fetchTenants', () => {
  it('carga la lista paginada', async () => {
    server.use(
      http.get(apiUrl('/admin/tenants'), () =>
        HttpResponse.json({ data: [tenant()], page: 1, page_size: 100, total: 1, total_pages: 1 }),
      ),
    );

    await act(async () => {
      await store().fetchTenants();
    });

    expect(store().tenants).toHaveLength(1);
    expect(store().isLoading).toBe(false);
    expect(store().error).toBeNull();
  });

  it('marca isLoading durante la petición', async () => {
    server.use(
      http.get(apiUrl('/admin/tenants'), async () => {
        await delay(40);
        return HttpResponse.json({ data: [] });
      }),
    );

    let pending!: Promise<void>;
    act(() => {
      pending = store().fetchTenants();
    });
    expect(store().isLoading).toBe(true);

    await act(async () => {
      await pending;
    });
    expect(store().isLoading).toBe(false);
  });

  it('tolera respuesta sin data', async () => {
    server.use(http.get(apiUrl('/admin/tenants'), () => HttpResponse.json({})));

    await act(async () => {
      await store().fetchTenants();
    });

    expect(store().tenants).toEqual([]);
  });

  it('registra el error del backend', async () => {
    server.use(http.get(apiUrl('/admin/tenants'), () => errorResponse(403, 'insufficient role')));

    await act(async () => {
      await store().fetchTenants();
    });

    expect(store().error).toBe('insufficient role');
    expect(store().isLoading).toBe(false);
  });

  it('usa el fallback cuando el error no es estructurado', async () => {
    server.use(http.get(apiUrl('/admin/tenants'), () => new HttpResponse('boom', { status: 500 })));

    await act(async () => {
      await store().fetchTenants();
    });

    expect(store().error).toBe('No se pudieron cargar los tenants');
  });
});

describe('tenantStore — createTenant', () => {
  it('normaliza los campos y antepone el tenant creado', async () => {
    let body: Record<string, string> | null = null;
    server.use(
      http.post(apiUrl('/admin/tenants'), async ({ request }) => {
        body = (await request.json()) as Record<string, string>;
        return HttpResponse.json(tenant({ id: 'tenant-nuevo' }));
      }),
    );

    useTenantStore.setState({ tenants: [tenant({ id: 'tenant-viejo' })] });

    await act(async () => {
      await store().createTenant({
        name: '  Alcaldía  ',
        nit: '  900123456  ',
        contact_email: '  Contacto@Alcaldia.GOV.co  ',
        domain: '  Alcaldia.GOV.co  ',
      });
    });

    expect(body).toEqual({
      name: 'Alcaldía',
      nit: '900123456',
      contact_email: 'contacto@alcaldia.gov.co',
      domain: 'alcaldia.gov.co',
    });
    expect(store().tenants.map((t) => t.id)).toEqual(['tenant-nuevo', 'tenant-viejo']);
    expect(store().isLoading).toBe(false);
  });

  it('omite el dominio cuando llega vacío', async () => {
    let body: Record<string, string> | null = null;
    server.use(
      http.post(apiUrl('/admin/tenants'), async ({ request }) => {
        body = (await request.json()) as Record<string, string>;
        return HttpResponse.json(tenant());
      }),
    );

    await act(async () => {
      await store().createTenant({ name: 'A', nit: '1', contact_email: 'a@b.co', domain: '   ' });
    });

    expect(body).not.toHaveProperty('domain');
  });

  it('lanza el error del backend', async () => {
    server.use(http.post(apiUrl('/admin/tenants'), () => errorResponse(409, 'NIT ya registrado')));

    await expect(
      store().createTenant({ name: 'A', nit: '1', contact_email: 'a@b.co' }),
    ).rejects.toThrow('NIT ya registrado');
    expect(store().error).toBe('NIT ya registrado');
    expect(store().isLoading).toBe(false);
  });
});

describe('tenantStore — toggleTenantStatus', () => {
  it.each([
    { current: 'ACTIVE' as const, expected: 'SUSPENDED' },
    { current: 'SUSPENDED' as const, expected: 'ACTIVE' },
  ])('alterna $current → $expected', async ({ current, expected }) => {
    let body: Record<string, string> | null = null;
    server.use(
      http.patch(apiUrl('/admin/tenants/tenant-1/status'), async ({ request }) => {
        body = (await request.json()) as Record<string, string>;
        return HttpResponse.json(tenant({ status: expected as Tenant['status'] }));
      }),
    );

    useTenantStore.setState({ tenants: [tenant({ status: current }), tenant({ id: 'otro' })] });

    await act(async () => {
      await store().toggleTenantStatus('tenant-1', current);
    });

    expect(body).toEqual({ status: expected });
    expect(store().tenants[0].status).toBe(expected);
    expect(store().tenants[1].id).toBe('otro');
  });

  it('lanza el error y conserva el estado anterior', async () => {
    server.use(
      http.patch(apiUrl('/admin/tenants/tenant-1/status'), () => errorResponse(500, 'db caída')),
    );

    useTenantStore.setState({ tenants: [tenant({ status: 'ACTIVE' })] });

    await expect(store().toggleTenantStatus('tenant-1', 'ACTIVE')).rejects.toThrow('db caída');
    expect(store().tenants[0].status).toBe('ACTIVE');
    expect(store().error).toBe('db caída');
  });
});

describe('tenantStore — clearError', () => {
  it('limpia el error', () => {
    useTenantStore.setState({ error: 'boom' });
    act(() => store().clearError());
    expect(store().error).toBeNull();
  });
});
