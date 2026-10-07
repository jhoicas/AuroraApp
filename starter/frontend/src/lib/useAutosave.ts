import { useCallback, useEffect, useRef, useState } from 'react';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type Options<T> = {
  value: T;
  /** Persiste el valor; debe lanzar si falla. */
  onSave: (value: T) => Promise<unknown>;
  delayMs?: number;
  enabled?: boolean;
};

/**
 * Autoguardado con debounce: cada cambio de `value` reinicia el temporizador; al vencer llama a
 * `onSave` en silencio. El valor inicial no se guarda. `flush()` guarda ya lo pendiente.
 */
export function useAutosave<T>({ value, onSave, delayMs = 3000, enabled = true }: Options<T>) {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const saved = useRef<T>(value);
  const latest = useRef<T>(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(onSave);
  const inFlight = useRef<Promise<void> | null>(null);
  saveRef.current = onSave;
  latest.current = value;

  const run = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inFlight.current) await inFlight.current;
    const v = latest.current;
    if (Object.is(v, saved.current)) return;
    setStatus('saving');
    const p = (async () => {
      try {
        await saveRef.current(v);
        saved.current = v;
        setSavedAt(Date.now());
        setStatus('saved');
      } catch {
        setStatus('error');
        throw new Error('autosave failed');
      }
    })();
    inFlight.current = p.catch(() => undefined).finally(() => {
      inFlight.current = null;
    });
    await p;
  }, []);

  useEffect(() => {
    if (!enabled || Object.is(value, saved.current)) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void run().catch(() => undefined);
    }, delayMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, delayMs, enabled, run]);

  /** Marca el valor como ya persistido (p. ej. tras cargar del servidor). */
  const reset = useCallback((v: T) => {
    saved.current = v;
    latest.current = v;
  }, []);

  return { status, savedAt, flush: run, reset };
}

/** Texto sutil para el indicador de autoguardado. */
export function autosaveLabel(status: AutosaveStatus, savedAt: number | null, now = Date.now()): string {
  if (status === 'saving') return 'Guardando…';
  if (status === 'error') return 'No se pudo guardar. Reintentando con el próximo cambio';
  if (status === 'saved' && savedAt !== null) {
    const s = Math.floor((now - savedAt) / 1000);
    if (s < 60) return 'Guardado hace un momento';
    return `Guardado hace ${Math.floor(s / 60)} min`;
  }
  return '';
}
