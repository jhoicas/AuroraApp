import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import AdminProjectsPage from './AdminProjectsPage';
import { apiUrl, server } from '../../test/server';

describe('AdminProjectsPage — Ver Formulación', () => {
  it('cada fila tiene un enlace "Ver Formulación" al detalle en modo lectura', async () => {
    server.use(
      http.get(apiUrl('/admin/tenants'), () =>
        HttpResponse.json({ data: [], page: 1, page_size: 100, total: 0, total_pages: 1 }),
      ),
      http.get(apiUrl('/admin/projects'), () =>
        HttpResponse.json({
          data: [
            {
              id: 'proj-1', name: 'Acueducto rural', code_bpin: '2026-001', status: 'DRAFT', fase_maduracion: 'PERFIL',
              tenant_id: 't1', tenant_name: 'Alcaldía A', creator_id: 'u1', creator_email: 'f@a.co', creator_name: 'Fran',
              created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
            },
            {
              id: 'proj-2', name: 'Vía terciaria', code_bpin: null, status: 'DRAFT', fase_maduracion: 'PERFIL',
              tenant_id: 't2', tenant_name: 'Alcaldía B', creator_id: 'u2', creator_email: 'g@b.co', creator_name: 'Gus',
              created_at: '2026-02-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z',
            },
          ],
          page: 1, page_size: 20, total: 2, total_pages: 1,
        }),
      ),
    );

    render(
      <MemoryRouter>
        <AdminProjectsPage />
      </MemoryRouter>,
    );

    const row = (await screen.findByText('Acueducto rural')).closest('tr') as HTMLElement;
    const link = within(row).getByRole('link', { name: /Ver Formulación de Acueducto rural/ });
    expect(link).toHaveAttribute('href', '/admin/projects/proj-1');
    expect(within(row).getByText('Ver Formulación')).toBeInTheDocument();

    const row2 = screen.getByText('Vía terciaria').closest('tr') as HTMLElement;
    expect(within(row2).getByRole('link', { name: /Ver Formulación/ })).toHaveAttribute('href', '/admin/projects/proj-2');
    expect(screen.getByRole('columnheader', { name: 'Acciones' })).toBeInTheDocument();
  });
});
