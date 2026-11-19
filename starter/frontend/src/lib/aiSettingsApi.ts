import { api } from './api';

export type AISettings = {
  gemini_api_key: string;
  gemini_model: string;
  anthropic_api_key: string;
  anthropic_model: string;
};

export async function fetchAISettings(): Promise<AISettings> {
  const { data } = await api.get<AISettings>('/admin/settings/ai');
  return data;
}

export async function saveAISettings(payload: AISettings): Promise<AISettings> {
  const { data } = await api.put<AISettings>('/admin/settings/ai', payload);
  return data;
}
