import { type Locator, type Page, expect } from '@playwright/test';

export class ErrorBoundaryPage {
  readonly page: Page;
  readonly alert: Locator;
  readonly retry: Locator;

  constructor(page: Page) {
    this.page = page;
    this.alert = page.getByRole('alert');
    this.retry = page.getByRole('button', { name: 'Reintentar' });
  }

  async expectVisible(title: string): Promise<void> {
    await expect(this.alert).toBeVisible();
    await expect(this.alert).toContainText(title);
    await expect(this.retry).toBeVisible();
  }

  async retryOnce(): Promise<void> {
    await this.retry.click();
  }
}
