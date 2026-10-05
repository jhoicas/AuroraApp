import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import TenantLayout from './TenantLayout';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Test', email: 't@t.co', role: 'user' }, logout: vi.fn() }),
}));
vi.mock('../components/AuroraAsistente/FloatingAssistant', () => ({ default: () => null }));

function setWidth(w: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: w });
}

describe('TenantLayout menú móvil', () => {
  beforeEach(() => setWidth(500));

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
