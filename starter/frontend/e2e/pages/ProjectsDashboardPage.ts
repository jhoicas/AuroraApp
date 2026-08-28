import { type Locator, type Page, expect } from '@playwright/test';
import { routes } from '../fixtures/testData';

export class ProjectsDashboardPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly createButton: Locator;
  readonly financialSection: Locator;
  readonly financeTable: Locator;
  readonly chartSurface: Locator;
  readonly errorAlert: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /Bienvenido/ });
    this.createButton = page.getByRole('button', { name: /Crear nuevo proyecto/ });
    this.financialSection = page.getByRole('heading', {
      name: 'Indicadores financieros (motor Go)',
    });
    this.financeTable = page.getByRole('table', {
      name: 'Resumen de VPN y TIR por alternativa evaluada',
    });
    this.chartSurface = page.getByRole('application');
    this.errorAlert = page.getByRole('alert');
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.tenantProjects);
    await expect(this.heading).toBeVisible();
  }

  async expectProjectVisible(name: string): Promise<void> {
    await expect(this.page.getByRole('heading', { name })).toBeVisible();
  }

  async expectProjectHidden(name: string): Promise<void> {
    await expect(this.page.getByRole('heading', { name })).toHaveCount(0);
  }

  async expectFinanceFormats(vpnText: string, tirText: string): Promise<void> {
    await expect(this.financialSection).toBeVisible();
    await expect(this.financeTable).toBeVisible();
    await expect(this.financeTable).toContainText(vpnText);
    await expect(this.financeTable).toContainText(tirText);
    await expect(this.chartSurface).toBeVisible();
  }

  /** Captura visual acotada a la sección financiera (regresión visual). */
  async assertFinanceVisual(snapshotName: string): Promise<void> {
    const section = this.page.locator('section').filter({
      has: this.financialSection,
    });
    await expect(section).toHaveScreenshot(snapshotName, {
      maxDiffPixelRatio: 0.02,
    });
  }
}
