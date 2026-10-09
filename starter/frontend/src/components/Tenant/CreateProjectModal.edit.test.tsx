import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import CreateProjectModal from './CreateProjectModal';
import { renderWithProviders } from '../../test/renderWithProviders';
import { apiUrl, server } from '../../test/server';
import type { Project } from '../../store/projectStore';
import { mapApiProductToMga, useCatalogStore } from '../../store/catalogStore';

const SECTOR = { id: 'sector-uuid', code: '22', name: 'Educación', application: 'TERRITORIO' };

const project: Project = {
  id: 'p-1',
  tenant_id: 't-1',
  creator_id: 'u-1',
  name: 'Proyecto',
  description: 'Mejoramiento de la infraestructura educativa',
  sector: 'Educación',
  sector_id: 'sector-uuid',
  product_code: '2201001',
  status: 'draft',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  mga_formulation_data: {
    proceso_id: 5,
    tipo_inversion: 'Territorial',
    tipologia: 'A - PIIP - Bienes y Servicios',
    localizaciones: [{ regionId: 1, departamentoId: 2, municipioId: 3 }],
  },
};

function useCatalogHandlers() {
  server.use(
    http.get(apiUrl('/procesos'), () => HttpResponse.json({ data: [{ id: 5, name: 'Mejoramiento' }] })),
    http.get(apiUrl('/catalog/sectors'), () => HttpResponse.json({ data: [SECTOR] })),
    http.get(apiUrl('/catalog/products'), () =>
      HttpResponse.json({
        data: [
          { id: 'prod-1', sector: '22', nombre_sector: 'Educación', codigo_producto: '2201001', producto: 'Sedes educativas mejoradas' },
        ],
        meta: { page: 1, limit: 5000, total: 1, last_page: 1 },
      }),
    ),
    http.post(apiUrl('/ai/ideation/suggest'), () => HttpResponse.json({ suggestions: {} })),
  );
}

describe('CreateProjectModal en modo edición', () => {
  it('hidrata proceso, tipología y producto, y bloquea tipo de inversión y tipología', async () => {
    useCatalogHandlers();
    renderWithProviders(<CreateProjectModal open onClose={() => {}} editProject={project} />);

    const tipologia = screen.getByLabelText(/Tipología de proyecto/i, { selector: 'select' }) as HTMLSelectElement;
    const tipoInversion = screen.getByLabelText(/Tipo de inversión/i) as HTMLSelectElement;
    expect(tipologia.value).toBe('A - PIIP - Bienes y Servicios');
    expect(tipologia).toBeDisabled();
    expect(tipoInversion.value).toBe('Territorial');
    expect(tipoInversion).toBeDisabled();

    await waitFor(() => expect(screen.getByDisplayValue('Mejoramiento')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByDisplayValue('2201001 - Sedes educativas mejoradas')).toBeInTheDocument(),
    );
  });

  it('no descarta el producto guardado por un catálogo previo de otra búsqueda', async () => {
    useCatalogHandlers();
    // Catálogo cargado antes (otra pantalla) con productos del mismo sector pero sin el producto del proyecto.
    useCatalogStore.setState({
      sectors: [SECTOR] as never,
      catalogProductsProgramCode: null,
      isLoadingProducts: false,
      catalogProducts: [
        mapApiProductToMga({ id: 'x', sector: '22', codigo_producto: '2299999', producto: 'Otro' } as never),
      ],
    });
    renderWithProviders(<CreateProjectModal open onClose={() => {}} editProject={project} />);

    await waitFor(() =>
      expect(screen.getByDisplayValue('2201001 - Sedes educativas mejoradas')).toBeInTheDocument(),
    );
  });

  it('resuelve el nombre del producto por código cuando no está en la lista del sector', async () => {
    server.use(
      http.get(apiUrl('/procesos'), () => HttpResponse.json({ data: [{ id: 5, name: 'Mejoramiento' }] })),
      http.get(apiUrl('/catalog/sectors'), () => HttpResponse.json({ data: [SECTOR] })),
      http.get(apiUrl('/catalog/products'), ({ request }) => {
        const search = new URL(request.url).searchParams.get('search');
        // La búsqueda por sector no trae el producto; la búsqueda por código sí.
        return HttpResponse.json({
          data:
            search === '2201001'
              ? [{ id: 'prod-1', sector: '99', codigo_producto: '2201001', producto: 'Sedes educativas mejoradas' }]
              : [],
          meta: { page: 1, limit: 5000, total: 0, last_page: 1 },
        });
      }),
      http.post(apiUrl('/ai/ideation/suggest'), () => HttpResponse.json({ suggestions: {} })),
    );
    renderWithProviders(<CreateProjectModal open onClose={() => {}} editProject={project} />);

    await waitFor(() =>
      expect(screen.getByDisplayValue('2201001 - Sedes educativas mejoradas')).toBeInTheDocument(),
    );
  });
});
