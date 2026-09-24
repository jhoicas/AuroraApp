import { api } from './api';
import type { Proceso } from '../store/catalogStore';
import type { Region, Departamento, Municipio } from '../store/locationStore';
// ─────────────────────────── Procesos ───────────────────────────

export const adminImportProcesos = async (procesos: Partial<Proceso>[]): Promise<void> => {
  await api.post('/admin/procesos/import', { procesos });
};

export interface PaginationMeta {
  page: number;
  last_page: number;
  total: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export const adminListProcesos = async (isActive?: boolean, search?: string, page: number = 1, limit: number = 10): Promise<PaginatedResponse<Proceso>> => {
  const params = new URLSearchParams();
  if (isActive !== undefined) params.append('isActive', String(isActive));
  if (search) params.append('search', search);
  params.append('page', String(page));
  params.append('limit', String(limit));
  
  const { data } = await api.get<PaginatedResponse<Proceso>>(`/admin/procesos?${params.toString()}`);
  return data;
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

export const adminListLocations = async (
  type: 'regiones' | 'departamentos' | 'municipios',
  search?: string,
  page: number = 1,
  limit: number = 10
): Promise<PaginatedResponse<any>> => {
  const params = new URLSearchParams();
  params.append('type', type);
  if (search) params.append('search', search);
  params.append('page', String(page));
  params.append('limit', String(limit));
  
  const { data } = await api.get<PaginatedResponse<any>>(`/admin/locations?${params.toString()}`);
  return data;
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

// ─────────────────────────── Catálogos MGA ───────────────────────────

export interface AdminMgaActor {
  id: number;
  name: string;
}

export interface AdminMgaEntity {
  id: number;
  actor_id: number;
  name: string;
}

export interface AdminMgaPosition {
  id: number;
  name: string;
}

export const adminListMgaActors = async (): Promise<AdminMgaActor[]> => {
  const { data } = await api.get<AdminMgaActor[]>('/admin/mga/catalogs/actors');
  return data;
};

export const adminCreateMgaActor = async (payload: { id: number; name: string }): Promise<AdminMgaActor> => {
  const { data } = await api.post<AdminMgaActor>('/admin/mga/catalogs/actors', payload);
  return data;
};

export const adminUpdateMgaActor = async (id: number, name: string): Promise<void> => {
  await api.put(`/admin/mga/catalogs/actors/${id}`, { name });
};

export const adminDeleteMgaActor = async (id: number): Promise<void> => {
  await api.delete(`/admin/mga/catalogs/actors/${id}`);
};

export const adminListMgaEntities = async (): Promise<AdminMgaEntity[]> => {
  const { data } = await api.get<AdminMgaEntity[]>('/admin/mga/catalogs/entities');
  return data;
};

export const adminListMgaEntitiesByActor = async (actorId: number): Promise<AdminMgaEntity[]> => {
  const { data } = await api.get<AdminMgaEntity[]>(`/admin/mga/catalogs/actors/${actorId}/entities`);
  return data;
};

export const adminCreateMgaEntity = async (payload: { id: number; actor_id: number; name: string }): Promise<AdminMgaEntity> => {
  const { data } = await api.post<AdminMgaEntity>('/admin/mga/catalogs/entities', payload);
  return data;
};

export const adminUpdateMgaEntity = async (id: number, payload: { actor_id?: number; name: string }): Promise<void> => {
  await api.put(`/admin/mga/catalogs/entities/${id}`, payload);
};

export const adminDeleteMgaEntity = async (id: number): Promise<void> => {
  await api.delete(`/admin/mga/catalogs/entities/${id}`);
};

export const adminListMgaPositions = async (): Promise<AdminMgaPosition[]> => {
  const { data } = await api.get<AdminMgaPosition[]>('/admin/mga/catalogs/positions');
  return data;
};

export const adminCreateMgaPosition = async (payload: { id: number; name: string }): Promise<AdminMgaPosition> => {
  const { data } = await api.post<AdminMgaPosition>('/admin/mga/catalogs/positions', payload);
  return data;
};

export const adminUpdateMgaPosition = async (id: number, name: string): Promise<void> => {
  await api.put(`/admin/mga/catalogs/positions/${id}`, { name });
};

export const adminDeleteMgaPosition = async (id: number): Promise<void> => {
  await api.delete(`/admin/mga/catalogs/positions/${id}`);
};

