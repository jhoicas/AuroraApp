import { render, screen, fireEvent, within } from '@testing-library/react';
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
      catalogEdt: [
        {
          id: 'edt-1',
          codigo_producto_estandarizado: '',
          nombre_producto: 'Vía',
          codigo_entregable_l1: 'E1',
          nombre_entregable_l1: 'Estudios y diseños',
          codigo_entregable_l2: 'E1.1',
          nombre_entregable_l2: 'Diseño geométrico',
          codigo_entregable_l3: '',
          nombre_entregable_l3: '',
          codigo_actividad: 'A1',
          actividad: 'Diseñar',
          unidad_de_medida: 'Unidad',
        },
      ],
      isLoadingEdt: false,
      fetchCatalogEdt: vi.fn().mockResolvedValue(undefined),
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

  it('renderiza el selector de alternativa y el botón Adicionar producto en el objetivo', () => {
    render(<CadenaValorTab project={mockProject} />);

    expect(screen.getByText('Alternativa:')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Construcción de pavimento en concreto rígido/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Adicionar producto/i })).toBeInTheDocument();
  });

  it('renderiza la tarjeta del producto con sus campos metodológicos', () => {
    render(<CadenaValorTab project={mockProject} />);

    expect(screen.getByText('Vía en concreto rígido construida')).toBeInTheDocument();
    expect(screen.getByLabelText('Etapa')).toBeInTheDocument();
    expect(screen.getByLabelText('Medido a través de')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Cantidad')).toBeInTheDocument();
    expect(screen.getByText('Localización')).toBeInTheDocument();
    expect(screen.getByText(/Cuantificación de Población/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Utilizar la cantidad de población objetivo/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Acumulativo')).toBeInTheDocument();
    expect(screen.getByLabelText('No acumulativo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Adicionar entregable/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Adicionar actividad/i })).toBeInTheDocument();
  });

  it('ofrece las etapas Preinversión, Inversión y Operación', () => {
    render(<CadenaValorTab project={mockProject} />);

    const etapa = screen.getByLabelText('Etapa') as HTMLSelectElement;
    expect(Array.from(etapa.options).map(o => o.value)).toEqual(['Preinversión', 'Inversión', 'Operación']);
  });

  it('renderiza la tarjeta de actividad con costo, etapa y botón Programar costos', () => {
    render(<CadenaValorTab project={mockProject} />);

    expect(screen.getByDisplayValue('Excavación y conformación de subrasante')).toBeInTheDocument();
    expect(screen.getByText(/Costo:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Programar costos/i })).toBeInTheDocument();
  });

  it('abre el formulario de producto y solo lo agrega al guardarlo', () => {
    render(<CadenaValorTab project={mockProject} />);

    fireEvent.click(screen.getByRole('button', { name: /Adicionar producto/i }));
    expect(screen.getByText('Nuevo producto')).toBeInTheDocument();

    // Sin producto seleccionado no se guarda.
    fireEvent.click(screen.getByRole('button', { name: /Guardar producto/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Seleccione el nombre del producto/i);

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByText('Nuevo producto')).not.toBeInTheDocument();
  });

  it('agrega una actividad al presionar Adicionar actividad y avisa el mínimo de 2', () => {
    render(<CadenaValorTab project={mockProject} />);

    expect(screen.getByText(/Mínimo 2 actividades requeridas \(1\/2\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Adicionar actividad/i }));

    expect(screen.getByText(/Actividades \(2\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Mínimo 2 actividades requeridas/)).not.toBeInTheDocument();
  });

  it('agrega un entregable eligiéndolo del catálogo EDT y hereda la etapa del producto', () => {
    render(<CadenaValorTab project={mockProject} />);

    expect(screen.getByText(/Mínimo 2 entregables requeridos \(0\/2\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Adicionar entregable/i }));

    const modal = screen.getByRole('heading', { name: 'Adicionar entregable' }).closest('div')!.parentElement!;
    expect(within(modal).getByLabelText('Etapa')).toHaveValue('Inversión');
    fireEvent.change(within(modal).getByLabelText('Nombre del entregable'), { target: { value: 'E1.1' } });
    fireEvent.click(within(modal).getByRole('button', { name: /Guardar entregable/i }));

    expect(screen.getByText(/Entregables \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/E1\.1 - Diseño geométrico/)).toBeInTheDocument();
    expect(screen.getByText(/Mínimo 2 entregables requeridos \(1\/2\)/)).toBeInTheDocument();
  });

  it('abre la matriz de costos con insumos y periodos, y suma en cascada hasta la alternativa', () => {
    render(<CadenaValorTab project={mockProject} />);

    fireEvent.click(screen.getByRole('button', { name: /Programar costos/i }));

    expect(screen.getByRole('heading', { name: 'Programar costos' })).toBeInTheDocument();
    expect(screen.getByText('Mano de obra calificada')).toBeInTheDocument();
    expect(screen.getByText('Servicios domiciliarios')).toBeInTheDocument();
    expect(screen.getByText('Periodo 0')).toBeInTheDocument();
    expect(screen.getByText('Periodo 11')).toBeInTheDocument();
    expect(screen.getByText(/Costo total de la actividad:/i)).toHaveTextContent('50.000.000');

    fireEvent.change(screen.getByLabelText('Terrenos periodo 1'), { target: { value: '10000000' } });
    expect(screen.getByText(/Costo total de la actividad:/i)).toHaveTextContent('60.000.000');

    fireEvent.click(screen.getByRole('button', { name: /Guardar costos/i }));

    expect(screen.getByText(/Costo total alternativa:/i)).toHaveTextContent('60.000.000');
    expect(screen.getByText(/Costo total del objetivo/i).parentElement).toHaveTextContent('60.000.000');
    expect(screen.getByTitle('Costo total del producto')).toHaveTextContent('60.000.000');
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
