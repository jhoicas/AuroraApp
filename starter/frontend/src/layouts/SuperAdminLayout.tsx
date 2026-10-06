import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Suspense } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogoAurora } from '../components/LogoAurora';
import FloatingAssistant from '../components/AuroraAsistente/FloatingAssistant';
import ErrorBoundary from '../components/ErrorBoundary';
import NavFromModules from '../components/NavFromModules';
import { useAccessStore } from '../store/accessStore';
import { titleForPath } from '../lib/navModules';

export default function SuperAdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const platformNav = useAccessStore((s) => s.nav.PLATFORM);
  const headerTitle = titleForPath(platformNav, pathname) ?? 'Dashboard';

  return (
    <div className="flex h-screen bg-[#f9f9ff] font-body">
      <aside className="w-[280px] bg-white border-r border-[#bec9c8] flex flex-col p-6 shrink-0">
        <div className="mb-10">
          <LogoAurora className="w-8 h-8 text-[#006162]" />
          <p className="text-sm text-[#3f4949] mt-2">Public Investment Portal</p>
        </div>
        <nav className="flex-1 flex flex-col space-y-3">
          <NavFromModules scope="ADMIN" />
        </nav>
        <div className="mt-auto pt-6 border-t border-[#bec9c8] space-y-2">
          <NavLink
            to="/admin/tenants"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#3f4949] hover:bg-[#f0f3ff] transition-all"
          >
            <span className="material-symbols-outlined">contact_support</span>
            <span className="text-lg font-semibold">Support</span>
          </NavLink>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#3f4949] hover:bg-[#f0f3ff] hover:text-[#006162]"
          >
            <span className="material-symbols-outlined">logout</span>
            <span className="text-lg font-semibold">Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-[#f9f9ff]">
        <header className="w-full h-16 bg-[#f9f9ff] flex items-center justify-between px-6 md:px-12 sticky top-0 z-30 border-b border-[#bec9c8]">
          <h2 className="font-headline text-2xl md:text-3xl font-bold text-[#006162]">
            {headerTitle}
          </h2>
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-[#3f4949]">notifications</span>
            <span className="material-symbols-outlined text-[#3f4949]">help</span>
            <div className="flex items-center gap-3 pl-4 border-l border-[#bec9c8]">
              <span className="font-semibold text-[#121c2c] hidden sm:inline">
                {user?.full_name || 'Super Admin'}
              </span>
              <div className="w-10 h-10 rounded-full bg-[#94f2f0] flex items-center justify-center border border-[#bec9c8] text-[#006162] font-bold">
                {(user?.full_name || user?.email || 'SA').slice(0, 1).toUpperCase()}
              </div>
            </div>
          </div>
        </header>
        <div className="p-6">
          <ErrorBoundary key={pathname} fallbackTitle="Error en el panel de administración">
            <Suspense fallback={<div className="p-4 text-gray-600">Cargando…</div>}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
      <FloatingAssistant />
    </div>
  );
}
