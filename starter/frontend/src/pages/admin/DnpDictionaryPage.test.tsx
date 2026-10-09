import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import DnpDictionaryPage from './DnpDictionaryPage';
import { apiUrl, server } from '../../test/server';

const meta = { total: 2, page: 1, limit: 15, last_page: 1 };

describe('DnpDictionaryPage', () => {
  it('lista verbos con su tipo y cambia a unidades de medida', async () => {
    server.use(
      http.get(apiUrl('/admin/catalogs/dnp-verbs'), () =>
        HttpResponse.json({
          data: [
            { id: 1, verb: 'Diagnosticar', kind: 'STRONG', notes: '' },
            { id: 2, verb: 'Fortalecer', kind: 'WEAK', notes: 'Guía DNP' },
          ],
          meta,
        }),
      ),
      http.get(apiUrl('/admin/catalogs/dnp-units'), () =>
        HttpResponse.json({
          data: [{ id: 1, name: 'Número', symbol: 'No.', typology: 'CONTEO', active: true }],
          meta: { ...meta, total: 1 },
        }),
      ),
    );

    render(<DnpDictionaryPage />);

    expect(await screen.findByText('Diagnosticar')).toBeInTheDocument();
    expect(screen.getByText('Fortalecer')).toBeInTheDocument();
    expect(screen.getByText('Fuerte')).toBeInTheDocument();
    expect(screen.getByText('Débil')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Unidades de medida' }));
    expect(await screen.findByText('Número')).toBeInTheDocument();
    expect(screen.getByText('Conteo', { selector: 'td' })).toBeInTheDocument();
  });

  it('crea un verbo y muestra el conflicto de duplicado', async () => {
    let posted: unknown = null;
    server.use(
      http.get(apiUrl('/admin/catalogs/dnp-verbs'), () => HttpResponse.json({ data: [], meta: { ...meta, total: 0 } })),
      http.post(apiUrl('/admin/catalogs/dnp-verbs'), async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({ error: 'dnp verb already exists' }, { status: 409 });
      }),
    );

    render(<DnpDictionaryPage />);
    await screen.findByText('No se encontraron registros.');

    await userEvent.click(screen.getByRole('button', { name: /Nuevo Verbo/ }));
    await userEvent.type(screen.getByLabelText(/Verbo en infinitivo/), 'Georreferenciar');
    await userEvent.selectOptions(screen.getByLabelText(/Tipo \*/), 'WEAK');
    await userEvent.click(screen.getByRole('button', { name: /Guardar/ }));

    await waitFor(() => expect(posted).toEqual({ verb: 'Georreferenciar', kind: 'WEAK', notes: '' }));
    expect(await screen.findByText('Ya existe un registro con ese nombre.')).toBeInTheDocument();
  });
});
