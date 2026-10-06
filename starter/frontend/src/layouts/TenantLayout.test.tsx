import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import TenantLayout from './TenantLayout';
import { useAccessStore } from '../store/accessStore';
import { tenantModules } from '../test/accessFixtures';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Test', email: 't@t.co', role: 'user' }, logout: vi.fn() }),
}));
vi.mock('../components/AuroraAsistente/FloatingAssistant', () => ({ default: () => null }));

function setWidth(w: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: w });
}

describe('TenantLayout menú móvil', () => {
  beforeEach(() => {
    setWidth(500);
    useAccessStore.setState({ nav: { TENANT: [], PLATFORM: [] } });
  });

  it('muestra backdrop y cierra al hacer clic en él', () => {
    render(<MemoryRouter><TenantLayout /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar menú' }));
    const backdrop = screen.getByTestId('sidebar-backdrop');
    expect(backdrop.className).toContain('bg-black/50');
    fireEvent.click(backdrop);
    expect(screen.queryByTestId('sidebar-backdrop')).toBeNull();
  });

  it('cierra con el botón X', () => {
    render(<MemoryRouter><TenantLayout /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar menú' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar menú' }));
    expect(screen.queryByTestId('sidebar-backdrop')).toBeNull();
  });
});

describe('TenantLayout navegación dinámica', () => {
  beforeEach(() => {
    setWidth(1200);
    useAccessStore.setState({ nav: { TENANT: tenantModules().filter((m) => m.permissions.view), PLATFORM: [] } });
  });

  it('el menú sale del árbol de módulos y el header toma el título del módulo activo', () => {
    render(
      <MemoryRouter initialEntries={['/tenant/catalog']}>
        <TenantLayout />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('link').map((l) => l.textContent)).toEqual([
      'dashboardProyectos', 'categoryCatálogo DNP', 'hubExploración MGA', 'insert_chartReportes',
    ]);
    expect(screen.getByRole('heading', { level: 2, name: 'Catálogo DNP' })).toBeInTheDocument();
  });

  it('sin módulo activo conserva el título anterior', () => {
    render(
      <MemoryRouter initialEntries={['/tenant/otra-cosa']}>
        <TenantLayout />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Espacio de trabajo' })).toBeInTheDocument();
  });
});
