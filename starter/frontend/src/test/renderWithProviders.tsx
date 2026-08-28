import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';

type RenderWithProvidersOptions = Omit<RenderOptions, 'wrapper'> & {
  /** Ruta inicial del MemoryRouter (alimenta useLocation → routeContext del copiloto). */
  route?: string;
  /** Envuelve en AuthProvider (necesario para componentes que usan useAuth). */
  withAuth?: boolean;
};

type RenderWithProvidersResult = RenderResult & {
  user: ReturnType<typeof userEvent.setup>;
  /** Ruta actual del router, para verificar navegaciones. */
  currentLocation: () => string;
};

const AUTH_USER_KEY = 'aurora_user';
const TOKEN_KEY = 'aurora_token';

export type SeedAuthUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  tenant_id: string | null;
};

/** Precarga un usuario autenticado en localStorage antes de montar AuthProvider. */
export function seedAuthUser(overrides: Partial<SeedAuthUser> = {}): void {
  const user: SeedAuthUser = {
    id: 'user-1',
    email: 'formulador@alcaldia.gov.co',
    full_name: 'Ana Pérez',
    role: 'FORMULADOR',
    tenant_id: 'tenant-1',
    ...overrides,
  };
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  localStorage.setItem(TOKEN_KEY, 'token-de-prueba');
}

/**
 * Renderiza con Router (+ Auth opcional) y devuelve un `user` de user-event
 * ya configurado, para simular interacciones reales en vez de eventos sintéticos.
 */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/tenant/projects', withAuth = false, ...options }: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  let location = route;

  function LocationSpy(): null {
    location = useLocation().pathname;
    return null;
  }

  function Wrapper({ children }: { children: ReactNode }) {
    const tree = (
      <MemoryRouter initialEntries={[route]}>
        {children}
        <LocationSpy />
      </MemoryRouter>
    );
    return withAuth ? <AuthProvider>{tree}</AuthProvider> : tree;
  }

  const user = userEvent.setup();
  const result = render(ui, { wrapper: Wrapper, ...options });

  return { ...result, user, currentLocation: () => location };
}
