import { test as base, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installApiMocks } from '../fixtures/apiMocks';
import { LoginPage } from '../pages/LoginPage';
import { users, type E2EUser } from '../fixtures/testData';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const AUTH_DIR = path.join(__dirname, '..', '.auth');

type AuthFixtures = {
  loginAs: (user: E2EUser) => Promise<void>;
};

/**
 * Setup project: genera Storage States en e2e/.auth/ para Tenant A, Tenant B
 * y Super Admin, evitando re-login en cada spec.
 */
export const test = base.extend<AuthFixtures>({
  loginAs: async ({ page }, use) => {
    await use(async (user) => {
      await installApiMocks(page, { user });
      const login = new LoginPage(page);
      await login.goto();
      await login.login(user.email, user.password);

      if (user.role === 'SUPER_ADMIN') {
        await expect(page).toHaveURL(/\/admin\/tenants/);
      } else {
        await expect(page).toHaveURL(/\/tenant\/projects/);
      }
    });
  },
});

test.describe('auth setup', () => {
  test('persiste sesión de Tenant A', async ({ page, loginAs }) => {
    await loginAs(users.tenantA);
    await page.context().storageState({ path: path.join(AUTH_DIR, users.tenantA.storageFile) });
  });

  test('persiste sesión de Tenant B', async ({ page, loginAs }) => {
    await loginAs(users.tenantB);
    await page.context().storageState({ path: path.join(AUTH_DIR, users.tenantB.storageFile) });
  });

  test('persiste sesión de Super Admin', async ({ page, loginAs }) => {
    await loginAs(users.superAdmin);
    await page.context().storageState({ path: path.join(AUTH_DIR, users.superAdmin.storageFile) });
  });
});
