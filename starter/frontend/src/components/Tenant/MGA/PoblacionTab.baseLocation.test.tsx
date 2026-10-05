import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { apiUrl, server } from '../../../test/server';
import PoblacionTab from './PoblacionTab';
import { useLocationStore } from '../../../store/locationStore';
import { useProjectStore, type Project } from '../../../store/projectStore';
import { useProjectMgaStore } from '../../../store/projectMgaStore';

const PROJECT_ID = 'proj-pob-1';

const baseProject = (extra: Record<string, unknown> = {}): Project =>
  ({
    id: PROJECT_ID,
    tenant_id: 'tenant-1',
    creator_id: 'user-1',
    name: 'Proyecto con base',
    status: 'DRAFT',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    base_region_id: 3,
    base_departamento_id: 76,
    ...extra,
  }) as Project;

beforeEach(() => {
  useProjectStore.setState({ currentProject: null });
  useProjectMgaStore.setState({ byProjectId: {} });
  useLocationStore.setState({ regions: [] });

  server.use(
    http.get(apiUrl('/mga/catalogs/regions'), () =>
      HttpResponse.json([
        { id: 1, name: 'Región Caribe' },
        { id: 3, name: 'Región Pacífico' },
      ]),
    ),
    http.get(apiUrl('/mga/catalogs/departments'), ({ request }) => {
      const regionId = new URL(request.url).searchParams.get('regionId');
      return HttpResponse.json(
        regionId === '3' ? [{ id: 76, name: 'Valle del Cauca', region_id: 3 }] : [{ id: 8, name: 'Atlántico', region_id: 1 }],
      );
    }),
    http.get(apiUrl('/mga/catalogs/municipalities'), ({ request }) => {
      const departmentId = new URL(request.url).searchParams.get('departmentId');
      return HttpResponse.json(
        departmentId === '76'
          ? [
              { id: 76001, name: 'Cali', departamento_id: 76 },
              { id: 76109, name: 'Buenaventura', departamento_id: 76 },
            ]
          : [{ id: 8001, name: 'Barranquilla', departamento_id: 8 }],
      );
    }),
    http.get(apiUrl('/mga/catalogs/groupings'), () => HttpResponse.json([])),
    http.patch(apiUrl(`/projects/${PROJECT_ID}`), () => HttpResponse.json({})),
  );
});

describe('PoblacionTab - departamento base bloqueado', () => {
  it('Región y Departamento vienen preseleccionados y deshabilitados; Municipio solo del base', async () => {
    render(<PoblacionTab project={baseProject()} />);

    fireEvent.click(screen.getAllByRole('button', { name: /Adicionar Ubicación/i })[0]);

    const region = (await screen.findByLabelText(/^Región/)) as HTMLSelectElement;
    const departamento = screen.getByLabelText(/^Departamento/) as HTMLSelectElement;
    const municipio = screen.getByLabelText(/^Municipio/) as HTMLSelectElement;

    expect(region).toBeDisabled();
    expect(region.value).toBe('3');
    expect(departamento).toBeDisabled();
    expect(departamento.value).toBe('76');

    await waitFor(() => expect(within(municipio).getByRole('option', { name: 'Cali' })).toBeInTheDocument());
    const options = within(municipio).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Seleccione Municipio...', 'Cali', 'Buenaventura']);

    // Los nombres se resuelven desde el catálogo.
    await waitFor(() => {
      expect(within(region).getByRole('option', { name: 'Región Pacífico' })).toBeInTheDocument();
      expect(within(departamento).getByRole('option', { name: 'Valle del Cauca' })).toBeInTheDocument();
    });
  });

  it('exige municipio y guarda la ubicación con los ids de región y departamento base', async () => {
    render(<PoblacionTab project={baseProject()} />);

    fireEvent.click(screen.getAllByRole('button', { name: /Adicionar Ubicación/i })[0]);
    const municipio = (await screen.findByLabelText(/^Municipio/)) as HTMLSelectElement;
    await waitFor(() => expect(within(municipio).getByRole('option', { name: 'Cali' })).toBeInTheDocument());

    // Sin municipio → error y no se agrega.
    fireEvent.click(screen.getByRole('button', { name: /^Adicionar$/ }));
    expect(await screen.findByText(/Seleccione un Municipio del departamento base/i)).toBeInTheDocument();

    fireEvent.change(municipio, { target: { value: '76109' } });
    fireEvent.click(screen.getByRole('button', { name: /^Adicionar$/ }));

    await waitFor(() => {
      const afectada = useProjectMgaStore.getState().getFormulation(PROJECT_ID).identificacion?.poblacion?.afectada;
      expect(afectada?.localizaciones).toHaveLength(1);
      expect(afectada?.localizaciones[0]).toMatchObject({
        regionId: 3,
        departamentoId: 76,
        municipioId: 76109,
        departamento: 'Valle del Cauca',
        municipio: 'Buenaventura',
      });
    });
    // El formulario se cierra y la tabla muestra la ubicación.
    expect(await screen.findByText('Buenaventura')).toBeInTheDocument();
  });

  it('sin departamento base el formulario conserva los desplegables en cascada', async () => {
    render(<PoblacionTab project={baseProject({ base_region_id: null, base_departamento_id: null })} />);

    fireEvent.click(screen.getAllByRole('button', { name: /Adicionar Ubicación/i })[0]);

    expect(await screen.findByText('Seleccione Región...')).toBeInTheDocument();
    expect(screen.queryByTitle('Fijado por el departamento base del proyecto.')).not.toBeInTheDocument();
  });
});
