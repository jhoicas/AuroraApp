import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TemplateEditor from './TemplateEditor';

describe('TemplateEditor (TipTap)', () => {
  it('carga el HTML inicial, incluida la variable MGA como píldora', async () => {
    render(
      <TemplateEditor
        initialHtml='<p>Hola <span class="mga-var" data-id="project.name">Nombre del Proyecto</span></p>'
        onChange={() => {}}
      />,
    );
    const pill = await waitFor(() => {
      const el = screen.getByTestId('template-editor').querySelector('span.mga-var');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(pill.getAttribute('data-id')).toBe('project.name');
    expect(pill.textContent).toBe('Nombre del Proyecto');
  });

  it('al hacer clic en un chip inserta el nodo y notifica el HTML', async () => {
    const onChange = vi.fn();
    render(<TemplateEditor initialHtml="<p>Texto</p>" onChange={onChange} />);
    const chip = await screen.findByRole('button', { name: 'Código BPIN' });
    fireEvent.click(chip);
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const html = onChange.mock.calls.at(-1)![0] as string;
    expect(html).toContain('class="mga-var"');
    expect(html).toContain('data-id="project.code"');
    expect(html).toContain('>Código BPIN</span>');
  });

  it('en solo lectura no muestra herramientas ni chips', async () => {
    render(<TemplateEditor initialHtml="<p>x</p>" readOnly onChange={() => {}} />);
    await screen.findByTestId('template-editor');
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(screen.queryByLabelText('Variables MGA')).toBeNull();
  });

  it('conserva tablas HTML (modo hoja A4)', async () => {
    render(
      <TemplateEditor initialHtml="<table><tbody><tr><td><p>BPIN</p></td><td><p>X</p></td></tr></tbody></table>" onChange={() => {}} />,
    );
    const table = await waitFor(() => {
      const el = screen.getByTestId('template-editor').querySelector('table');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(table.querySelectorAll('td')).toHaveLength(2);
  });
});
