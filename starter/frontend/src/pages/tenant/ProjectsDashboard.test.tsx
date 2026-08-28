import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { apiUrl, errorResponse, server } from '../../test/server';
import { renderWithProviders, seedAuthUser } from '../../test/renderWithProviders';
import { formatTIR, formatVPN, tooltipFormatter } from '../../lib/financialFormat';
import { useProjectStore } from '../../store/projectStore';
import type { EvaluationSummaryItem, Project } from '../../store/projectStore';
import ProjectsDashboard from './ProjectsDashboard';

/**
 * ResponsiveContainer mide el DOM y en jsdom siempre reporta 0x0, lo que
 * impide que recharts pinte el gráfico. Le damos un tamaño fijo.
 */
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => (
      <actual.ResponsiveContainer width={800} height={300}>
        {children}
      </actual.ResponsiveContainer>
    ),
  };
});

const project = (overrides: Partial<Project> = {}): Project =>
  ({
    id: 'proj-1',
    name: 'Acueducto rural La Esperanza',
    sector: 'Agua potable',
    code_bpin: '2024-001',
    status: 'IN_FORMULATION',
    created_at: '2026-03-11T10:00:00Z',
    ...overrides,
  }) as Project;

const evaluation = (overrides: Partial<EvaluationSummaryItem> = {}): EvaluationSummaryItem => ({
  project_id: 'proj-1',
  alternative_name: 'Alternativa A',
  vpn: 1250000000,
  tir: 0.1842,
  created_at: '2026-03-12T10:00:00Z',
  ...overrides,
});

/** Normaliza espacios duros de Intl.NumberFormat para comparar texto. */
const normalize = (value: string): string => value.replace(/\u00a0/g, ' ');

function serveDashboard(projects: Project[], evaluations: EvaluationSummaryItem[]): void {
  server.use(
    http.get(apiUrl('/projects'), () =>
      HttpResponse.json({
        data: projects,
        page: 1,
        page_size: 100,
        total: projects.length,
        total_pages: 1,
      }),
    ),
    http.get(apiUrl('/projects/evaluations/summary'), () => HttpResponse.json({ data: evaluations })),
  );
}

describe('formateo financiero', () => {
  it.each([
    { vpn: 0, expected: '$ 0' },
    { vpn: 1250000000, expected: '$ 1.250.000.000' },
    { vpn: -480500000, expected: '-$ 480.500.000' },
    { vpn: 1234.6, expected: '$ 1.235' },
  ])('formatVPN($vpn) → $expected', ({ vpn, expected }) => {
    expect(normalize(formatVPN(vpn))).toBe(expected);
  });

  it.each([
    { tir: 0.1842, expected: '18,42 %' },
    { tir: 0, expected: '0,00 %' },
    { tir: -0.055, expected: '-5,50 %' },
    { tir: null, expected: 'No calculable' },
    { tir: undefined, expected: 'No calculable' },
    { tir: Number.NaN, expected: 'No calculable' },
  ])('formatTIR($tir) → $expected', ({ tir, expected }) => {
    expect(normalize(formatTIR(tir))).toBe(expected);
  });

  it('el tooltip distingue la serie de TIR de la de VPN', () => {
    expect(tooltipFormatter(18.42, 'TIR (%)').map(normalize)).toEqual(['18,42 %', 'TIR']);
    expect(tooltipFormatter(1250000000, 'VPN').map(normalize)).toEqual(['$ 1.250.000.000', 'VPN']);
    expect(tooltipFormatter('1250000000', 'VPN').map(normalize)).toEqual(['$ 1.250.000.000', 'VPN']);
    expect(tooltipFormatter(null, 'VPN').map(normalize)).toEqual(['$ 0', 'VPN']);
  });
});

describe('ProjectsDashboard', () => {
  beforeEach(() => {
    useProjectStore.setState({
      projects: [],
      currentProject: null,
      budget: [],
      evaluationSummary: [],
      isLoading: false,
      isSaving: false,
      error: null,
    });
    seedAuthUser();
  });

  it('saluda al usuario autenticado y resume los estados de los proyectos', async () => {
    serveDashboard(
      [
        project(),
        project({ id: 'proj-2', name: 'Vía terciaria', status: 'SUBMITTED' }),
        project({ id: 'proj-3', name: 'Colegio nuevo', status: 'APPROVED' }),
      ],
      [],
    );

    renderWithProviders(<ProjectsDashboard />, { withAuth: true });

    expect(await screen.findByText('Bienvenido, Ana')).toBeInTheDocument();
    expect(await screen.findByText('Acueducto rural La Esperanza')).toBeInTheDocument();

    const stats = (label: string): string =>
      screen.getByText(label).parentElement?.querySelector('p:last-child')?.textContent ?? '';

    expect(stats('Activos')).toBe('2 proyectos');
    expect(stats('En revisión')).toBe('1 proyectos');
    expect(stats('Viabilizados')).toBe('1 proyectos');
  });

  describe('Indicadores financieros (VPN / TIR)', () => {
    it('renderiza el VPN como moneda COP y la TIR como porcentaje', async () => {
      serveDashboard([project()], [evaluation()]);

      renderWithProviders(<ProjectsDashboard />, { withAuth: true });

      const table = await screen.findByRole('table', {
        name: 'Resumen de VPN y TIR por alternativa evaluada',
      });
      const row = within(table).getByRole('row', { name: /Alternativa A/ });
      const cells = within(row).getAllByRole('cell');

      expect(cells[0]).toHaveTextContent('Acueducto rural La Esperanza');
      expect(cells[1]).toHaveTextContent('Alternativa A');
      expect(normalize(cells[2].textContent ?? '')).toBe('$ 1.250.000.000');
      expect(normalize(cells[3].textContent ?? '')).toBe('18,42 %');
    });

    it('muestra el VPN negativo con formato de moneda y en rojo', async () => {
      serveDashboard(
        [project()],
        [evaluation({ vpn: -480500000, tir: 0.0325, alternative_name: 'Alternativa B' })],
      );

      renderWithProviders(<ProjectsDashboard />, { withAuth: true });

      const row = await screen.findByRole('row', { name: /Alternativa B/ });
      const cells = within(row).getAllByRole('cell');

      expect(normalize(cells[2].textContent ?? '')).toBe('-$ 480.500.000');
      expect(cells[2].className).toContain('text-red-700');
      expect(normalize(cells[3].textContent ?? '')).toBe('3,25 %');
    });

    it('indica "No calculable" cuando el motor Go no encontró TIR', async () => {
      serveDashboard([project()], [evaluation({ tir: null })]);

      renderWithProviders(<ProjectsDashboard />, { withAuth: true });

      expect(await screen.findByText('No calculable')).toBeInTheDocument();
    });

    it('usa un rótulo neutro cuando la evaluación no tiene proyecto asociado', async () => {
      serveDashboard([project()], [evaluation({ project_id: 'proj-desconocido' })]);

      renderWithProviders(<ProjectsDashboard />, { withAuth: true });

      expect(await screen.findByText('Proyecto sin nombre')).toBeInTheDocument();
    });

    it('monta el gráfico de recharts con las barras de VPN y TIR', async () => {
      serveDashboard([project()], [evaluation()]);

      const { container } = renderWithProviders(<ProjectsDashboard />, { withAuth: true });

      expect(
        await screen.findByText('Indicadores financieros (motor Go)'),
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(container.querySelector('.recharts-surface')).toBeInTheDocument();
      });
      expect(container.querySelectorAll('.recharts-bar').length).toBe(2);

      const legendLabels = Array.from(
        container.querySelectorAll('.recharts-legend-item-text'),
        (node) => node.textContent,
      );
      expect(legendLabels).toHaveLength(2);
      expect(legendLabels).toEqual(expect.arrayContaining(['VPN', 'TIR (%)']));
    });

    it('oculta la sección financiera cuando no hay evaluaciones', async () => {
      serveDashboard([project()], []);

      renderWithProviders(<ProjectsDashboard />, { withAuth: true });

      expect(await screen.findByText('Acueducto rural La Esperanza')).toBeInTheDocument();
      expect(screen.queryByText('Indicadores financieros (motor Go)')).not.toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  it('omite el nombre en el saludo cuando el usuario no está autenticado', async () => {
    localStorage.clear();
    serveDashboard([], []);

    renderWithProviders(<ProjectsDashboard />, { withAuth: true });

    expect(await screen.findByText('Bienvenido')).toBeInTheDocument();
    expect(screen.queryByText(/Bienvenido,/)).not.toBeInTheDocument();
  });

  it('muestra esqueletos de carga mientras llega el primer listado', async () => {
    useProjectStore.setState({ isLoading: true });
    serveDashboard([], []);

    const { container } = renderWithProviders(<ProjectsDashboard />, { withAuth: true });

    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3);
    await waitFor(() => expect(useProjectStore.getState().isLoading).toBe(false));
  });

  it('abre y cierra el modal desde el botón principal', async () => {
    serveDashboard([project()], []);

    const { user } = renderWithProviders(<ProjectsDashboard />, { withAuth: true });

    await user.click(await screen.findByRole('button', { name: /Crear nuevo proyecto/ }));
    const modal = await screen.findByRole('dialog');

    await user.click(within(modal).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('tolera nombres largos, fechas inválidas y estados fuera del catálogo', async () => {
    const longName = 'Mejoramiento integral de vías terciarias del municipio';
    serveDashboard(
      [
        project({
          name: longName,
          status: 'ESTADO_DESCONOCIDO',
          code_bpin: '',
          created_at: 'fecha-invalida',
        }),
      ],
      [evaluation({ tir: undefined })],
    );

    renderWithProviders(<ProjectsDashboard />, { withAuth: true });

    expect(await screen.findByText(longName)).toBeInTheDocument();
    expect(screen.getByText('Sin BPIN · Agua potable')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('Invalid Date')).toBeInTheDocument();
    expect(screen.getByText('No calculable')).toBeInTheDocument();
  });

  it('muestra el estado vacío e invita a crear el primer proyecto', async () => {
    serveDashboard([], []);

    const { user } = renderWithProviders(<ProjectsDashboard />, { withAuth: true });

    expect(
      await screen.findByText('Aún no hay proyectos. Crea el primero para iniciar.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Crear proyecto/ }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('muestra el error del backend y permite descartarlo', async () => {
    server.use(
      http.get(apiUrl('/projects'), () => errorResponse(500, 'No se pudo cargar el listado')),
      http.get(apiUrl('/projects/evaluations/summary'), () => HttpResponse.json({ data: [] })),
    );

    const { user } = renderWithProviders(<ProjectsDashboard />, { withAuth: true });

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('No se pudo cargar el listado')).toBeInTheDocument();

    await user.click(within(alert).getByRole('button', { name: 'Cerrar' }));

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('navega al asistente desde el bloque de ayuda', async () => {
    serveDashboard([], []);

    const { user, currentLocation } = renderWithProviders(<ProjectsDashboard />, {
      withAuth: true,
    });

    await user.click(screen.getByRole('button', { name: /Consultar asistente/ }));

    await waitFor(() => expect(currentLocation()).toBe('/tenant/ai'));
  });
});
