import { api } from './api';
import type { Proceso, Region, Departamento, Municipio } from '../store/catalogStore';

// ─────────────────────────── Procesos ───────────────────────────

export const adminImportProcesos = async (procesos: Partial<Proceso>[]): Promise<void> => {
  await api.post('/admin/procesos/import', { procesos });
};

export const adminListProcesos = async (isActive?: boolean, search?: string): Promise<Proceso[]> => {
  const params = new URLSearchParams();
  if (isActive !== undefined) params.append('isActive', String(isActive));
  if (search) params.append('search', search);
  
  const { data } = await api.get<{ data: Proceso[] }>(`/admin/procesos?${params.toString()}`);
  return data.data;
};

export const adminCreateProceso = async (payload: { id: number; name: string }): Promise<Proceso> => {
  const { data } = await api.post<Proceso>('/admin/procesos', payload);
  return data;
};

export const adminUpdateProceso = async (id: number, name: string): Promise<void> => {
  await api.put(`/admin/procesos/${id}`, { name });
};

export const adminToggleProceso = async (id: number): Promise<boolean> => {
  const { data } = await api.delete<{ status: string; is_active: boolean }>(`/admin/procesos/${id}`);
  return data.is_active;
};

// ─────────────────────────── Localizaciones ───────────────────────────

export const adminImportLocations = async (localizaciones: any[]): Promise<void> => {
  await api.post('/admin/locations/import', { localizaciones });
};

export const adminCreateRegion = async (payload: { id: number; name: string }): Promise<Region> => {
  const { data } = await api.post<Region>('/admin/locations/regiones', payload);
  return data;
};

export const adminUpdateRegion = async (id: number, name: string): Promise<void> => {
  await api.put(`/admin/locations/regiones/${id}`, { name });
};

export const adminToggleRegion = async (id: number): Promise<boolean> => {
  const { data } = await api.delete<{ status: string; is_active: boolean }>(`/admin/locations/regiones/${id}`);
  return data.is_active;
};

export const adminCreateDepartamento = async (payload: { id: number; name: string; region_id: number }): Promise<Departamento> => {
  const { data } = await api.post<Departamento>('/admin/locations/departamentos', payload);
  return data;
};

export const adminUpdateDepartamento = async (id: number, name: string): Promise<void> => {
  await api.put(`/admin/locations/departamentos/${id}`, { name });
};

export const adminToggleDepartamento = async (id: number): Promise<boolean> => {
  const { data } = await api.delete<{ status: string; is_active: boolean }>(`/admin/locations/departamentos/${id}`);
  return data.is_active;
};

export const adminCreateMunicipio = async (payload: { id: number; name: string; departamento_id: number }): Promise<Municipio> => {
  const { data } = await api.post<Municipio>('/admin/locations/municipios', payload);
  return data;
};

export const adminUpdateMunicipio = async (id: number, name: string): Promise<void> => {
  await api.put(`/admin/locations/municipios/${id}`, { name });
};

export const adminToggleMunicipio = async (id: number): Promise<boolean> => {
  const { data } = await api.delete<{ status: string; is_active: boolean }>(`/admin/locations/municipios/${id}`);
  return data.is_active;
};
