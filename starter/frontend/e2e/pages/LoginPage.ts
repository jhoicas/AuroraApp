import { type Locator, type Page, expect } from '@playwright/test';
import { routes } from '../fixtures/testData';

export class LoginPage {
  readonly page: Page;
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly alert: Locator;

  constructor(page: Page) {
    this.page = page;
    this.email = page.getByRole('textbox', { name: 'Correo electrónico' });
    this.password = page.locator('#password');
    this.submit = page.getByRole('button', { name: 'Ingresar' });
    this.alert = page.getByRole('alert');
  }

  async goto(): Promise<void> {
    await this.page.goto(routes.login);
    await expect(this.submit).toBeVisible();
  }

  async login(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}
