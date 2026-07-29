import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogoAurora } from '../components/LogoAurora';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006162] ${
    isActive
      ? 'bg-[#e7eeff] text-[#006162] border-l-4 border-[#006162] font-bold translate-x-0.5'
      : 'text-[#3f4949] hover:bg-[#f0f3ff] hover:text-[#006162]'
  }`;

const catalogSubLinks = [
  { to: '/admin/catalogs/sectors', label: 'Sectores' },
  { to: '/admin/catalogs/programs', label: 'Programas' },
  { to: '/admin/catalogs/products', label: 'Productos' },
  { to: '/admin/catalogs/indicators', label: 'Catálogo EDT' },
  { to: '/admin/catalogs/funding-sources', label: 'Fuentes de Financiamiento' },
] as const;

function headerTitle(pathname: string): string {
  if (pathname.includes('/admin/catalogs/sectors')) return 'Sectores';
  if (pathname.includes('/admin/catalogs/programs')) return 'Programas';
  if (pathname.includes('/admin/catalogs/products')) return 'Productos';
  if (pathname.includes('/admin/catalogs/indicators')) return 'Catálogo EDT';
  if (pathname.includes('/admin/catalogs/funding')) return 'Fuentes de Financiamiento';
  if (pathname.includes('/admin/catalog')) return 'Catálogos Maestros';
  if (pathname.includes('/admin/tenants')) return 'Gestión de Tenants';
  if (pathname.includes('/admin/ai')) return 'Gestión IA Aurora';
  if (pathname.includes('/admin/security') || pathname.includes('/admin/settings')) {
    return 'Settings';
  }
  return 'Dashboard';
}

function catalogSubClass({ isActive }: { isActive: boolean }) {
  return `block pl-11 pr-3 py-2 rounded-lg text-base font-semibold transition-colors ${
    isActive
      ? 'text-[#006a68] bg-[#E6FFFA]'
      : 'text-[#2f855a] hover:bg-[#E6FFFA] hover:text-[#006a68]'
  }`;
}

export default function SuperAdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const catalogsActive = pathname.startsWith('/admin/catalogs') || pathname.startsWith('/admin/catalogo');
  const [catalogsOpen, setCatalogsOpen] = useState(catalogsActive);

  useEffect(() => {
    if (catalogsActive) setCatalogsOpen(true);
  }, [catalogsActive]);

  return (
    <div className="flex h-screen bg-[#f9f9ff] font-body">
      <aside className="w-[280px] bg-white border-r border-[#bec9c8] flex flex-col p-6 shrink-0">
        <div className="mb-10">
          <LogoAurora className="w-8 h-8 text-[#006162]" />
          <p className="text-sm text-[#3f4949] mt-2">Public Investment Portal</p>
        </div>
        <nav className="flex-1 flex flex-col space-y-3">
          <NavLink to="/admin/tenants" className={linkClass}>
            <span className="material-symbols-outlined">settings_suggest</span>
            <span className="text-lg font-semibold">Gestión de Tenants</span>
          </NavLink>

          <div>
            <button
              type="button"
              onClick={() => setCatalogsOpen((o) => !o)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006162] ${
                catalogsActive
                  ? 'bg-[#e7eeff] text-[#006162] border-l-4 border-[#006162] font-bold'
                  : 'text-[#3f4949] hover:bg-[#f0f3ff] hover:text-[#006162]'
              }`}
              aria-expanded={catalogsOpen}
            >
              <span className="material-symbols-outlined">edit_document</span>
              <span className="text-lg font-semibold flex-1 text-left">Catálogos Maestros</span>
              <span
                className={`material-symbols-outlined text-[20px] transition-transform ${
                  catalogsOpen ? 'rotate-180' : ''
                }`}
              >
                expand_more
              </span>
            </button>
            {catalogsOpen && (
              <div className="mt-1 space-y-0.5 border-l-2 border-[#94f2f0] ml-5">
                {catalogSubLinks.map((item) => (
                  <NavLink key={item.to} to={item.to} className={catalogSubClass}>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          <NavLink to="/admin/ai" className={linkClass}>
            <span className="material-symbols-outlined">psychology</span>
            <span className="text-lg font-semibold">Gestión IA Aurora</span>
          </NavLink>
          <NavLink to="/admin/settings" className={linkClass}>
            <span className="material-symbols-outlined">settings</span>
            <span className="text-lg font-semibold">Settings</span>
          </NavLink>
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
            {headerTitle(pathname)}
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
          <Outlet />
        </div>
      </main>
    </div>
  );
}
