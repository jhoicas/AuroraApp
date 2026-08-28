import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { homeForUser } from '../../lib/roles';
import { LogoAurora } from '../LogoAurora';

export default function LandingNavbar() {
  const { isAuthenticated, user } = useAuth();
  const dashboardPath = user ? homeForUser(user) : '/login';

  return (
    <header className="sticky top-0 z-50 border-b border-white/60 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="shrink-0" aria-label="AuroraApp — inicio">
          <LogoAurora />
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          {isAuthenticated && user ? (
            <Link
              to={dashboardPath}
              className="inline-flex h-10 items-center rounded-lg bg-[#006162] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#004f50]"
            >
              Ir al Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden h-10 items-center rounded-lg px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-100 sm:inline-flex"
              >
                Iniciar sesión
              </Link>
              <Link
                to="/register"
                className="inline-flex h-10 items-center rounded-lg bg-[#006162] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#004f50]"
              >
                Crear cuenta
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
