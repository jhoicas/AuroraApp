import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { E2E_API_BASE } from './e2e/helpers/e2eEnv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, 'e2e', '.auth');

/**
 * Ruta base de la app. El multi-tenant de AuroraApp es por path (`/tenant/*`)
 * y JWT (tenant_id), no por subdominio. Se puede sobreescribir con E2E_BASE_URL
 * para apuntar a un host tipo `http://tenant1.auroraapp.local:5173`.
 *
 * Nota: Playwright arranca `webServer` ANTES de `globalSetup`. Por eso el
 * backend Go + Postgres efímero se levantan en `e2e/global.setup.ts` (:8081),
 * y aquí solo orquestamos el frontend Vite.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';
const API_URL = process.env.E2E_API_URL ?? E2E_API_BASE;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e/specs',
  globalSetup: './e2e/global.setup.ts',
  globalTeardown: './e2e/global.teardown.ts',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 2,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  outputDir: 'test-results',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173',
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_E2E: 'true',
      VITE_API_URL: API_URL,
    },
  },
  projects: [
    {
      name: 'setup',
      testDir: './e2e/setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(AUTH_DIR, 'tenant-a.json'),
      },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: path.join(AUTH_DIR, 'tenant-a.json'),
      },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: path.join(AUTH_DIR, 'tenant-a.json'),
      },
      dependencies: ['setup'],
    },
  ],
});
