import { type Locator, type Page, expect } from '@playwright/test';

export class AuroraCopilotPage {
  readonly page: Page;
  readonly openButton: Locator;
  readonly dialog: Locator;
  readonly input: Locator;
  readonly sendButton: Locator;
  readonly stopButton: Locator;
  readonly typingIndicator: Locator;
  applyButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.openButton = page.getByRole('button', { name: 'Abrir Aurora Asistente MGA' });
    this.dialog = page.getByRole('dialog', { name: 'Aurora · Asistente MGA' });
    this.input = page.getByRole('textbox', { name: 'Mensaje para Aurora Asistente' });
    this.sendButton = page.getByRole('button', { name: 'Enviar' });
    this.stopButton = page.getByRole('button', { name: 'Detener' });
    this.typingIndicator = page.getByText('Aurora está escribiendo…');
    // El botón de la Action Card toma el texto de `card.label`; se resuelve en expectActionCard.
    this.applyButton = page.getByRole('button', { name: 'Aplicar', exact: true });
  }

  async open(): Promise<void> {
    await this.openButton.click();
    await expect(this.dialog).toBeVisible();
  }

  async ask(question: string): Promise<void> {
    await this.input.fill(question);
    await this.sendButton.click();
    await expect(this.input).toHaveValue('');
  }

  async expectTypingThenReply(reply: string): Promise<void> {
    // La generación puede resolverse muy rápido en WebKit: aceptamos el
    // indicador de escritura o, si ya terminó, la respuesta final.
    await expect(this.typingIndicator.or(this.page.getByText(reply))).toBeVisible();
    await expect(this.page.getByText(reply)).toBeVisible();
    await expect(this.typingIndicator).toHaveCount(0);
    await expect(this.sendButton).toBeVisible();
  }

  async expectActionCard(label: string): Promise<void> {
    this.applyButton = this.dialog.getByRole('button', { name: label, exact: true });
    await expect(this.dialog.getByText(label).first()).toBeVisible();
    await expect(this.applyButton).toBeVisible();
  }

  async applyActionCard(): Promise<void> {
    await this.applyButton.click();
    await expect(this.dialog).toHaveCount(0);
  }
}
