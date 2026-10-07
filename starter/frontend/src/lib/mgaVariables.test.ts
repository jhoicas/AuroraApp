import { describe, expect, it } from 'vitest';
import { renderPreview } from './mgaVariables';

describe('renderPreview', () => {
  it('reemplaza nodos mga-var por datos simulados y vacía ids desconocidos', () => {
    const html =
      '<p><span class="mga-var" data-id="project.name">Nombre del Proyecto</span> <span class="mga-var" data-id="x.y">?</span></p>';
    const out = renderPreview(html);
    expect(out).toContain('Mejoramiento de la vía rural La Esperanza');
    expect(out).not.toContain('mga-var');
    expect(out.endsWith(' </p>')).toBe(true);
  });
});
