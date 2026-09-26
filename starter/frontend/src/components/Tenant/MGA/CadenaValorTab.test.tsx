import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import CadenaValorTab from './CadenaValorTab';
import { useProjectEdtStore } from '../../../store/projectEdtStore';
import { useProjectMgaStore } from '../../../store/projectMgaStore';
import type { Project } from '../../../store/projectStore';

const mockProject: Project = {
  id: 'proj-cadena-1',
  tenant_id: 'tenant-1',
  creator_id: 'user-1',
  name: 'Pavimentación Vías Urbanas',
  status: 'DRAFT',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  problem_description: 'Mal estado de la malla vial urbana',
  general_objective: 'Mejorar la transitabilidad vehicular',
  mga_formulation_data: {
    alternatives: [
      {
        id: 'alt-1',
        description: 'Construcción de pavimento en concreto rígido',
      },
    ],
  },
};

describe('CadenaValorTab (Layout MGA Oficial)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useProjectMgaStore.setState({
      byProjectId: {
        'proj-cadena-1': {
          causeRelations: [
            {
              id: 'cause-1',
              causeType: 'Causa directa',
              causeDescription: 'Deterioro de la carpeta asfáltica',
              specificObjective: 'Construir vías en pavimento rígido',
            },
          ],
          generalIndicators: [],
          effects: [],
          participants: [],
          populations: [],
          alternatives: [
            {
              id: 'alt-1',
              tenant_id: 'tenant-1',
              project_id: 'proj-cadena-1',
              description: 'Construcción de pavimento en concreto rígido',
              evaluate_profitability: false,
              evaluate_cost: true,
              proceeds_to_preparation: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          completedSections: {},
        },
      },
    });

    useProjectEdtStore.setState({
      byProjectId: {
        'proj-cadena-1': {
          catalogLink: {
            id: 'link-1',
            tenant_id: 'tenant-1',
            project_id: 'proj-cadena-1',
            product_id: 'prod-cat-1',
            product_code: '4001001',
            tipologia: 'Tipología A',
            requires_edt: true,
            sector_code: '40',
            program_code: '4001',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          edtNodes: [
            {
              id: 'node-1',
              tenant_id: 'tenant-1',
              project_id: 'proj-cadena-1',
              code: '1.1',
              level: 1,
              name: 'Vía en concreto rígido construida',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          deliverables: [
            {
              id: 'del-1',
              tenant_id: 'tenant-1',
              project_id: 'proj-cadena-1',
              project_edt_node_id: 'node-1',
              code: '1.1.1',
              name: 'Entregable vía',
              amount: 50000000,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          activities: [
            {
              id: 'act-1',
              tenant_id: 'tenant-1',
              project_id: 'proj-cadena-1',
              project_deliverable_id: 'del-1',
              code: '1.1.1.1',
              name: 'Excavación y conformación de subrasante',
              quantity: 100,
              unit_cost: 500000,
              total_cost: 50000000,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        },
      },
      fetchEdtChain: vi.fn().mockImplementation(async (pid: string) => {
        return useProjectEdtStore.getState().getChain(pid);
      }),
    });
  });

  it('renderiza la cabecera del acordeón por objetivo con el nombre y el costo', () => {
    render(<CadenaValorTab project={mockProject} />);

    expect(screen.getByText('Cadena de valor')).toBeInTheDocument();
    expect(screen.getByText(/✓ 1\. Objetivo específico 1: Construir vías en pavimento rígido/i)).toBeInTheDocument();
    expect(screen.getByText(/Costo: \$/i)).toBeInTheDocument();
  });

  it('renderiza el bloque superior con la descripción de la alternativa y el botón + Adicionar producto', () => {
    render(<CadenaValorTab project={mockProject} />);

    expect(screen.getByText(/^Alternativa:$/i)).toBeInTheDocument();
    expect(screen.getByText(/Construcción de pavimento en concreto rígido/i)).toBeInTheDocument();

    const addProductBtn = screen.getByRole('button', { name: /\+ Adicionar producto/i });
    expect(addProductBtn).toBeInTheDocument();
  });

  it('renderiza la tarjeta del producto con todos los campos metodológicos oficiales', () => {
    render(<CadenaValorTab project={mockProject} />);

    expect(screen.getByText(/1\.1 Producto 1: Vía en concreto rígido construida/i)).toBeInTheDocument();
    expect(screen.getByText(/Indicador principal :/i)).toBeInTheDocument();
    expect(screen.getByText(/Unidad de Medida :/i)).toBeInTheDocument();
    expect(screen.getByText(/Cantidad :/i)).toBeInTheDocument();
    expect(screen.getByText(/Costo \$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Etapa :/i).length).toBeGreaterThanOrEqual(1);

    expect(screen.getByRole('button', { name: /\+ Adicionar actividad/i })).toBeInTheDocument();
  });

  it('renderiza la tarjeta de actividad con los campos de costo, etapa y botón + Programar costos', () => {
    render(<CadenaValorTab project={mockProject} />);

    expect(screen.getByText(/1\.1\.1\.1 Actividad 1: Excavación y conformación de subrasante/i)).toBeInTheDocument();
    expect(screen.getByText(/Costo : \$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Programar costos/i })).toBeInTheDocument();
  });

  it('renderiza el pie de página con el costo total de la alternativa y botón de guardar', async () => {
    const saveSpy = vi.fn().mockResolvedValue(undefined);
    useProjectMgaStore.setState({
      saveCadenaDeValor: saveSpy as any,
    });

    render(<CadenaValorTab project={mockProject} />);

    expect(screen.getByText(/Costo total de la alternativa:/i)).toBeInTheDocument();
    const saveBtn = screen.getByRole('button', { name: /Guardar Cadena de Valor/i });
    expect(saveBtn).toBeInTheDocument();

    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });
    expect(saveSpy).toHaveBeenCalledWith('proj-cadena-1', expect.anything());
    expect(await screen.findByText(/Cadena de Valor guardada exitosamente/i)).toBeInTheDocument();
  });

  it('abre el modal de Adicionar producto al presionar el botón correspondiente', () => {
    render(<CadenaValorTab project={mockProject} />);

    const addProductBtn = screen.getByRole('button', { name: /\+ Adicionar producto/i });
    fireEvent.click(addProductBtn);

    expect(screen.getByText('Adicionar Producto')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ej. Vía pavimentada construida')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar Producto/i })).toBeInTheDocument();
  });

  it('abre el modal de Adicionar actividad al presionar el botón en la tarjeta de producto', () => {
    render(<CadenaValorTab project={mockProject} />);

    const addActBtn = screen.getByRole('button', { name: /\+ Adicionar actividad/i });
    fireEvent.click(addActBtn);

    expect(screen.getByText('Adicionar Actividad')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ej. Excavación y movimiento de tierras')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar Actividad/i })).toBeInTheDocument();
  });

  it('abre el modal de Programación de Costos al hacer clic en + Programar costos', () => {
    render(<CadenaValorTab project={mockProject} />);

    const programarBtn = screen.getByRole('button', { name: /\+ Programar costos/i });
    fireEvent.click(programarBtn);

    expect(screen.getByText('Programación de Costos de Actividad')).toBeInTheDocument();
    expect(screen.getByText(/Distribución temporal MGA:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Entendido/i })).toBeInTheDocument();
  });
});
