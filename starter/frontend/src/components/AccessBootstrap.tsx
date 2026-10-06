import { useEffect, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAccessStore } from '../store/accessStore';

/** Cada cuánto, como mínimo, se vuelve a pedir el acceso al recuperar el foco de la pestaña. */
const REFRESH_AFTER_MS = 60_000;

/**
 * Carga los módulos y permisos desde el servidor al iniciar sesión o restaurarla, los limpia al
 * cerrar sesión y los refresca al volver a la pestaña (para aplicar revocaciones sin recargar).
 * Mientras la primera carga está en curso muestra el mismo "Cargando…" de las rutas protegidas.
 */
export default function AccessBootstrap({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const status = useAccessStore((s) => s.status);
  const error = useAccessStore((s) => s.error);
  const userId = user?.id;

  useEffect(() => {
    const { fetchAccess, reset } = useAccessStore.getState();
    if (isAuthenticated && userId) {
      void fetchAccess();
    } else {
      reset();
    }
  }, [isAuthenticated, userId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const { loadedAt, fetchAccess } = useAccessStore.getState();
      if (loadedAt && Date.now() - loadedAt > REFRESH_AFTER_MS) void fetchAccess();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isAuthenticated]);

  if (isLoading) return <FullScreen>Cargando…</FullScreen>;

  if (isAuthenticated && (status === 'idle' || status === 'loading')) {
    return <FullScreen>Cargando…</FullScreen>;
  }

  if (isAuthenticated && status === 'error') {
    return (
      <FullScreen>
        <div role="alert" className="text-center space-y-3">
          <p>No se pudieron cargar tus permisos{error ? `: ${error}` : '.'}</p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => void useAccessStore.getState().fetchAccess()}
              className="px-4 py-2 rounded-lg bg-[#006162] text-white font-semibold hover:bg-[#004f50]"
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={logout}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </FullScreen>
    );
  }

  return <>{children}</>;
}

function FullScreen({ children }: { children: ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">{children}</div>;
}
