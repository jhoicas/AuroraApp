import { beforeEach, describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { apiUrl, server } from '../test/server';
import { useProjectStore } from './projectStore';
import { useProjectMgaStore } from './projectMgaStore';

const initialMgaState = useProjectMgaStore.getState();
const initialProjectState = useProjectStore.getState();

beforeEach(() => {
  useProjectMgaStore.setState(initialMgaState, true);
  useProjectStore.setState(initialProjectState, true);
});

describe('projectMgaStore - problematica para Objetivos', () => {
  it('hidrata problema central y causas desde la formulacion MGA', async () => {
    const projectId = 'project-objectives-1';
    useProjectStore.setState({
      currentProject: {
        id: projectId,
        tenant_id: 'tenant-1',
        creator_id: 'user-1',
        name: 'Proyecto de prueba',
        status: 'DRAFT',
        problem_description: 'Acceso insuficiente al agua potable',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    });

    server.use(
      http.get(apiUrl(`/projects/${projectId}/mga/formulation`), () =>
        HttpResponse.json({
          causes: [
            {
              id: 'cause-1',
              project_id: projectId,
              tenant_id: 'tenant-1',
              cause_type: 'directa',
              description: 'Red de distribución insuficiente',
              parent_id: null,
              sort_order: 0,
            },
          ],
          effects: [],
          indicators: [],
          participants: [],
          populations: [],
          alternatives: [],
        }),
      ),
    );

    await act(async () => {
      await useProjectMgaStore.getState().fetchFormulation(projectId);
    });

    const problematica = useProjectMgaStore
      .getState()
      .getFormulation(projectId)
      .identificacion?.problematica;

    expect(problematica?.problemaCentral).toBe('Acceso insuficiente al agua potable');
    expect(problematica?.causas).toEqual([
      {
        id: 'cause-1',
        descripcion: 'Red de distribución insuficiente',
        tipo: 'directa',
      },
    ]);
  });
});