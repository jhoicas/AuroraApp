import { api } from './api';

export type MgaCauseType = 'directa' | 'indirecta';

export type MgaSpecificObjective = {
  id: string;
  tenant_id: string;
  project_id: string;
  cause_id: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export type MgaCause = {
  id: string;
  tenant_id: string;
  project_id: string;
  parent_id?: string | null;
  cause_type: MgaCauseType;
  description: string;
  sort_order: number;
  specific_objective?: MgaSpecificObjective | null;
  created_at: string;
  updated_at: string;
};

export type MgaIndicator = {
  id: string;
  tenant_id: string;
  project_id: string;
  specific_objective_id?: string | null;
  name: string;
  unit: string;
  target: number;
  source_type: string;
  verification_source: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type MgaFormulation = {
  causes: MgaCause[];
  indicators: MgaIndicator[];
};

export type CreateMgaCausePayload = {
  cause_type: MgaCauseType;
  description: string;
  parent_id?: string;
  sort_order?: number;
  specific_objective?: string;
};

export type UpdateMgaCausePayload = {
  cause_type?: MgaCauseType;
  description?: string;
  parent_id?: string | null;
  sort_order?: number;
};

export type UpdateMgaObjectivePayload = {
  description: string;
};

export type CreateMgaIndicatorPayload = {
  name: string;
  unit: string;
  target: number;
  source_type: string;
  verification_source: string;
  specific_objective_id?: string;
  sort_order?: number;
};

export type UpdateMgaIndicatorPayload = {
  name?: string;
  unit?: string;
  target?: number;
  source_type?: string;
  verification_source?: string;
  specific_objective_id?: string | null;
  sort_order?: number;
};

export async function fetchMgaFormulation(projectId: string): Promise<MgaFormulation> {
  const { data } = await api.get<MgaFormulation>(`/projects/${projectId}/mga/formulation`);
  return {
    causes: data.causes ?? [],
    indicators: data.indicators ?? [],
  };
}

export async function listMgaCauses(projectId: string): Promise<MgaCause[]> {
  const { data } = await api.get<MgaCause[]>(`/projects/${projectId}/mga/causes`);
  return Array.isArray(data) ? data : [];
}

export async function createMgaCause(
  projectId: string,
  payload: CreateMgaCausePayload,
): Promise<MgaCause> {
  const { data } = await api.post<MgaCause>(`/projects/${projectId}/mga/causes`, payload);
  return data;
}

export async function updateMgaCause(
  projectId: string,
  causeId: string,
  payload: UpdateMgaCausePayload,
): Promise<MgaCause> {
  const { data } = await api.put<MgaCause>(`/projects/${projectId}/mga/causes/${causeId}`, payload);
  return data;
}

export async function deleteMgaCause(projectId: string, causeId: string): Promise<void> {
  await api.delete(`/projects/${projectId}/mga/causes/${causeId}`);
}

export async function updateMgaObjective(
  projectId: string,
  objectiveId: string,
  payload: UpdateMgaObjectivePayload,
): Promise<MgaSpecificObjective> {
  const { data } = await api.put<MgaSpecificObjective>(
    `/projects/${projectId}/mga/objectives/${objectiveId}`,
    payload,
  );
  return data;
}

export async function listMgaIndicators(projectId: string): Promise<MgaIndicator[]> {
  const { data } = await api.get<MgaIndicator[]>(`/projects/${projectId}/mga/indicators`);
  return Array.isArray(data) ? data : [];
}

export async function createMgaIndicator(
  projectId: string,
  payload: CreateMgaIndicatorPayload,
): Promise<MgaIndicator> {
  const { data } = await api.post<MgaIndicator>(`/projects/${projectId}/mga/indicators`, payload);
  return data;
}

export async function updateMgaIndicator(
  projectId: string,
  indicatorId: string,
  payload: UpdateMgaIndicatorPayload,
): Promise<MgaIndicator> {
  const { data } = await api.put<MgaIndicator>(
    `/projects/${projectId}/mga/indicators/${indicatorId}`,
    payload,
  );
  return data;
}

export async function deleteMgaIndicator(projectId: string, indicatorId: string): Promise<void> {
  await api.delete(`/projects/${projectId}/mga/indicators/${indicatorId}`);
}
