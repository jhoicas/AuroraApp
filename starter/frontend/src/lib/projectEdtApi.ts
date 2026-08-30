import { api } from './api';

export type ProjectCatalogLink = {
  id: string;
  tenant_id: string;
  project_id: string;
  product_id: string;
  product_code: string;
  tipologia: string;
  requires_edt: boolean;
  sector_code: string;
  program_code: string;
  created_at: string;
  updated_at: string;
};

export type ProjectEdtNode = {
  id: string;
  tenant_id: string;
  project_id: string;
  catalog_edt_id?: string | null;
  code: string;
  level: number;
  name: string;
  created_at: string;
  updated_at: string;
};

export type ProjectDeliverable = {
  id: string;
  tenant_id: string;
  project_id: string;
  project_edt_node_id: string;
  catalog_deliverable_id?: string | null;
  code: string;
  name: string;
  amount: number;
  created_at: string;
  updated_at: string;
};

export type ProjectActivity = {
  id: string;
  tenant_id: string;
  project_id: string;
  project_deliverable_id: string;
  catalog_activity_id?: string | null;
  code: string;
  name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  created_at: string;
  updated_at: string;
};

export type EdtChainResponse = {
  catalog_link?: ProjectCatalogLink | null;
  edt_nodes: ProjectEdtNode[];
  deliverables: ProjectDeliverable[];
  activities: ProjectActivity[];
};

export type CreateEdtNodePayload = {
  catalog_edt_id?: string;
  code: string;
  level: number;
  name: string;
};

export type UpdateEdtNodePayload = {
  catalog_edt_id?: string | null;
  code?: string;
  level?: number;
  name?: string;
};

export type CreateDeliverablePayload = {
  project_edt_node_id: string;
  catalog_deliverable_id?: string;
  code: string;
  name: string;
  amount: number;
};

export type UpdateDeliverablePayload = {
  project_edt_node_id?: string;
  catalog_deliverable_id?: string | null;
  code?: string;
  name?: string;
  amount?: number;
};

export type CreateActivityPayload = {
  project_deliverable_id: string;
  catalog_activity_id?: string;
  code: string;
  name: string;
  quantity: number;
  unit_cost: number;
};

export type UpdateActivityPayload = {
  project_deliverable_id?: string;
  catalog_activity_id?: string | null;
  code?: string;
  name?: string;
  quantity?: number;
  unit_cost?: number;
  total_cost?: number;
};

function normalizeEdtChain(data: EdtChainResponse): EdtChainResponse {
  return {
    catalog_link: data.catalog_link ?? null,
    edt_nodes: data.edt_nodes ?? [],
    deliverables: data.deliverables ?? [],
    activities: data.activities ?? [],
  };
}

export async function linkCatalogProduct(
  projectId: string,
  productCode: string,
): Promise<ProjectCatalogLink> {
  const { data } = await api.post<ProjectCatalogLink>(`/projects/${projectId}/catalog-link`, {
    product_code: productCode,
  });
  return data;
}

export async function getEdtChain(projectId: string): Promise<EdtChainResponse> {
  const { data } = await api.get<EdtChainResponse>(`/projects/${projectId}/edt-chain`);
  return normalizeEdtChain(data);
}

export async function createEdtNode(
  projectId: string,
  payload: CreateEdtNodePayload,
): Promise<ProjectEdtNode> {
  const { data } = await api.post<ProjectEdtNode>(`/projects/${projectId}/edt-nodes`, payload);
  return data;
}

export async function updateEdtNode(
  projectId: string,
  nodeId: string,
  payload: UpdateEdtNodePayload,
): Promise<ProjectEdtNode> {
  const { data } = await api.put<ProjectEdtNode>(
    `/projects/${projectId}/edt-nodes/${nodeId}`,
    payload,
  );
  return data;
}

export async function deleteEdtNode(projectId: string, nodeId: string): Promise<void> {
  await api.delete(`/projects/${projectId}/edt-nodes/${nodeId}`);
}

export async function createDeliverable(
  projectId: string,
  payload: CreateDeliverablePayload,
): Promise<ProjectDeliverable> {
  const { data } = await api.post<ProjectDeliverable>(
    `/projects/${projectId}/deliverables`,
    payload,
  );
  return data;
}

export async function updateDeliverable(
  projectId: string,
  deliverableId: string,
  payload: UpdateDeliverablePayload,
): Promise<ProjectDeliverable> {
  const { data } = await api.put<ProjectDeliverable>(
    `/projects/${projectId}/deliverables/${deliverableId}`,
    payload,
  );
  return data;
}

export async function deleteDeliverable(
  projectId: string,
  deliverableId: string,
): Promise<void> {
  await api.delete(`/projects/${projectId}/deliverables/${deliverableId}`);
}

export async function createActivity(
  projectId: string,
  payload: CreateActivityPayload,
): Promise<ProjectActivity> {
  const { data } = await api.post<ProjectActivity>(`/projects/${projectId}/activities`, payload);
  return data;
}

export async function updateActivity(
  projectId: string,
  activityId: string,
  payload: UpdateActivityPayload,
): Promise<ProjectActivity> {
  const { data } = await api.put<ProjectActivity>(
    `/projects/${projectId}/activities/${activityId}`,
    payload,
  );
  return data;
}

export async function deleteActivity(projectId: string, activityId: string): Promise<void> {
  await api.delete(`/projects/${projectId}/activities/${activityId}`);
}
