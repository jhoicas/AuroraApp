import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { apiUrl, server } from '../../../test/server';
import NecesidadesTab from './NecesidadesTab';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore } from '../../../store/projectMgaStore';
import type { MgaNeed } from '../../../lib/mgaApi';

const project = {
  id: 'proj-needs-1',
  tenant_id: 'tenant-1',
  creator_id: 'user-1',
  name: 'Proyecto',
  status: 'DRAFT',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
} as Project;

const baseNeed: MgaNeed = {
  id: '11111111-1111-1111-1111-111111111111',
  tenant_id: 'tenant-1',
  project_id: project.id,
  alternative_id: 'alt-1',
  bien_servicio: 'Agua potable',
  descripcion: 'Suministro',
  descripcion_oferta: '',
  descripcion_demanda: '',
  unidad_medida_id: 1,
  anio_inicial: 2020,
  anio_final: 2021,
  ultimo_anio_proyectado: 2022,
  valores_anuales: [
    { anio: 2020, oferta: 150, demanda: 15000, deficit: 14850 },
    { anio: 2021, oferta: 0, demanda: 0, deficit: 0 },
    { anio: 2022, oferta: 0, demanda: 0, deficit: 0 },
  ],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const initialState = useProjectMgaStore.getState();

beforeEach(() => {
  useProjectMgaStore.setState(initialState, true);
  useProjectMgaStore.setState({
    byProjectId: {
      [project.id]: {
        causeRelations: [],
        generalIndicators: [],
        effects: [],
        participants: [],
        populations: [],
        alternatives: [],
        completedSections: {},
        identificacion: {
          alternativas: [{ id: 'alt-1', nombre: 'Alternativa 1', pasaPreparacion: true, estado: '' }],
        },
      },
    },
  });
  server.use(
    http.get(apiUrl('/catalog/measurement-units'), () => HttpResponse.json([{ id: 1, name: 'Metros cúbicos' }])),
    http.get(apiUrl(`/projects/${project.id}/mga/needs`), () => HttpResponse.json([baseNeed])),
  );
});

describe('NecesidadesTab - grilla anual', () => {
  it('renderiza una fila por año con oferta, demanda y déficit', async () => {
    render(<NecesidadesTab project={project} />);

    const grid = await screen.findByRole('table', { name: /serie anual de agua potable/i });
    expect(within(grid).getAllByRole('row')).toHaveLength(4); // header + 3 años
    expect((screen.getByLabelText('Oferta 2020') as HTMLInputElement).value).toBe('150');
    expect(screen.getByLabelText('Déficit 2020').textContent).toBe((14850).toLocaleString('es-CO'));
    expect(screen.getByText('(proyectado)')).toBeInTheDocument();
  });

  it('arranca en modo lectura: inputs deshabilitados, lápiz visible y sin diskette', async () => {
    render(<NecesidadesTab project={project} />);
    await screen.findByLabelText('Oferta 2021');

    for (const anio of [2020, 2021, 2022]) {
      expect(screen.getByLabelText(`Oferta ${anio}`)).toBeDisabled();
      expect(screen.getByLabelText(`Demanda ${anio}`)).toBeDisabled();
      expect(screen.getByRole('button', { name: `Editar año ${anio}` })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: `Guardar año ${anio}` })).not.toBeInTheDocument();
    }
  });

  it('el lápiz habilita solo esa fila y muestra el diskette; cancelar vuelve a lectura sin cambios', async () => {
    render(<NecesidadesTab project={project} />);
    await screen.findByLabelText('Oferta 2021');

    fireEvent.click(screen.getByRole('button', { name: 'Editar año 2021' }));
    expect(screen.getByLabelText('Oferta 2021')).toBeEnabled();
    expect(screen.getByLabelText('Demanda 2021')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Guardar año 2021' })).toBeInTheDocument();
    expect(screen.getByLabelText('Oferta 2020')).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Oferta 2021'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar edición año 2021' }));

    expect(screen.getByLabelText('Oferta 2021')).toBeDisabled();
    expect((screen.getByLabelText('Oferta 2021') as HTMLInputElement).value).toBe('0');
    expect(screen.getByRole('button', { name: 'Editar año 2021' })).toBeInTheDocument();
  });

  it('recalcula el déficit al digitar y habilita el guardado solo con cambios', async () => {
    render(<NecesidadesTab project={project} />);
    await screen.findByLabelText('Oferta 2021');

    fireEvent.click(screen.getByRole('button', { name: 'Editar año 2021' }));
    const save = screen.getByRole('button', { name: 'Guardar año 2021' });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Demanda 2021'), { target: { value: '500' } });
    expect(screen.getByLabelText('Déficit 2021').textContent).toBe('500');

    fireEvent.change(screen.getByLabelText('Oferta 2021'), { target: { value: '800' } });
    expect(screen.getByLabelText('Déficit 2021').textContent).toBe((-300).toLocaleString('es-CO'));
    expect(save).toBeEnabled();
    // las otras filas no cambian
    expect(screen.getByLabelText('Déficit 2020').textContent).toBe((14850).toLocaleString('es-CO'));
  });

  it('guarda la fila con PUT annual-values y actualiza el estado sin recargar', async () => {
    let body: unknown = null;
    server.use(
      http.put(
        apiUrl(`/projects/${project.id}/mga/needs/${baseNeed.id}/annual-values/2021`),
        async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({
            ...baseNeed,
            valores_anuales: baseNeed.valores_anuales.map((v) =>
              v.anio === 2021 ? { anio: 2021, oferta: 800, demanda: 500, deficit: -300 } : v,
            ),
          });
        },
      ),
    );

    render(<NecesidadesTab project={project} />);
    await screen.findByLabelText('Oferta 2021');

    fireEvent.click(screen.getByRole('button', { name: 'Editar año 2021' }));
    fireEvent.change(screen.getByLabelText('Oferta 2021'), { target: { value: '800' } });
    fireEvent.change(screen.getByLabelText('Demanda 2021'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar año 2021' }));

    await waitFor(() => expect(body).toEqual({ oferta: 800, demanda: 500 }));

    // Tras guardar con éxito la fila vuelve a modo lectura.
    expect(await screen.findByRole('button', { name: 'Editar año 2021' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar año 2021' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Oferta 2021')).toBeDisabled();

    const stored = useProjectMgaStore.getState().needsByProjectId[project.id][0];
    expect(stored.valores_anuales[1]).toEqual({ anio: 2021, oferta: 800, demanda: 500, deficit: -300 });
    expect((screen.getByLabelText('Oferta 2021') as HTMLInputElement).value).toBe('800');
    expect(screen.getByLabelText('Déficit 2021').textContent).toBe((-300).toLocaleString('es-CO'));
  });

  it('muestra el error de la fila si el backend rechaza el guardado y conserva lo digitado', async () => {
    server.use(
      http.put(
        apiUrl(`/projects/${project.id}/mga/needs/${baseNeed.id}/annual-values/2022`),
        () => HttpResponse.json({ error: 'year not in need series' }, { status: 404 }),
      ),
    );

    render(<NecesidadesTab project={project} />);
    await screen.findByLabelText('Oferta 2022');

    fireEvent.click(screen.getByRole('button', { name: 'Editar año 2022' }));
    fireEvent.change(screen.getByLabelText('Oferta 2022'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar año 2022' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('year not in need series');
    // Sigue en modo edición con lo digitado.
    expect(screen.getByLabelText('Oferta 2022')).toBeEnabled();
    expect((screen.getByLabelText('Oferta 2022') as HTMLInputElement).value).toBe('5');
  });
});
