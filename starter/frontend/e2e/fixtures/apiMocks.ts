import type { Page, Route } from '@playwright/test';
import {
  EVALUATION_A,
  PRODUCT_CARD,
  PROJECT_A,
  PROJECT_B,
  users,
  type E2EUser,
} from './testData';

const API_GLOB = '**/api/v1/**';

type MockOptions = {
  /** Identidad activa: determina qué proyectos/auditoría se exponen. */
  user: E2EUser;
  /** Fuerza un 500 en GET /projects (dashboard + ErrorBoundary de red). */
  failProjects?: boolean;
};

function json(route: Route, status: number, body: unknown): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function loginPayload(user: E2EUser) {
  return {
    token: `e2e-access-${user.storageFile}`,
    refresh_token: `e2e-refresh-${user.storageFile}`,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      tenant_id: user.tenant_id,
    },
  };
}

function projectsFor(user: E2EUser) {
  if (user.tenant_id === users.tenantA.tenant_id) return [PROJECT_A];
  if (user.tenant_id === users.tenantB.tenant_id) return [PROJECT_B];
  return [];
}

function evaluationsFor(user: E2EUser) {
  if (user.tenant_id === users.tenantA.tenant_id) return [EVALUATION_A];
  return [];
}

function auditUsageFor(user: E2EUser) {
  if (user.role === 'SUPER_ADMIN') {
    return [
      {
        id: 'usage-a',
        user_id: users.tenantA.id,
        role: 'FORMULADOR',
        action: 'aurora_chat',
        created_at: '2026-03-12T10:00:00Z',
      },
      {
        id: 'usage-b',
        user_id: users.tenantB.id,
        role: 'FORMULADOR',
        action: 'ingest_xml',
        created_at: '2026-03-12T11:00:00Z',
      },
    ];
  }
  // Un formulador no debería poder leer auditoría admin; el backend devolvería 403.
  return [];
}

/**
 * Intercepta todas las llamadas a /api/v1/** con respuestas deterministas.
 * Evita flakiness de Anthropic/BD compartida y modela el aislamiento por tenant.
 */
export async function installApiMocks(page: Page, options: MockOptions): Promise<void> {
  const { user, failProjects = false } = options;

  await page.route(API_GLOB, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, '') || '/';

    if (method === 'POST' && path === '/auth/login') {
      const body = request.postDataJSON() as { email?: string; password?: string };
      const match = Object.values(users).find(
        (u) => u.email === body.email?.trim().toLowerCase() && u.password === body.password,
      );
      if (!match) {
        await json(route, 401, { error: 'Credenciales inválidas' });
        return;
      }
      await json(route, 200, loginPayload(match));
      return;
    }

    if (method === 'POST' && path === '/auth/refresh') {
      await json(route, 200, {
        token: `e2e-access-${user.storageFile}`,
        refresh_token: `e2e-refresh-${user.storageFile}`,
      });
      return;
    }

    if (method === 'GET' && path === '/projects') {
      if (failProjects) {
        await json(route, 500, { error: 'No se pudo cargar el listado' });
        return;
      }
      const data = projectsFor(user);
      await json(route, 200, {
        data,
        page: 1,
        page_size: 100,
        total: data.length,
        total_pages: 1,
      });
      return;
    }

    if (method === 'GET' && path === '/projects/evaluations/summary') {
      await json(route, 200, { data: evaluationsFor(user) });
      return;
    }

    if (method === 'POST' && path === '/ai/aurora/chat') {
      // Simula latencia de “streaming”/generación sin waitForTimeout en el test.
      await new Promise((resolve) => setTimeout(resolve, 600));
      await json(route, 200, {
        reply: 'Para acueducto rural te sugiero el producto DNP 4001001.',
        action_cards: [PRODUCT_CARD],
        model: 'claude-haiku-4-5-20251001',
        session_id: 'e2e-session-1',
        user_message_id: 'e2e-user-msg',
        assistant_message_id: 'e2e-assistant-msg',
      });
      return;
    }

    if (method === 'GET' && path === '/ai/audit/usage') {
      if (user.role !== 'SUPER_ADMIN') {
        await json(route, 403, { error: 'insufficient role' });
        return;
      }
      const data = auditUsageFor(user);
      await json(route, 200, {
        data,
        page: 1,
        page_size: 25,
        total: data.length,
        total_pages: 1,
      });
      return;
    }

    if (method === 'GET' && path === '/ai/audit/chat') {
      if (user.role !== 'SUPER_ADMIN') {
        await json(route, 403, { error: 'insufficient role' });
        return;
      }
      await json(route, 200, { data: [], page: 1, page_size: 25, total: 0, total_pages: 1 });
      return;
    }

    if (method === 'GET' && path === '/catalog/products') {
      const search = (url.searchParams.get('search') ?? '').toLowerCase();
      const all = [
        {
          id: 'prod-1',
          sector: '40',
          nombre_sector: 'Agua potable',
          codigo_programa: '4001',
          nombre_programa: 'Acueducto',
          codigo_producto: PRODUCT_CARD.code,
          producto: PRODUCT_CARD.label,
          descripcion: PRODUCT_CARD.description,
          medido_a_traves_de: '',
          codigo_indicador_producto: '',
          indicador_producto: '',
          unidad_de_medida: 'Unidad',
          indicador_principal: true,
          es_nacional: true,
          es_territorial: true,
          ods: '6',
          meta_ods: '6.1',
          tipologia_general_suifp: '',
          tipologia_d: false,
          tipologia_e: false,
          tipologia_a_piip: false,
          tipologia_b_piip: false,
          tipologia_c_piip: false,
          tiene_edt: false,
          edt: '',
        },
        {
          id: 'prod-2',
          sector: '40',
          nombre_sector: 'Transporte',
          codigo_programa: '4002',
          nombre_programa: 'Vial',
          codigo_producto: '4002001',
          producto: 'Vía terciaria mejorada',
          descripcion: 'Otro producto',
          medido_a_traves_de: '',
          codigo_indicador_producto: '',
          indicador_producto: '',
          unidad_de_medida: 'Km',
          indicador_principal: false,
          es_nacional: true,
          es_territorial: true,
          ods: '',
          meta_ods: '',
          tipologia_general_suifp: '',
          tipologia_d: false,
          tipologia_e: false,
          tipologia_a_piip: false,
          tipologia_b_piip: false,
          tipologia_c_piip: false,
          tiene_edt: false,
          edt: '',
        },
      ];
      const data = search
        ? all.filter(
            (p) =>
              p.codigo_producto.toLowerCase().includes(search) ||
              p.producto.toLowerCase().includes(search),
          )
        : all;
      await json(route, 200, {
        data,
        meta: { page: 1, limit: 20, total: data.length, last_page: 1 },
      });
      return;
    }

    if (method === 'GET' && path === '/catalog/sectors') {
      await json(route, 200, {
        data: [{ id: 'sec-1', code: '40', name: 'Agua potable y saneamiento básico' }],
        meta: { page: 1, limit: 20, total: 1, last_page: 1 },
      });
      return;
    }

    if (method === 'GET' && path === '/catalog/programs') {
      await json(route, 200, {
        data: [],
        meta: { page: 1, limit: 20, total: 0, last_page: 1 },
      });
      return;
    }

    if (method === 'GET' && path === '/admin/tenants') {
      await json(route, 200, {
        data: [
          {
            id: users.tenantA.tenant_id,
            name: 'Alcaldía Tenant A',
            slug: 'tenant-a',
            contact_email: 'contacto@tenant-a.gov.co',
            is_active: true,
            status: 'ACTIVE',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
          {
            id: users.tenantB.tenant_id,
            name: 'Gobernación Tenant B',
            slug: 'tenant-b',
            contact_email: 'contacto@tenant-b.gov.co',
            is_active: true,
            status: 'ACTIVE',
            created_at: '2026-01-02T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
          },
        ],
        page: 1,
        page_size: 20,
        total: 2,
        total_pages: 1,
      });
      return;
    }

    if (method === 'GET' && path === '/tenants') {
      await json(route, 200, {
        data: [
          { id: users.tenantA.tenant_id, name: 'Alcaldía Tenant A', is_active: true },
          { id: users.tenantB.tenant_id, name: 'Gobernación Tenant B', is_active: true },
        ],
      });
      return;
    }

    if (method === 'GET' && path === '/ai/knowledge/graph') {
      await json(route, 200, { nodes: [], links: [] });
      return;
    }

    // Fallback seguro: evita que una ruta no mockeada dependa del backend real.
    await json(route, 200, { data: [] });
  });
}
