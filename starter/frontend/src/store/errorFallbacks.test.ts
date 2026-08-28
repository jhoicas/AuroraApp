import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { api } from '../lib/api';
import { useAIStore } from './aiStore';
import { useAiKnowledgeStore } from './aiKnowledgeStore';
import { useAuroraCopilotStore } from './auroraCopilotStore';
import { useCatalogStore } from './catalogStore';
import { useProjectStore } from './projectStore';
import { useTenantStore } from './tenantStore';

/**
 * Los stores usan `isAxiosError` para leer el mensaje del backend.
 * Cuando el fallo NO viene de Axios (bug de mapeo, JSON corrupto, etc.)
 * debe aplicarse el mensaje de fallback en español sin romper la UI.
 */
const nonAxiosError = new TypeError('Cannot read properties of undefined');

const snapshots = {
  ai: useAIStore.getState(),
  aiKnowledge: useAiKnowledgeStore.getState(),
  aurora: useAuroraCopilotStore.getState(),
  catalog: useCatalogStore.getState(),
  project: useProjectStore.getState(),
  tenant: useTenantStore.getState(),
};

beforeEach(() => {
  useAIStore.setState(snapshots.ai, true);
  useAiKnowledgeStore.setState(snapshots.aiKnowledge, true);
  useAuroraCopilotStore.setState(snapshots.aurora, true);
  useCatalogStore.setState(snapshots.catalog, true);
  useProjectStore.setState(snapshots.project, true);
  useTenantStore.setState(snapshots.tenant, true);
});

describe('fallbacks de error ante fallos que no son de Axios', () => {
  it('auroraCopilotStore.sendMessage', async () => {
    vi.spyOn(api, 'post').mockRejectedValueOnce(nonAxiosError);

    await act(async () => {
      await useAuroraCopilotStore.getState().sendMessage('hola', '/dashboard');
    });

    expect(useAuroraCopilotStore.getState().error).toContain('Aurora no pudo responder');
    expect(useAuroraCopilotStore.getState().isTyping).toBe(false);
  });

  it('catalogStore.fetchSectors', async () => {
    vi.spyOn(api, 'get').mockRejectedValueOnce(nonAxiosError);

    await act(async () => {
      await useCatalogStore.getState().fetchSectors();
    });

    expect(useCatalogStore.getState().error).toBe('No se pudieron cargar los sectores');
  });

  it('projectStore.fetchProjects', async () => {
    vi.spyOn(api, 'get').mockRejectedValueOnce(nonAxiosError);

    await act(async () => {
      await useProjectStore.getState().fetchProjects();
    });

    expect(useProjectStore.getState().error).toBe('No se pudieron cargar los proyectos');
  });

  it('tenantStore.fetchTenants', async () => {
    vi.spyOn(api, 'get').mockRejectedValueOnce(nonAxiosError);

    await act(async () => {
      await useTenantStore.getState().fetchTenants();
    });

    expect(useTenantStore.getState().error).toBe('No se pudieron cargar los tenants');
  });

  it('aiStore.fetchHistory', async () => {
    vi.spyOn(api, 'get').mockRejectedValueOnce(nonAxiosError);

    await act(async () => {
      await useAIStore.getState().fetchHistory('proj-1');
    });

    expect(useAIStore.getState().error).toBe('No se pudo cargar el historial del chat');
  });

  it('aiKnowledgeStore conserva el mensaje de un Error nativo', async () => {
    vi.spyOn(api, 'get').mockRejectedValueOnce(new Error('mapeo roto en el grafo'));

    await act(async () => {
      await useAiKnowledgeStore.getState().fetchGraph();
    });

    expect(useAiKnowledgeStore.getState().error).toBe('mapeo roto en el grafo');
  });

  it('aiKnowledgeStore usa el fallback ante un rechazo sin forma de Error', async () => {
    vi.spyOn(api, 'get').mockRejectedValueOnce('cadena suelta');

    await act(async () => {
      await useAiKnowledgeStore.getState().fetchGraph();
    });

    expect(useAiKnowledgeStore.getState().error).toBe('No se pudo cargar el grafo de conocimiento');
  });
});
