import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import CadenaValorTab from './CadenaValorTab';
import { useCatalogStore } from '../../../store/catalogStore';
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

const buildProducto = () => ({
  id: 'prod-1',
  etapa: 'Inversión',
  productoId: '',
  complemento: 'Vía en concreto rígido construida',
  descripcion: '',
  unidadMedidaId: '',
  cantidad: 0,
  localizacion: { rural: false, ruralDisperso: false, urbano: false },
  poblacion: { usarObjetivo: false, numero: 0, tipoAcumulacion: 'Suma', descripcion: '' },
  actividades: [
    {
      id: 'act-1',
      etapa: 'Inversión',
      nombre: 'Excavación y conformación de subrasante',
      costos: [{ insumo: 'Materiales', periodo: 0, valor: 50000000 }],
    },
  ],
  entregables: [],
});

describe('CadenaValorTab (Layout MGA Oficial)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useCatalogStore.setState({
      catalogProducts: [],
      isLoadingProducts: false,
      fetchCatalogProducts: vi.fn().mockResolvedValue(undefined),
    } as any);

    useProjectMgaStore.setState({
      byProjectId: {
        'proj-cadena-1': {
          causeRelations: [],
          generalIndicators: [],
          effects: [],
          participants: [],
          populations: [],
          alternatives: [],
          completedSections: {},
          identificacion: {
            alternativas: [
              {
                id: 'alt-1',
                nombre: 'Construcción de pavimento en concreto rígido',
                pasaPreparacion: true,
              },
            ],
            objetivos: {
              objetivosEspecificos: {
                'oe-1': 'Construir vías en pavimento rígido',
              },
            },
          },
          preparacion: {
            cadenaValorPrep: {
              'alt-1': { objetivos: { 'oe-1': { productos: [buildProducto()] } } },
            },
          },
        } as any,
      },
    });
  });

  it('renderiza el encabezado, el costo total y el acordeón por objetivo específico', () => {
    render(<CadenaValorTab project={mockProject} />);

    expect(screen.getByRole('heading', { name: 'Cadena de Valor' })).toBeInTheDocument();
    expect(screen.getByText(/Costo total alternativa:/i)).toBeInTheDocument();
    expect(screen.getByText(/OE - Construir vías en pavimento rígido/i)).toBeInTheDocument();
    expect(screen.getByText(/Costo total del objetivo/i)).toBeInTheDocument();
  });

  it('renderiza el selector de alternativa y el botón Adicionar Producto', () => {
    render(<CadenaValorTab project={mockProject} />);

    expect(screen.getByText('Alternativa:')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Construcción de pavimento en concreto rígido/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Adicionar Producto/i })).toBeInTheDocument();
  });

  it('renderiza la tarjeta del producto con sus campos metodológicos', () => {
    render(<CadenaValorTab project={mockProject} />);

    expect(screen.getByText('Vía en concreto rígido construida')).toBeInTheDocument();
    expect(screen.getByText('Etapa')).toBeInTheDocument();
    expect(screen.getByText('Unidad de Medida')).toBeInTheDocument();
    expect(screen.getByText('Cantidad')).toBeInTheDocument();
    expect(screen.getByText('Localización')).toBeInTheDocument();
    expect(screen.getByText(/Cuantificación de Población/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Adicionar Actividad/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Adicionar Entregable/i })).toBeInTheDocument();
  });

  it('renderiza la tarjeta de actividad con costo, etapa y botón Programar costos', () => {
    render(<CadenaValorTab project={mockProject} />);

    expect(screen.getByDisplayValue('Excavación y conformación de subrasante')).toBeInTheDocument();
    expect(screen.getByText(/Costo:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Programar costos/i })).toBeInTheDocument();
  });

  it('agrega un producto nuevo al presionar Adicionar Producto', () => {
    render(<CadenaValorTab project={mockProject} />);

    fireEvent.click(screen.getByRole('button', { name: /Adicionar Producto/i }));

    expect(screen.getByText('Nuevo producto')).toBeInTheDocument();
  });

  it('agrega una actividad al presionar Adicionar Actividad en la tarjeta de producto', () => {
    render(<CadenaValorTab project={mockProject} />);

    fireEvent.click(screen.getByRole('button', { name: /Adicionar Actividad/i }));

    expect(screen.getByText(/Actividades \(2\)/)).toBeInTheDocument();
  });

  it('abre el modal de Programar costos al hacer clic en el botón de la actividad', () => {
    render(<CadenaValorTab project={mockProject} />);

    fireEvent.click(screen.getByRole('button', { name: /Programar costos/i }));

    expect(screen.getByRole('heading', { name: 'Programar costos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar costos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancelar/i })).toBeInTheDocument();
  });

  it('muestra la advertencia si ninguna alternativa pasa a preparación', () => {
    useProjectMgaStore.setState({
      byProjectId: {
        'proj-cadena-1': {
          ...useProjectMgaStore.getState().byProjectId['proj-cadena-1'],
          identificacion: { alternativas: [{ id: 'alt-1', nombre: 'A', pasaPreparacion: false }] },
        } as any,
      },
    });
    render(<CadenaValorTab project={mockProject} />);

    expect(screen.getByText(/No hay alternativas que pasen a preparación/i)).toBeInTheDocument();
  });
});
