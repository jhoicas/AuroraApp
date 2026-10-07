import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { autosaveLabel, useAutosave } from './useAutosave';

describe('useAutosave', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('no guarda el valor inicial y agrupa cambios con debounce de 3s', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(({ v }) => useAutosave({ value: v, onSave, delayMs: 3000 }), {
      initialProps: { v: 'a' },
    });
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(onSave).not.toHaveBeenCalled();

    rerender({ v: 'b' });
    await act(async () => { vi.advanceTimersByTime(2000); });
    rerender({ v: 'c' }); // reinicia el temporizador
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('c');
    expect(result.current.status).toBe('saved');
  });

  it('flush guarda de inmediato lo pendiente y no repite si no hay cambios', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(({ v }) => useAutosave({ value: v, onSave }), { initialProps: { v: 1 } });
    rerender({ v: 2 });
    await act(async () => { await result.current.flush(); });
    expect(onSave).toHaveBeenCalledWith(2);
    await act(async () => { await result.current.flush(); vi.advanceTimersByTime(10000); });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('marca error cuando falla el guardado', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('x'));
    const { result, rerender } = renderHook(({ v }) => useAutosave({ value: v, onSave }), { initialProps: { v: 1 } });
    rerender({ v: 2 });
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(result.current.status).toBe('error');
  });

  it('etiqueta de estado', () => {
    expect(autosaveLabel('saved', 1000, 5000)).toBe('Guardado hace un momento');
    expect(autosaveLabel('saved', 0, 120000)).toBe('Guardado hace 2 min');
    expect(autosaveLabel('saving', null)).toBe('Guardando…');
    expect(autosaveLabel('idle', null)).toBe('');
  });
});
