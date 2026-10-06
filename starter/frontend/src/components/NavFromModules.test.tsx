import { render, screen, fireEvent, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import NavFromModules from './NavFromModules';
import { useAccessStore, type AccessModule } from '../store/accessStore';
import { mod, NONE, platformModules, tenantModules } from '../test/accessFixtures';

function setNav(tenant: AccessModule[], platform: AccessModule[] = []) {
  useAccessStore.setState({ nav: { TENANT: tenant, PLATFORM: platform } });
}

function renderNav(scope: 'TENANT' | 'ADMIN', path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <nav>
        <NavFromModules scope={scope} />
      </nav>
    </MemoryRouter>,
  );
}

describe('NavFromModules', () => {
  beforeEach(() => {
    useAccessStore.getState().reset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('TENANT: enlaces con ícono y nombre del módulo, en orden, sin mga ni users', () => {
    setNav(tenantModules().filter((m) => m.permissions.view));
    const { container } = renderNav('TENANT', '/tenant/projects');

    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['dashboardProyectos', 'categoryCatálogo DNP', 'hubExploración MGA', 'insert_chartReportes']);
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/tenant/projects', '/tenant/catalog', '/tenant/ai', '/tenant/reports']);
    expect(container.querySelectorAll('.material-symbols-outlined')).toHaveLength(4);
    // Estilo activo idéntico al menú anterior.
    expect(links[0].className).toContain('bg-teal-50');
    expect(links[1].className).toContain('text-gray-600');
  });

  it('oculta módulos sin view o deshabilitados (por el selector del store)', () => {
    setNav(tenantModules({ reports: { enabled: false }, catalog: { permissions: NONE } }).filter((m) => m.enabled && m.permissions.view));
    renderNav('TENANT', '/tenant/projects');
    expect(screen.queryByText('Reportes')).toBeNull();
    expect(screen.queryByText('Catálogo DNP')).toBeNull();
    expect(screen.getByText('Proyectos')).toBeInTheDocument();
  });

  it('un módulo del servidor sin registro no rompe el menú', () => {
    setNav([...tenantModules().slice(0, 1), mod('algo.futuro', 'Futuro', '/tenant/futuro', { order: 5 })]);
    renderNav('TENANT', '/tenant/projects');
    expect(screen.getByText('Proyectos')).toBeInTheDocument();
    expect(screen.queryByText('Futuro')).toBeNull();
  });

  it('ADMIN: enlaces simples, grupos desplegables y estilos del menú de Super Admin', () => {
    setNav([], platformModules());
    renderNav('ADMIN', '/admin/tenants');

    expect(screen.getByRole('link', { name: /Gestión de Tenants/ })).toHaveAttribute('href', '/admin/tenants');
    expect(screen.getByRole('link', { name: /Gestión de Tenants/ }).className).toContain('bg-[#e7eeff]');
    expect(screen.getByRole('link', { name: /Gestión IA Aurora/ })).toHaveAttribute('href', '/admin/ai');
    expect(screen.getByRole('link', { name: /Settings/ })).toHaveAttribute('href', '/admin/settings');

    const group = screen.getByRole('button', { name: /Catálogos Maestros/ });
    expect(group).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Sectores' })).toBeNull();
    fireEvent.click(group);
    expect(group).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Sectores' })).toHaveAttribute('href', '/admin/catalogs/sectors');
    expect(screen.getByRole('link', { name: 'Catálogo de Entregables' })).toBeInTheDocument();
    fireEvent.click(group);
    expect(screen.queryByRole('link', { name: 'Sectores' })).toBeNull();
  });

  it('ADMIN: el grupo activo arranca abierto y el de catálogos MGA no activa el de maestros', () => {
    setNav([], platformModules());
    renderNav('ADMIN', '/admin/catalogs/mga-actors');
    expect(screen.getByRole('button', { name: /Catálogos MGA/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /Catálogos Maestros/ })).toHaveAttribute('aria-expanded', 'false');
    const active = screen.getByRole('link', { name: 'Actores MGA' });
    expect(active.className).toContain('text-[#006a68]');
    expect(within(active.parentElement as HTMLElement).getByRole('link', { name: 'Entidades MGA' }).className).toContain('text-[#2f855a]');
  });

  it('ADMIN: oculta lo que el servidor no concede', () => {
    setNav([], platformModules().filter((m) => m.code !== 'admin.ai' && m.code !== 'admin.catalogs'));
    renderNav('ADMIN', '/admin/tenants');
    expect(screen.queryByText('Gestión IA Aurora')).toBeNull();
    expect(screen.queryByText('Catálogos Maestros')).toBeNull();
    expect(screen.getByText('Catálogos MGA')).toBeInTheDocument();
  });
});
