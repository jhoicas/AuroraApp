import { api } from './api';

export type MgaCauseType = 'directa' | 'indirecta';
export type MgaEffectType = 'directo' | 'indirecto';
export type MgaPopulationType = 'afectada' | 'objetivo';

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

export type MgaEffect = {
  id: string;
  tenant_id: string;
  project_id: string;
  parent_id?: string | null;
  effect_type: MgaEffectType;
  description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type MgaCatalogActor = {
  id: number;
  name: string;
};

export type MgaCatalogEntity = {
  id: number;
  actor_id: number;
  name: string;
};

export type MgaCatalogPosition = {
  id: number;
  name: string;
};

export type MgaParticipant = {
  id: string;
  tenant_id: string;
  project_id: string;
  actor_id: number;
  entity_id: number | null;
  position_id: number;
  otro_participante?: string | null;
  interests: string;
  contribution: string;
  created_at: string;
  updated_at: string;
  /** Alias numérico opcional para compatibilidad */
  actor?: number;
  /** Alias numérico opcional para compatibilidad */
  entity?: number | null;
  /** Alias numérico opcional para compatibilidad */
  position?: number;
};

export type MgaPopulation = {
  id: string;
  tenant_id: string;
  project_id: string;
  population_type: MgaPopulationType;
  total_number: number;
  source: string;
  locations: unknown;
  created_at: string;
  updated_at: string;
};

export type MgaAlternative = {
  id: string;
  tenant_id: string;
  project_id: string;
  description: string;
  evaluate_profitability: boolean;
  evaluate_cost: boolean;
  proceeds_to_preparation: boolean;
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

/** Respuesta completa del backend (FullMgaFormulationResponse). */
export type FullMgaFormulation = {
  causes: MgaCause[];
  effects: MgaEffect[];
  indicators: MgaIndicator[];
  participants: MgaParticipant[];
  populations: MgaPopulation[];
  alternatives: MgaAlternative[];
};

/** @deprecated Usar FullMgaFormulation */
export type MgaFormulation = FullMgaFormulation;

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

export type CreateMgaEffectPayload = {
  effect_type: MgaEffectType;
  description: string;
  parent_id?: string;
  sort_order?: number;
};

export type UpdateMgaEffectPayload = {
  effect_type?: MgaEffectType;
  description?: string;
  parent_id?: string | null;
  sort_order?: number;
};

export type CreateMgaParticipantPayload = {
  actor_id: number;
  entity_id?: number | null;
  position_id: number;
  otro_participante?: string | null;
  interests: string;
  contribution: string;
  /** Compatibilidad: alias numérico */
  actor?: number;
  /** Compatibilidad: alias numérico */
  entity?: number | null;
  /** Compatibilidad: alias numérico */
  position?: number;
};

export type UpdateMgaParticipantPayload = Partial<CreateMgaParticipantPayload>;

export type CreateMgaPopulationPayload = {
  population_type: MgaPopulationType;
  total_number: number;
  source: string;
  locations: unknown;
};

export type UpdateMgaPopulationPayload = {
  population_type?: MgaPopulationType;
  total_number?: number;
  source?: string;
  locations?: unknown;
};

export type CreateMgaAlternativePayload = {
  description: string;
  evaluate_profitability?: boolean;
  evaluate_cost?: boolean;
  proceeds_to_preparation?: boolean;
};

export type UpdateMgaAlternativePayload = {
  description?: string;
  evaluate_profitability?: boolean;
  evaluate_cost?: boolean;
  proceeds_to_preparation?: boolean;
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

export async function fetchMgaFormulation(projectId: string): Promise<FullMgaFormulation> {
  const { data } = await api.get<FullMgaFormulation>(`/projects/${projectId}/mga/formulation`);
  return {
    causes: data.causes ?? [],
    effects: data.effects ?? [],
    indicators: data.indicators ?? [],
    participants: data.participants ?? [],
    populations: data.populations ?? [],
    alternatives: data.alternatives ?? [],
  };
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

export async function createMgaEffect(
  projectId: string,
  payload: CreateMgaEffectPayload,
): Promise<MgaEffect> {
  const { data } = await api.post<MgaEffect>(`/projects/${projectId}/mga/effects`, payload);
  return data;
}

export async function updateMgaEffect(
  projectId: string,
  effectId: string,
  payload: UpdateMgaEffectPayload,
): Promise<MgaEffect> {
  const { data } = await api.put<MgaEffect>(
    `/projects/${projectId}/mga/effects/${effectId}`,
    payload,
  );
  return data;
}

export async function deleteMgaEffect(projectId: string, effectId: string): Promise<void> {
  await api.delete(`/projects/${projectId}/mga/effects/${effectId}`);
}

export async function getMgaActors(): Promise<MgaCatalogActor[]> {
  const { data } = await api.get<MgaCatalogActor[]>('/mga/catalogs/actors');
  return data;
}

export async function getMgaEntitiesByActor(actorId: number): Promise<MgaCatalogEntity[]> {
  const { data } = await api.get<MgaCatalogEntity[]>(`/mga/catalogs/actors/${actorId}/entities`);
  return data;
}

export async function getMgaPositions(): Promise<MgaCatalogPosition[]> {
  const { data } = await api.get<MgaCatalogPosition[]>('/mga/catalogs/positions');
  return data;
}

export async function createMgaParticipant(
  projectId: string,
  payload: CreateMgaParticipantPayload,
): Promise<MgaParticipant> {
  const body = {
    actor_id: payload.actor_id ?? (typeof payload.actor === 'number' ? payload.actor : 0),
    entity_id: payload.entity_id !== undefined ? payload.entity_id : (payload.entity ?? null),
    position_id: payload.position_id ?? (typeof payload.position === 'number' ? payload.position : 0),
    otro_participante: payload.otro_participante ?? null,
    interests: payload.interests,
    contribution: payload.contribution,
  };
  const { data } = await api.post<MgaParticipant>(
    `/projects/${projectId}/mga/participants`,
    body,
  );
  return data;
}

export async function updateMgaParticipant(
  projectId: string,
  participantId: string,
  payload: UpdateMgaParticipantPayload,
): Promise<MgaParticipant> {
  const body: Record<string, unknown> = {};
  if (payload.actor_id !== undefined) body.actor_id = payload.actor_id;
  else if (typeof payload.actor === 'number') body.actor_id = payload.actor;
  if (payload.entity_id !== undefined) body.entity_id = payload.entity_id;
  else if (payload.entity !== undefined) body.entity_id = payload.entity;
  if (payload.position_id !== undefined) body.position_id = payload.position_id;
  else if (typeof payload.position === 'number') body.position_id = payload.position;
  if (payload.otro_participante !== undefined) body.otro_participante = payload.otro_participante;
  if (payload.interests !== undefined) body.interests = payload.interests;
  if (payload.contribution !== undefined) body.contribution = payload.contribution;

  const { data } = await api.put<MgaParticipant>(
    `/projects/${projectId}/mga/participants/${participantId}`,
    body,
  );
  return data;
}

export async function deleteMgaParticipant(
  projectId: string,
  participantId: string,
): Promise<void> {
  await api.delete(`/projects/${projectId}/mga/participants/${participantId}`);
}

export async function createMgaPopulation(
  projectId: string,
  payload: CreateMgaPopulationPayload,
): Promise<MgaPopulation> {
  const { data } = await api.post<MgaPopulation>(
    `/projects/${projectId}/mga/populations`,
    payload,
  );
  return data;
}

export async function updateMgaPopulation(
  projectId: string,
  populationId: string,
  payload: UpdateMgaPopulationPayload,
): Promise<MgaPopulation> {
  const { data } = await api.put<MgaPopulation>(
    `/projects/${projectId}/mga/populations/${populationId}`,
    payload,
  );
  return data;
}

export async function deleteMgaPopulation(
  projectId: string,
  populationId: string,
): Promise<void> {
  await api.delete(`/projects/${projectId}/mga/populations/${populationId}`);
}

export async function createMgaAlternative(
  projectId: string,
  payload: CreateMgaAlternativePayload,
): Promise<MgaAlternative> {
  const { data } = await api.post<MgaAlternative>(
    `/projects/${projectId}/mga/alternatives`,
    payload,
  );
  return data;
}

export async function updateMgaAlternative(
  projectId: string,
  alternativeId: string,
  payload: UpdateMgaAlternativePayload,
): Promise<MgaAlternative> {
  const { data } = await api.put<MgaAlternative>(
    `/projects/${projectId}/mga/alternatives/${alternativeId}`,
    payload,
  );
  return data;
}

export async function deleteMgaAlternative(
  projectId: string,
  alternativeId: string,
): Promise<void> {
  await api.delete(`/projects/${projectId}/mga/alternatives/${alternativeId}`);
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

export async function downloadTechnicalDocumentValle(
  projectId: string,
  projectName?: string,
): Promise<void> {
  const response = await api.get(`/projects/${projectId}/export/technical-document-valle`, {
    responseType: 'blob',
  });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const cleanName = (projectName || 'proyecto')
    .trim()
    .replace(/[^\w\s-áéíóúñÁÉÍÓÚÑ]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 60);
  const filename = `Documento_Tecnico_Valle_${cleanName}.pdf`;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

