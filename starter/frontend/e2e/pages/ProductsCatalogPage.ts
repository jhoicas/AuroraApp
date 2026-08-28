import { type Locator, type Page, expect } from '@playwright/test';
import { routes } from '../fixtures/testData';

export class ProductsCatalogPage {
  readonly page: Page;
  readonly search: Locator;

  constructor(page: Page) {
    this.page = page;
    this.search = page.getByRole('searchbox', { name: 'Buscar productos' });
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`${routes.adminProducts}$`));
    await expect(this.search).toBeVisible();
  }

  async expectFilterApplied(query: string): Promise<void> {
    await expect(this.search).toHaveValue(query);
  }

  async expectProductVisible(name: string): Promise<void> {
    await expect(this.page.getByText(name, { exact: false }).first()).toBeVisible();
  }
}
