import { Link } from 'react-router-dom';
import { LogoAurora } from '../LogoAurora';

const CURRENT_YEAR = new Date().getFullYear();

export default function LandingFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <LogoAurora />
          <p className="max-w-sm text-sm text-gray-600">
            Plataforma de formulación y seguimiento de proyectos de inversión pública con
            asistencia inteligente.
          </p>
          <a
            href="https://proyectoaurora.ludoia.com/"
            className="inline-block text-sm font-medium text-[#006162] hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            proyectoaurora.ludoia.com
          </a>
        </div>

        <nav aria-label="Enlaces rápidos" className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-gray-900">Acceso</p>
          <Link to="/login" className="text-sm text-gray-600 transition hover:text-[#006162]">
            Iniciar sesión
          </Link>
          <Link to="/register" className="text-sm text-gray-600 transition hover:text-[#006162]">
            Registrarse
          </Link>
          <a
            href="https://ludoia.com/"
            className="text-sm text-gray-600 transition hover:text-[#006162]"
            target="_blank"
            rel="noreferrer"
          >
            ludoia.com
          </a>
        </nav>
      </div>

      <div className="mx-auto mt-10 max-w-6xl border-t border-gray-100 pt-6 text-center text-xs text-gray-500 sm:text-left">
        © {CURRENT_YEAR} AuroraApp · Ludoia. Todos los derechos reservados.
      </div>
    </footer>
  );
}
