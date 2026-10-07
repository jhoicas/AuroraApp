import { api } from './api';

export type DocumentTemplate = {
  id: string;
  tenant_id: string | null;
  name: string;
  html_content?: string;
  is_active: boolean;
  is_system_default: boolean;
  created_at: string;
  updated_at: string;
};

const BASE = '/tenant/document-templates';

export async function listDocumentTemplates(): Promise<DocumentTemplate[]> {
  const { data } = await api.get<{ data: DocumentTemplate[] }>(BASE);
  return data.data ?? [];
}

export async function getDocumentTemplate(id: string): Promise<DocumentTemplate> {
  const { data } = await api.get<{ data: DocumentTemplate }>(`${BASE}/${id}`);
  return data.data;
}

export async function createDocumentTemplate(input: {
  name: string;
  html_content?: string;
  clone_from_id?: string;
}): Promise<DocumentTemplate> {
  const { data } = await api.post<{ data: DocumentTemplate }>(BASE, input);
  return data.data;
}

/** Autoguardado: PATCH parcial (solo los campos enviados cambian). */
export async function patchDocumentTemplate(
  id: string,
  patch: { name?: string; html_content?: string },
): Promise<DocumentTemplate> {
  const { data } = await api.patch<{ data: DocumentTemplate }>(`${BASE}/${id}`, patch);
  return data.data;
}

export async function activateDocumentTemplate(id: string): Promise<DocumentTemplate> {
  const { data } = await api.patch<{ data: DocumentTemplate }>(`${BASE}/${id}/activate`);
  return data.data;
}
