import { afterEach, describe, expect, it, vi } from 'vitest';
import { findAuditFieldElement, highlightAuditField } from './auditHighlight';

describe('auditHighlight', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('finds field by data-audit-field, id prefix, then work area', () => {
    document.body.innerHTML =
      '<div data-audit-workarea></div><textarea id="magnitud-problema-abc"></textarea><div data-audit-field="causas"></div>';
    expect(findAuditFieldElement('causas')?.getAttribute('data-audit-field')).toBe('causas');
    expect(findAuditFieldElement('magnitud-problema')?.id).toBe('magnitud-problema-abc');
    expect(findAuditFieldElement('otro')?.hasAttribute('data-audit-workarea')).toBe(true);
  });

  it('adds and removes the highlight class temporarily', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="x" data-audit-field="x"></div>';
    const el = document.getElementById('x')!;
    el.scrollIntoView = vi.fn();
    highlightAuditField('x');
    vi.advanceTimersByTime(10);
    expect(el.classList.contains('ring-4')).toBe(true);
    expect(el.scrollIntoView).toHaveBeenCalled();
    vi.advanceTimersByTime(3500);
    expect(el.classList.contains('ring-4')).toBe(false);
  });
});
