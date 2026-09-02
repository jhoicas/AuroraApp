import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogoAurora } from '../components/LogoAurora';
import ErrorBoundary from '../components/ErrorBoundary';
import FloatingAssistant from '../components/AuroraAsistente/FloatingAssistant';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006162] ${
    isActive
      ? 'bg-teal-50 text-[#006162] border-l-4 border-[#006162] font-semibold'
      : 'text-gray-600 hover:bg-gray-50 hover:text-[#006162]'
  }`;

export default function TenantLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isImmersiveAssistant = pathname === '/tenant/projects/create-assistant';
  /** En /tenant/ai y creación asistida el chat ya está embebido; ocultamos el FAB. */
  const hideFloatingFab =
    pathname === '/tenant/ai' ||
    pathname.startsWith('/tenant/ai/') ||
    isImmersiveAssistant;

  return (
    <div className="flex h-screen bg-gray-50 print:block print:h-auto print:bg-white">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col p-4 print:hidden shrink-0">
        <div className="mb-6 px-1">
          <LogoAurora className="w-8 h-8 text-teal-600" />
          <p className="text-sm text-gray-500 mt-2">Portal de inversión pública</p>
        </div>
        <nav className="flex-1 space-y-1">
          <NavLink to="/tenant/projects" className={linkClass}>
            <span className="material-symbols-outlined">dashboard</span>
            Proyectos
          </NavLink>
          <NavLink to="/tenant/catalog" className={linkClass}>
            <span className="material-symbols-outlined">category</span>
            Catálogo DNP
          </NavLink>
          <NavLink to="/tenant/ai" className={linkClass}>
            <span className="material-symbols-outlined">hub</span>
            Exploración MGA
          </NavLink>
          <NavLink to="/tenant/reports" className={linkClass}>
            <span className="material-symbols-outlined">insert_chart</span>
            Reportes
          </NavLink>
        </nav>
        <div className="border-t border-gray-200 pt-3 space-y-1">
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-[#006162] transition-all"
          >
            <span className="material-symbols-outlined">logout</span>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className={`flex-1 overflow-y-auto print:overflow-visible print:w-full print:m-0 print:p-0 ${isImmersiveAssistant ? 'overflow-hidden' : ''}`}>
        {!isImmersiveAssistant && (
          <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center print:hidden sticky top-0 z-30">
            <h2 className="text-lg font-semibold text-gray-800">Espacio de trabajo</h2>
            <div className="text-sm text-gray-600">{user?.full_name || user?.email}</div>
          </header>
        )}
        <div className={isImmersiveAssistant ? 'h-full' : 'p-6 print:p-0 print:m-0 print:w-full'}>
          <ErrorBoundary key={pathname} fallbackTitle="Error en el espacio de trabajo">
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

      {!hideFloatingFab && (
        <div className="print:hidden">
          <FloatingAssistant />
        </div>
      )}
    </div>
  );
}
