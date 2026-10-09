import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import IngresosBeneficiosTab from './IngresosBeneficiosTab';
import { useCatalogStore } from '../../../store/catalogStore';
import { useProjectMgaStore } from '../../../store/projectMgaStore';
import type { Project } from '../../../store/projectStore';
import { server, apiUrl } from '../../../test/server';

const mockProject = {
  id: 'proj-ingresos-1',
  tenant_id: 'tenant-1',
  creator_id: 'user-1',
  name: 'Proyecto',
  status: 'DRAFT',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as Project;

describe('IngresosBeneficiosTab — bien producido y RPC reactivo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.get(apiUrl('/catalog/produced-goods'), () =>
        HttpResponse.json([
          { id: 1, description: 'Agua potable', rpc: 2.65 },
          { id: 2, description: 'Arroz', rpc: 0.9 },
        ]),
      ),
    );
    useCatalogStore.setState({
      measurementUnits: [{ id: 849, name: 'Kilogramos' }],
      fetchAllMeasurementUnits: vi.fn().mockResolvedValue([]),
    } as any);
    useProjectMgaStore.setState({
      byProjectId: {
        [mockProject.id]: {
          causeRelations: [],
          generalIndicators: [],
          effects: [],
          participants: [],
          populations: [],
          alternatives: [],
          completedSections: {},
          identificacion: { alternativas: [{ id: 'alt-1', nombre: 'Alt', pasaPreparacion: true }] },
          preparacion: { ingresosBeneficios: {} },
        } as any,
      },
    });
  });

  it('actualiza el RPC de solo lectura al elegir un bien producido', async () => {
    render(<IngresosBeneficiosTab project={mockProject} />);
    fireEvent.click(screen.getByText(/Adicionar Ingreso \/ Beneficio/));

    const rpc = (await screen.findByLabelText('Razón Precio Cuenta (RPC)')) as HTMLInputElement;
    expect(rpc.readOnly).toBe(true);

    await screen.findByRole('option', { name: 'Arroz' });
    fireEvent.change(screen.getByLabelText(/Bien producido/), { target: { value: '1' } });
    await waitFor(() => expect(rpc.value).toBe('2.65'));

    fireEvent.change(screen.getByLabelText(/Bien producido/), { target: { value: '2' } });
    await waitFor(() => expect(rpc.value).toBe('0.9'));
  });

  it('lista las unidades del catálogo en "Medido a través de"', async () => {
    render(<IngresosBeneficiosTab project={mockProject} />);
    fireEvent.click(screen.getByText(/Adicionar Ingreso \/ Beneficio/));
    expect(await screen.findByRole('option', { name: 'Kilogramos' })).toBeTruthy();
  });
});
