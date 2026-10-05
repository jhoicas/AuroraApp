import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { apiUrl, server } from '../../../test/server';
import LocalizacionTab from './LocalizacionTab';
import { useLocationStore } from '../../../store/locationStore';
import { useCatalogStore } from '../../../store/catalogStore';
import { useProjectStore, type Project } from '../../../store/projectStore';
import { useProjectMgaStore } from '../../../store/projectMgaStore';

const DEPARTMENTS = [
  { id: 76, code: '76', name: 'Valle del Cauca' },
  { id: 11, code: '11', name: 'Bogotá D.C.' },
];
const MUNICIPALITIES = {
  76: [
    { id: 76001, code: '76001', name: 'Cali', department_id: 76 },
    { id: 76109, code: '76109', name: 'Buenaventura', department_id: 76 },
  ],
  11: [{ id: 11001, code: '11001', name: 'Bogotá', department_id: 11 }],
};

const baseProject = (extra: Record<string, unknown> = {}): Project =>
  ({
    id: 'proj-base-1',
    tenant_id: 'tenant-1',
    creator_id: 'user-1',
    name: 'Proyecto con base',
    status: 'DRAFT',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    base_region_id: 3,
    base_departamento_id: 76,
    mga_formulation_data: { tipologia: 'General - Esquemas SUIFP' },
    ...extra,
  }) as Project;

beforeEach(() => {
  useProjectStore.setState({ currentProject: null });
  useProjectMgaStore.setState({ byProjectId: {} });
  useLocationStore.setState({
    regions: [
      {
        id: 3,
        name: 'Región Pacífico',
        departamentos: [{ id: 76, name: 'Valle del Cauca', region_id: 3, municipios: [] }],
      },
    ],
  });
  useCatalogStore.setState({ departments: DEPARTMENTS, municipalitiesByDept: MUNICIPALITIES } as never);
  server.use(http.get(apiUrl('/catalog/departments'), () => HttpResponse.json(DEPARTMENTS)));
});

const selectByLabel = (re: RegExp) => screen.getAllByLabelText(re)[0] as HTMLSelectElement;

describe('LocalizacionTab - departamento base bloqueado', () => {
  it('Región y Departamento aparecen preseleccionados y deshabilitados', () => {
    render(<LocalizacionTab project={baseProject()} />);

    const region = selectByLabel(/^Región/);
    const departamento = selectByLabel(/^Departamento/);

    expect(region).toBeDisabled();
    expect(region.value).toBe('3');
    expect(within(region).getByRole('option', { name: 'Región Pacífico' })).toBeInTheDocument();

    expect(departamento).toBeDisabled();
    expect(departamento.value).toBe('76');
    expect(within(departamento).getByRole('option', { name: /Valle del Cauca/ })).toBeInTheDocument();
  });

  it('el desplegable de Municipio solo ofrece municipios del departamento base', () => {
    render(<LocalizacionTab project={baseProject()} />);

    const municipio = selectByLabel(/^Municipio/);
    const options = within(municipio).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Seleccione Municipio...', '76001 - Cali', '76109 - Buenaventura']);
    expect(within(municipio).queryByRole('option', { name: /Bogotá/ })).not.toBeInTheDocument();
  });

  it('una nueva localización nace con Región y Departamento base bloqueados', async () => {
    render(<LocalizacionTab project={baseProject()} />);

    fireEvent.click(screen.getByRole('button', { name: /Agregar otra localización/i }));

    await waitFor(() => expect(screen.getByText('Localización #2')).toBeInTheDocument());
    const departamentos = screen.getAllByLabelText(/^Departamento/) as HTMLSelectElement[];
    const regiones = screen.getAllByLabelText(/^Región/) as HTMLSelectElement[];
    expect(departamentos).toHaveLength(2);
    for (const el of [...departamentos, ...regiones]) {
      expect(el).toBeDisabled();
    }
    expect(departamentos[1].value).toBe('76');
    expect(regiones[1].value).toBe('3');
  });

  it('usa el departamento base del proyecto aunque la fila guardada apuntara a otro (datos previos)', () => {
    const project = baseProject({
      mga_formulation_data: {
        tipologia: 'General - Esquemas SUIFP',
        localizaciones: [{ region_id: 1, departamento_id: 11, municipio_id: 11001 }],
      },
    });
    render(<LocalizacionTab project={project} />);

    expect(selectByLabel(/^Departamento/).value).toBe('76');
    expect(selectByLabel(/^Municipio/).value).toBe('');
    expect(screen.getByText(/fuera del departamento base del proyecto/i)).toBeInTheDocument();
  });

  it('guarda con la región y el departamento base y el municipio elegido', async () => {
    const saveSpy = vi.fn().mockResolvedValue(undefined);
    useProjectMgaStore.setState({ saveLocalizacion: saveSpy as never });

    render(<LocalizacionTab project={baseProject()} />);
    fireEvent.change(selectByLabel(/^Municipio/), { target: { value: '76109' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar y Continuar/i }));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    expect(saveSpy).toHaveBeenCalledWith(
      'proj-base-1',
      expect.objectContaining({
        localizaciones: [expect.objectContaining({ region_id: 3, departamento_id: 76, municipio_id: 76109 })],
      }),
    );
  });

  it('no guarda si falta el municipio', async () => {
    const saveSpy = vi.fn().mockResolvedValue(undefined);
    useProjectMgaStore.setState({ saveLocalizacion: saveSpy as never });

    render(<LocalizacionTab project={baseProject()} />);
    fireEvent.click(screen.getByRole('button', { name: /Guardar y Continuar/i }));

    expect(await screen.findByText(/Debe seleccionar Departamento y Municipio/i)).toBeInTheDocument();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('no copia la localización de la población objetivo si está en otro departamento', () => {
    useProjectMgaStore.setState({
      byProjectId: {
        'proj-base-1': {
          causeRelations: [],
          generalIndicators: [],
          effects: [],
          participants: [],
          alternatives: [],
          completedSections: {},
          populations: [
            {
              id: 'pop-1',
              tenant_id: 't',
              project_id: 'proj-base-1',
              population_type: 'objetivo',
              total_number: 10,
              source: 'DANE',
              locations: JSON.stringify({ departments: ['Bogotá D.C.'] }),
              created_at: '',
              updated_at: '',
            },
          ],
        },
      } as never,
    });

    render(<LocalizacionTab project={baseProject()} />);
    fireEvent.click(screen.getByRole('button', { name: /Utilizar localización de la población objetivo/i }));

    expect(screen.getByText(/departamento distinto al departamento base/i)).toBeInTheDocument();
    expect(selectByLabel(/^Departamento/).value).toBe('76');
  });
});
