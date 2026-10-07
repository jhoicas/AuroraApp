const HIGHLIGHT_CLASSES = ['ring-4', 'ring-amber-400', 'ring-offset-2', 'rounded-md', 'transition-shadow'];
const HIGHLIGHT_MS = 3000;
const MAX_ATTEMPTS = 20;
const RETRY_MS = 100;

function escapeAttr(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

/** Busca el elemento de un campo MGA por `data-audit-field`, id exacto o prefijo de id. */
export function findAuditFieldElement(fieldKey: string | undefined | null): HTMLElement | null {
  const key = fieldKey ? escapeAttr(fieldKey) : '';
  const selectors = [
    key && `[data-audit-field="${key}"]`,
    key && `[id="${key}"]`,
    key && `[id^="${key}-"]`,
    '[data-audit-workarea]',
  ].filter(Boolean) as string[];
  for (const selector of selectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) return el;
  }
  return null;
}

/**
 * Hace scroll al campo afectado y lo resalta temporalmente. Reintenta mientras la pestaña
 * destino termina de montarse. Devuelve una función de cancelación.
 */
export function highlightAuditField(fieldKey?: string | null): () => void {
  let attempts = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let clear: ReturnType<typeof setTimeout> | undefined;
  let target: HTMLElement | null = null;

  const tryOnce = () => {
    const el = findAuditFieldElement(fieldKey);
    // Si solo hay contenedor genérico y aún quedan intentos, espera al campo exacto.
    const exact = el && !el.hasAttribute('data-audit-workarea');
    if (!el || (!exact && fieldKey && attempts < MAX_ATTEMPTS / 2)) {
      if (attempts++ < MAX_ATTEMPTS) retry = setTimeout(tryOnce, RETRY_MS);
      return;
    }
    target = el;
    el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    el.classList.add(...HIGHLIGHT_CLASSES);
    clear = setTimeout(() => el.classList.remove(...HIGHLIGHT_CLASSES), HIGHLIGHT_MS);
  };

  retry = setTimeout(tryOnce, 0);
  return () => {
    if (retry) clearTimeout(retry);
    if (clear) clearTimeout(clear);
    target?.classList.remove(...HIGHLIGHT_CLASSES);
  };
}
