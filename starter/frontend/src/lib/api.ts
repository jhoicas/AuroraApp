import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const TOKEN_KEY = 'aurora_token';
const REFRESH_KEY = 'aurora_refresh_token';

export const getStoredToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const getStoredRefreshToken = (): string | null => localStorage.getItem(REFRESH_KEY);

export const setStoredToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const setStoredRefreshToken = (token: string): void => {
  localStorage.setItem(REFRESH_KEY, token);
};

export const clearStoredToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;
let refreshPromise: Promise<string | null> | null = null;

export const setUnauthorizedHandler = (handler: UnauthorizedHandler): void => {
  onUnauthorized = handler;
};

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  try {
    const { data } = await axios.post<{ token: string; refresh_token: string }>(
      `${import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'}/auth/refresh`,
      { refresh_token: refreshToken },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000 },
    );
    setStoredToken(data.token);
    setStoredRefreshToken(data.refresh_token);
    return data.token;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;

      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      const newToken = await refreshPromise;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }

      clearStoredToken();
      onUnauthorized?.();
    }

    if (error.response?.status === 403) {
      console.warn('Forbidden:', original?.url);
    }

    return Promise.reject(error);
  },
);

// --- Formulación MGA (causas, objetivos específicos, indicadores) ---
export {
  fetchMgaFormulation,
  listMgaCauses,
  createMgaCause,
  updateMgaCause,
  deleteMgaCause,
  updateMgaObjective,
  listMgaIndicators,
  createMgaIndicator,
  updateMgaIndicator,
  deleteMgaIndicator,
} from './mgaApi';

export type {
  MgaCauseType,
  MgaSpecificObjective,
  MgaCause,
  MgaIndicator,
  MgaFormulation,
  CreateMgaCausePayload,
  UpdateMgaCausePayload,
  UpdateMgaObjectivePayload,
  CreateMgaIndicatorPayload,
  UpdateMgaIndicatorPayload,
} from './mgaApi';
