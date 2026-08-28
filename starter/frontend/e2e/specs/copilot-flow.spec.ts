import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { installApiMocks } from '../fixtures/apiMocks';
import { PRODUCT_CARD, routes, users } from '../fixtures/testData';
import { AuroraCopilotPage } from '../pages/AuroraCopilotPage';
import { ProductsCatalogPage } from '../pages/ProductsCatalogPage';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, '..', '.auth');

/**
 * Flujo crítico 2: ciclo de vida de Aurora Copilot (happy path).
 * Super Admin → consulta MGA → Action Card → catálogo de productos filtrado.
 */
test.describe('Ciclo de vida del Copilot', () => {
  test.use({ storageState: path.join(AUTH_DIR, users.superAdmin.storageFile) });

  test('consulta MGA, aplica Action Card y filtra el catálogo de productos', async ({ page }) => {
    await installApiMocks(page, { user: users.superAdmin });

    await page.goto(routes.adminTenants);
    await expect(page.getByRole('heading', { name: 'Gestión de Entidades' })).toBeVisible();

    const copilot = new AuroraCopilotPage(page);
    await copilot.open();
    await copilot.ask('¿Qué producto DNP aplica a un acueducto rural?');
    await copilot.expectTypingThenReply(
      'Para acueducto rural te sugiero el producto DNP 4001001.',
    );
    await copilot.expectActionCard(PRODUCT_CARD.label);
    await copilot.applyActionCard();

    const catalog = new ProductsCatalogPage(page);
    await catalog.expectLoaded();
    await catalog.expectFilterApplied(PRODUCT_CARD.code);
    await catalog.expectProductVisible(PRODUCT_CARD.label);
    await expect(page.getByText('Vía terciaria mejorada')).toHaveCount(0);
  });
});
