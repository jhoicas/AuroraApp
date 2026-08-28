import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { installApiMocks } from '../fixtures/apiMocks';
import { routes, users } from '../fixtures/testData';
import { ErrorBoundaryPage } from '../pages/ErrorBoundaryPage';
import { ProjectsDashboardPage } from '../pages/ProjectsDashboardPage';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, '..', '.auth');

/** Normaliza NBSP de Intl.NumberFormat(es-CO). */
const normalize = (value: string): string => value.replace(/\u00a0/g, ' ');

/**
 * Flujo crítico 3: sincronización financiera VPN/TIR + ErrorBoundary.
 */
test.describe('Dashboard financiero y ErrorBoundary', () => {
  test.use({ storageState: path.join(AUTH_DIR, users.tenantA.storageFile) });

  test('renderiza VPN en COP y TIR en porcentaje con gráfico accesible', async ({ page }) => {
    await installApiMocks(page, { user: users.tenantA });
    const dashboard = new ProjectsDashboardPage(page);
    await dashboard.goto();

    await dashboard.expectFinanceFormats('$ 1.250.000.000', '18,42 %');

    const vpnCell = dashboard.financeTable.getByRole('cell').nth(2);
    const tirCell = dashboard.financeTable.getByRole('cell').nth(3);
    expect(normalize((await vpnCell.innerText()).trim())).toBe('$ 1.250.000.000');
    expect(normalize((await tirCell.innerText()).trim())).toBe('18,42 %');

    await expect(page.locator('.recharts-bar')).toHaveCount(2);
  });

  test('muestra alerta elegante ante un 500 del API de proyectos', async ({ page }) => {
    await installApiMocks(page, { user: users.tenantA, failProjects: true });
    await page.goto(routes.tenantProjects);

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('No se pudo cargar el listado');
    await alert.getByRole('button', { name: 'Cerrar' }).click();
    await expect(alert).toHaveCount(0);
  });

  test('ErrorBoundary aísla el crash de una vista y ofrece Reintentar', async ({ page }) => {
    await installApiMocks(page, { user: users.tenantA });
    await page.goto(routes.tenantCrash);

    const boundary = new ErrorBoundaryPage(page);
    await boundary.expectVisible('Error en el espacio de trabajo');
    await expect(boundary.alert).toContainText('Fallo E2E controlado para validar ErrorBoundary');

    // Al reintentar sin cambiar la ruta, el hijo vuelve a lanzar → el alert persiste.
    await boundary.retryOnce();
    await expect(boundary.alert).toBeVisible();

    // Navegar a una vista sana reinicia el boundary (key={pathname}).
    await page.goto(routes.tenantProjects);
    await expect(page.getByRole('heading', { name: /Bienvenido/ })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});
