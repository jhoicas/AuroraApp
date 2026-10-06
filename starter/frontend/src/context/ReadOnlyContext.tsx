import { createContext, useContext, useMemo, type ReactNode } from 'react';

type ReadOnlyValue = {
  /** true: la formulación se muestra en modo lectura (controles deshabilitados, sin guardar/enviar). */
  readOnly: boolean;
  /** Destino de "volver" / "ir al inicio" (p. ej. /admin/projects para el Super Admin). */
  backPath: string;
};

const DEFAULT: ReadOnlyValue = { readOnly: false, backPath: '/tenant/projects' };

const ReadOnlyContext = createContext<ReadOnlyValue>(DEFAULT);

export function ReadOnlyProvider({
  readOnly,
  backPath = DEFAULT.backPath,
  children,
}: {
  readOnly: boolean;
  backPath?: string;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ readOnly, backPath }), [readOnly, backPath]);
  return <ReadOnlyContext.Provider value={value}>{children}</ReadOnlyContext.Provider>;
}

/** Modo lectura de la formulación del proyecto (Super Admin o `?mode=readonly`). */
export function useReadOnly(): ReadOnlyValue {
  return useContext(ReadOnlyContext);
}
