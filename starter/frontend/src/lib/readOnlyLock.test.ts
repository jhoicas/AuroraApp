import { afterEach, describe, expect, it } from 'vitest';
import { lockControls, observeLock, unlockControls } from './readOnlyLock';

function mount(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('readOnlyLock', () => {
  const FORM = `
    <input id="text" type="text" />
    <input id="check" type="checkbox" />
    <input id="radio" type="radio" />
    <select id="select"><option>a</option></select>
    <textarea id="area"></textarea>
    <button id="save">Guardar Cambios</button>
    <button id="delete">Eliminar</button>
    <button id="toggle" aria-expanded="false">Desplegar</button>
    <button id="tab" role="tab">Pestaña</button>
    <div data-readonly-allow><button id="export">Exportar PDF</button></div>
  `;

  it('deshabilita inputs, selects, textareas, checkboxes y botones', () => {
    const root = mount(FORM);
    lockControls(root);
    for (const id of ['text', 'check', 'radio', 'select', 'area', 'save', 'delete']) {
      const el = root.querySelector<HTMLInputElement>(`#${id}`)!;
      expect(el.disabled, id).toBe(true);
      expect(el.getAttribute('aria-disabled')).toBe('true');
    }
  });

  it('respeta los controles de solo visualización/navegación', () => {
    const root = mount(FORM);
    lockControls(root);
    for (const id of ['toggle', 'tab', 'export']) {
      expect(root.querySelector<HTMLButtonElement>(`#${id}`)!.disabled, id).toBe(false);
    }
  });

  it('observeLock bloquea los controles que aparecen después y los que React vuelve a habilitar', async () => {
    const root = mount('<button id="a">A</button>');
    const stop = observeLock(root);
    expect(root.querySelector<HTMLButtonElement>('#a')!.disabled).toBe(true);

    const added = document.createElement('input');
    root.appendChild(added);
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(added.disabled).toBe(true);

    const a = root.querySelector<HTMLButtonElement>('#a')!;
    a.disabled = false; // p. ej. un componente con disabled={false}
    await new Promise((r) => setTimeout(r, 0));
    expect(a.disabled).toBe(true);

    stop();
    expect(a.disabled).toBe(false);
    expect(added.disabled).toBe(false);
  });

  it('unlockControls solo reactiva lo que se bloqueó (no los deshabilitados originalmente)', () => {
    const root = mount('<button id="orig" disabled>X</button><button id="mine">Y</button>');
    lockControls(root);
    unlockControls(root);
    expect(root.querySelector<HTMLButtonElement>('#orig')!.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('#mine')!.disabled).toBe(false);
  });
});
