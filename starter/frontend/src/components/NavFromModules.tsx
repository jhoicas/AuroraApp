import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAccessStore } from '../store/accessStore';
import { buildNavItems, isGroupActive, type NavItem } from '../lib/navModules';

type NavFromModulesProps = {
  /** TENANT: menú de la entidad; ADMIN: menú de plataforma (Super Admin). */
  scope: 'TENANT' | 'ADMIN';
};

// ── Estilos idénticos a los menús anteriores (TenantLayout / SuperAdminLayout) ──

const tenantLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006162] ${
    isActive
      ? 'bg-teal-50 text-[#006162] border-l-4 border-[#006162] font-semibold'
      : 'text-gray-600 hover:bg-gray-50 hover:text-[#006162]'
  }`;

const adminLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006162] ${
    isActive
      ? 'bg-[#e7eeff] text-[#006162] border-l-4 border-[#006162] font-bold translate-x-0.5'
      : 'text-[#3f4949] hover:bg-[#f0f3ff] hover:text-[#006162]'
  }`;

function adminSubClass({ isActive }: { isActive: boolean }) {
  return `block pl-11 pr-3 py-2 rounded-lg text-base font-semibold transition-colors ${
    isActive ? 'text-[#006a68] bg-[#E6FFFA]' : 'text-[#2f855a] hover:bg-[#E6FFFA] hover:text-[#006a68]'
  }`;
}

function AdminGroup({ item }: { item: NavItem }) {
  const { pathname } = useLocation();
  const active = isGroupActive(item, pathname);
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006162] ${
          active
            ? 'bg-[#e7eeff] text-[#006162] border-l-4 border-[#006162] font-bold'
            : 'text-[#3f4949] hover:bg-[#f0f3ff] hover:text-[#006162]'
        }`}
        aria-expanded={open}
      >
        <span className="material-symbols-outlined">{item.entry.icon}</span>
        <span className="text-lg font-semibold flex-1 text-left">{item.node.name}</span>
        <span
          className={`material-symbols-outlined text-[20px] transition-transform ${open ? 'rotate-180' : ''}`}
        >
          expand_more
        </span>
      </button>
      {open && (
        <div className="mt-1 space-y-0.5 border-l-2 border-[#94f2f0] ml-5">
          {item.children.map((child) => (
            <NavLink key={child.node.code} to={child.node.route} className={adminSubClass}>
              {child.node.name}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Menú lateral construido desde el árbol de módulos del servidor (accessStore).
 * Solo muestra módulos habilitados, con permiso `view` y con UI registrada en moduleRegistry.
 */
export default function NavFromModules({ scope }: NavFromModulesProps) {
  const tree = useAccessStore((s) => s.nav[scope === 'ADMIN' ? 'PLATFORM' : 'TENANT']);
  const items = buildNavItems(tree);

  if (scope === 'TENANT') {
    return (
      <>
        {items.map(({ node, entry }) => (
          <NavLink key={node.code} to={node.route} className={tenantLinkClass}>
            <span className="material-symbols-outlined">{entry.icon}</span>
            {node.name}
          </NavLink>
        ))}
      </>
    );
  }

  return (
    <>
      {items.map((item) =>
        item.children.length > 0 ? (
          <AdminGroup key={item.node.code} item={item} />
        ) : (
          <NavLink key={item.node.code} to={item.node.route} className={adminLinkClass}>
            <span className="material-symbols-outlined">{item.entry.icon}</span>
            <span className="text-lg font-semibold">{item.node.name}</span>
          </NavLink>
        ),
      )}
    </>
  );
}
