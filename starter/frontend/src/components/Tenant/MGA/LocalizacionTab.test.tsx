import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { apiUrl, server } from '../../../test/server';
import LocalizacionTab from './LocalizacionTab';
import { useLocationStore } from '../../../store/locationStore';
import type { Project } from '../../../store/projectStore';

const mockProjectStandard: Project = {
  id: 'proj-standard-1',
  tenant_id: 'tenant-1',
  creator_id: 'user-1',
  name: 'Proyecto de Pavimentación',
  status: 'DRAFT',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  mga_formulation_data: {
    tipologia: 'General - Esquemas SUIFP',
    localizaciones: [
      {
        region_id: 1,
        departamento_id: 76,
        municipio_id: 76001,
      },
    ],
  },
};

const mockProjectEthnic: Project = {
  id: 'proj-ethnic-1',
  tenant_id: 'tenant-1',
  creator_id: 'user-1',
  name: 'Proyecto Fortalecimiento Comunitario Indígena',
  status: 'DRAFT',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  mga_formulation_data: {
    tipologia: "E - Esquemas SUIFP's - Pueblos y comunidades étnicas",
    localizaciones: [
      {
        region_id: 1,
        departamento_id: 76,
        municipio_id: 76001,
        tipo_agrupacion_id: 1,
        agrupacion_id: 10,
      },
    ],
  },
};

describe('LocalizacionTab (Multi-localización y Lógica Étnica)', () => {
  beforeEach(() => {
    server.use(
      http.get(apiUrl('/locations/agrupaciones'), () => {
        return HttpResponse.json({
          data: [
            {
              id: 10,
              name: 'Resguardo Indígena Triunfo Cristal',
              municipio_id: 76001,
              tipo_agrupacion_id: 1,
            },
            {
              id: 20,
              name: 'Consejo Comunitario Afro de Cali',
              municipio_id: 76001,
              tipo_agrupacion_id: 2,
            },
          ],
        });
      }),
      http.get(apiUrl('/locations/tipos-agrupacion'), () => {
        return HttpResponse.json({
          data: [
            { id: 1, name: 'Resguardo' },
            { id: 2, name: 'Consejo Comunitario' },
          ],
        });
      }),
    );
    useLocationStore.setState({
      regions: [
        {
          id: 1,
          name: 'Región Pacífico',
          departamentos: [
            {
              id: 76,
              name: 'Valle del Cauca',
              region_id: 1,
              municipios: [
                { id: 76001, name: 'Cali', departamento_id: 76 },
                { id: 76111, name: 'Buga', departamento_id: 76 },
              ],
            },
          ],
        },
      ],
      tiposAgrupacion: [
        { id: 1, name: 'Resguardo' },
        { id: 2, name: 'Consejo Comunitario' },
      ],
      agrupaciones: [
        {
          id: 10,
          name: 'Resguardo Indígena Triunfo Cristal',
          municipio_id: 76001,
          tipo_agrupacion_id: 1,
        },
        {
          id: 20,
          name: 'Consejo Comunitario Afro de Cali',
          municipio_id: 76001,
          tipo_agrupacion_id: 2,
        },
      ],
      isLoadingLocations: false,
    });
  });

  it('renderiza la sincronización inicial con datos base del proyecto estándar sin campos étnicos', () => {
    render(<LocalizacionTab project={mockProjectStandard} />);

    expect(screen.getByText('Localización MGA')).toBeInTheDocument();
    expect(screen.getByText('Tipología Estándar Territorial')).toBeInTheDocument();

    // No debe mostrar campos étnicos
    expect(screen.queryByText('Tipo de Agrupación')).not.toBeInTheDocument();
    expect(screen.queryByText('Agrupación Étnica')).not.toBeInTheDocument();
  });

  it('habilita y muestra los selects de Tipo de Agrupación y Agrupación cuando la tipología es étnica', () => {
    render(<LocalizacionTab project={mockProjectEthnic} />);

    expect(screen.getByText(/Tipología Étnica: Requiere Agrupación Étnica/i)).toBeInTheDocument();
    expect(screen.getByText(/Caracterización Étnica Territorial/i)).toBeInTheDocument();
    expect(screen.getByText('Tipo de Agrupación')).toBeInTheDocument();
    expect(screen.getByText('Agrupación Étnica')).toBeInTheDocument();
  });

  it('permite agregar múltiples localizaciones mediante el botón "+ Agregar otra localización"', async () => {
    render(<LocalizacionTab project={mockProjectStandard} />);

    expect(screen.getByText('Localización (Principal / Base)')).toBeInTheDocument();
    expect(screen.queryByText('Localización #2')).not.toBeInTheDocument();

    const addBtn = screen.getByRole('button', { name: /Agregar otra localización/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText('Localización #2')).toBeInTheDocument();
    });
  });

  it('filtra las opciones de Agrupación según el municipio y tipo de agrupación seleccionados', () => {
    render(<LocalizacionTab project={mockProjectEthnic} />);

    // Con municipio 76001 y tipo 1 ("Resguardo"), la opción "Resguardo Indígena Triunfo Cristal" debe estar disponible
    const resguardoOption = screen.getByRole('option', { name: 'Resguardo Indígena Triunfo Cristal' });
    expect(resguardoOption).toBeInTheDocument();

    // La opción del Consejo Comunitario (tipo 2) NO debe aparecer para el tipo 1 seleccionado
    expect(screen.queryByRole('option', { name: 'Consejo Comunitario Afro de Cali' })).not.toBeInTheDocument();
  });
});
