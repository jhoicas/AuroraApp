import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  api,
  clearStoredToken,
  getStoredToken,
  setStoredToken,
  setUnauthorizedHandler,
} from '../lib/api';
import { normalizeRole } from '../lib/roles';

export type AuthUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  tenant_id: string | null;
};

type LoginResponse = {
  token: string;
  user: AuthUser;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
};

const USER_KEY = 'aurora_user';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function canonicalizeUser(user: AuthUser): AuthUser {
  return {
    ...user,
    role: normalizeRole(user.role) || user.role,
    tenant_id: user.tenant_id ?? null,
  };
}

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return canonicalizeUser(JSON.parse(raw) as AuthUser);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    clearStoredToken();
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    });
    setIsLoading(false);
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<LoginResponse>('/auth/login', {
      email: email.trim().toLowerCase(),
      password,
    });

    const user = canonicalizeUser(data.user);
    setStoredToken(data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setToken(data.token);
    setUser(user);
    return user;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      isLoading,
      login,
      logout,
    }),
    [user, token, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
