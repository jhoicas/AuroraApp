import { api } from './api';

export type SystemSettings = {
  support_email: string;
  banner_enabled: boolean;
  banner_message: string;
  token_expiry_minutes: number;
  force_session_expiry: boolean;
  maintenance_mode: boolean;
};

export type SystemStatus = {
  maintenance_mode: boolean;
  banner_enabled: boolean;
  banner_message: string;
  support_email: string;
};

export const TOKEN_EXPIRY_MIN = 5;
export const TOKEN_EXPIRY_MAX = 1440;

export async function fetchSystemSettings(): Promise<SystemSettings> {
  const { data } = await api.get<SystemSettings>('/admin/settings');
  return data;
}

export async function saveSystemSettings(payload: SystemSettings): Promise<SystemSettings> {
  const { data } = await api.put<SystemSettings>('/admin/settings', payload);
  return data;
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const { data } = await api.get<SystemStatus>('/system/status');
  return data;
}
