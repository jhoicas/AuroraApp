import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homeForUser, roleIsAllowed } from '../lib/roles';

type ProtectedRouteProps = {
  allowedRoles?: string[];
};

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const location = useLocation();

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

  return <Outlet />;
}
