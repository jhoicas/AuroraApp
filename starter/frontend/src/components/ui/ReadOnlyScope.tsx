import { useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from 'react';
import { useReadOnly } from '../../context/ReadOnlyContext';
import { observeLock } from '../../lib/readOnlyLock';

type ReadOnlyScopeProps = HTMLAttributes<HTMLDivElement> & { children: ReactNode };

/**
 * Contenedor que, en modo lectura (ReadOnlyContext), deshabilita todos sus controles de
 * edición. Fuera de modo lectura no altera nada.
 */
export default function ReadOnlyScope({ children, ...rest }: ReadOnlyScopeProps) {
  const { readOnly } = useReadOnly();
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!readOnly || !el) return;
    return observeLock(el);
  }, [readOnly]);

  return (
    <div ref={ref} data-readonly={readOnly ? 'true' : undefined} {...rest}>
      {readOnly && (
        // Respaldo para "botones" que no son controles de formulario (div/span con onClick).
        <style>{`[data-readonly="true"] [role="button"]:not([aria-expanded]):not([data-readonly-allow]) { pointer-events: none; opacity: 0.6; }`}</style>
      )}
      {children}
    </div>
  );
}
