import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { homeForUser } from '../../lib/roles';

export default function LandingHero() {
  const { isAuthenticated, user } = useAuth();
  const dashboardPath = user ? homeForUser(user) : '/tenant/projects';

  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-20 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -right-24 top-0 h-96 w-96 rounded-full bg-teal-200/40 blur-3xl" />
        <div className="absolute -left-32 bottom-0 h-[28rem] w-[28rem] rounded-full bg-[#006162]/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-4xl text-center">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#006162] sm:text-sm">
          <span className="material-symbols-outlined text-base">auto_awesome</span>
          Inversión pública con inteligencia artificial
        </p>

        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
          Potencia la gestión de tus proyectos{' '}
          <span className="bg-gradient-to-r from-[#006162] to-teal-500 bg-clip-text text-transparent">
            con IA
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-gray-600 sm:text-lg">
          AuroraApp centraliza la formulación MGA: procesamiento automatizado de archivos XML,
          seguimiento de indicadores y presupuestos, y consulta inteligente con RAG sobre el
          conocimiento del DNP.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          {isAuthenticated && user ? (
            <Link
              to={dashboardPath}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#006162] px-8 text-base font-semibold text-white shadow-lg shadow-teal-900/15 transition hover:bg-[#004f50] sm:w-auto"
            >
              <span className="material-symbols-outlined text-xl">dashboard</span>
              Ir al Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#006162] px-8 text-base font-semibold text-white shadow-lg shadow-teal-900/15 transition hover:bg-[#004f50] sm:w-auto"
              >
                Iniciar sesión
              </Link>
              <Link
                to="/register"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-8 text-base font-semibold text-gray-800 shadow-sm transition hover:border-[#006162]/40 hover:bg-teal-50/50 sm:w-auto"
              >
                Crear cuenta
              </Link>
            </>
          )}
        </div>

        <p className="mt-6 text-sm text-gray-500">
          Plataforma multi-tenant para entidades públicas y equipos de formulación MGA.
        </p>
      </div>
    </section>
  );
}
