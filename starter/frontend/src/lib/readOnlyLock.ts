/**
 * Bloqueo de controles para el modo lectura. Deshabilita (`disabled`) todo input, select,
 * textarea y botón dentro de un contenedor, incluidos los que se renderizan después, salvo los
 * controles de solo navegación/visualización:
 *   - con `data-readonly-allow` (p. ej. exportar a PDF),
 *   - los que controlan despliegue (`aria-expanded`) y las pestañas (`role="tab"`).
 * Es reversible: solo se reactivan los controles que este módulo deshabilitó.
 */

const CONTROL_SELECTOR = 'input, select, textarea, button';
const LOCKED_ATTR = 'data-readonly-locked';

function isAllowed(el: Element): boolean {
  return (
    el.closest('[data-readonly-allow]') !== null ||
    el.hasAttribute('aria-expanded') ||
    el.getAttribute('role') === 'tab'
  );
}

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement;

export function lockControls(root: ParentNode): void {
  root.querySelectorAll<Control>(CONTROL_SELECTOR).forEach((el) => {
    if (el.disabled || isAllowed(el)) return;
    el.disabled = true;
    el.setAttribute(LOCKED_ATTR, 'true');
    el.setAttribute('aria-disabled', 'true');
  });
}

export function unlockControls(root: ParentNode): void {
  root.querySelectorAll<Control>(`[${LOCKED_ATTR}]`).forEach((el) => {
    el.disabled = false;
    el.removeAttribute(LOCKED_ATTR);
    el.removeAttribute('aria-disabled');
  });
}

/**
 * Bloquea ahora y mantiene el bloqueo ante cambios del DOM (nodos nuevos o un `disabled`
 * que React vuelva a quitar). Devuelve la función que detiene la observación y desbloquea.
 */
export function observeLock(root: HTMLElement): () => void {
  lockControls(root);
  const observer = new MutationObserver(() => lockControls(root));
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
  return () => {
    observer.disconnect();
    unlockControls(root);
  };
}
