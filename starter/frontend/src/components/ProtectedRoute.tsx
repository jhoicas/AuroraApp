import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homeForUser, isSuperAdmin, roleIsAllowed } from '../lib/roles';
import { firstNavPath } from '../lib/navModules';
import { useAccessStore, type AccessAction } from '../store/accessStore';

type ProtectedRouteProps = {
  /** Retrocompatibilidad: restricción por rol (se mantiene junto al control por módulo). */
  allowedRoles?: string[];
  /** Código de módulo (PBAC) que debe estar habilitado y permitir `action`. */
  module?: string;
  /** Acción exigida sobre `module` (por defecto `view`). */
  action?: AccessAction;
};

export default function ProtectedRoute({ allowedRoles, module, action = 'view' }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const location = useLocation();
  const allowed = useAccessStore((s) => (module ? s.can(module, action) : true));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">
        Cargando…
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Super Admin sin tenant_id puede acceder a /admin/*; no se exige tenant_id aquí.
  if (allowedRoles && !roleIsAllowed(user.role, allowedRoles)) {
    const dest = homeForUser(user);
    if (dest === '/login') {
      logout();
    }
    return <Navigate to={dest} replace />;
  }

  if (module && !allowed) {
    // Destino: primer módulo navegable del usuario (no el de siempre, que puede no tenerle acceso).
    const { nav } = useAccessStore.getState();
    const dest = firstNavPath(nav[isSuperAdmin(user.role) ? 'PLATFORM' : 'TENANT']);
    if (!dest || location.pathname.startsWith(dest)) {
      return (
        <div role="alert" className="p-6 text-gray-600">
          No tienes acceso a esta sección.
        </div>
      );
    }
    return <Navigate to={dest} replace />;
  }

  return <Outlet />;
}
