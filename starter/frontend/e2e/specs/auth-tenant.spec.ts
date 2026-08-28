import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { installApiMocks } from '../fixtures/apiMocks';
import { PROJECT_A, PROJECT_B, routes, users } from '../fixtures/testData';
import { LoginPage } from '../pages/LoginPage';
import { ProjectsDashboardPage } from '../pages/ProjectsDashboardPage';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, '..', '.auth');

/**
 * Flujo crítico contra backend Go real + Postgres efímero (pgvector :5433).
 * Sin mocks de red: el login golpea POST /api/v1/auth/login y la BD seed.
 */
test.describe('Backend real (PostgreSQL efímero)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('frontend carga y login Super Admin alcanza /admin/tenants', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await expect(login.submit).toBeVisible();

    const loginResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/auth/login') &&
        res.request().method() === 'POST',
    );

    await login.login(users.superAdmin.email, users.superAdmin.password);

    const loginResponse = await loginResponsePromise;
    expect(loginResponse.status()).toBe(200);

    await expect(page).toHaveURL(/\/admin\/tenants/);
    await expect(page.getByText('Gestión de Tenants').first()).toBeVisible();
  });
});

/**
 * Flujo crítico 1: autenticación y aislamiento multi-tenant (mocks deterministas).
 * Tenant A no debe ver proyectos ni rutas de auditoría del Tenant B / admin.
 */
test.describe('Aislamiento multi-tenant', () => {
  test.describe('como Tenant A', () => {
    test.use({ storageState: path.join(AUTH_DIR, users.tenantA.storageFile) });

    test('solo ve proyectos del Tenant A en el dashboard', async ({ page }) => {
      await installApiMocks(page, { user: users.tenantA });
      const dashboard = new ProjectsDashboardPage(page);
      await dashboard.goto();

      await dashboard.expectProjectVisible(PROJECT_A.name);
      await dashboard.expectProjectHidden(PROJECT_B.name);

      await expect(page.getByRole('navigation')).toContainText('Proyectos');
      await expect(page.getByRole('navigation')).not.toContainText('Gestión IA Aurora');
    });

    test('una URL directa a /admin/ai es rechazada por el guard de roles', async ({ page }) => {
      await installApiMocks(page, { user: users.tenantA });
      await page.goto(routes.adminAi);

      await expect(page).toHaveURL(/\/tenant\/projects/);
      await expect(page.getByRole('heading', { name: PROJECT_B.name })).toHaveCount(0);
    });

    test('el API de auditoría admin responde 403 para el Tenant A', async ({ page }) => {
      await installApiMocks(page, { user: users.tenantA });
      await page.goto(routes.tenantProjects);

      const status = await page.evaluate(async () => {
        const res = await fetch('http://127.0.0.1:8081/api/v1/ai/audit/usage');
        return res.status;
      });
      expect(status).toBe(403);
    });
  });

  test.describe('como Tenant B', () => {
    test.use({ storageState: path.join(AUTH_DIR, users.tenantB.storageFile) });

    test('solo ve proyectos del Tenant B y no los del Tenant A', async ({ page }) => {
      await installApiMocks(page, { user: users.tenantB });
      const dashboard = new ProjectsDashboardPage(page);
      await dashboard.goto();

      await dashboard.expectProjectVisible(PROJECT_B.name);
      await dashboard.expectProjectHidden(PROJECT_A.name);
    });
  });
});
