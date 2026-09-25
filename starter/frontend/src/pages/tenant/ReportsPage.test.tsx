import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { apiUrl, server } from '../../test/server';
import { renderWithProviders } from '../../test/renderWithProviders';
import ReportsPage from './ReportsPage';
import type { InvestmentPipelineReportResponse } from '../../lib/api';

const mockReport: InvestmentPipelineReportResponse = {
  kpis: {
    total_budget: 1500000000,
    total_projects: 5,
    average_project_cost: 300000000,
    viable_projects_count: 2,
  },
  status_funnel: [
    { status: 'IDEATION', label: 'Ideación', count: 1, total_budget: 50000000 },
    { status: 'FORMULATION', label: 'Formulación', count: 2, total_budget: 450000000 },
    { status: 'AUDIT', label: 'Auditoría', count: 0, total_budget: 0 },
    { status: 'VIABLE', label: 'Viabilidad', count: 1, total_budget: 600000000 },
    { status: 'APPROVED', label: 'Aprobado', count: 1, total_budget: 400000000 },
  ],
  sector_distribution: [
    {
      sector_code: '13',
      sector_name: 'Agricultura y Desarrollo Rural',
      project_count: 3,
      total_budget: 1050000000,
      percentage: 70.0,
    },
    {
      sector_code: '22',
      sector_name: 'Educación',
      project_count: 2,
      total_budget: 450000000,
      percentage: 30.0,
    },
  ],
};

describe('ReportsPage — Pipeline de Inversión y Distribución Financiera', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza la cabecera ejecutiva y carga los datos del informe', async () => {
    server.use(
      http.get(apiUrl('/tenant/reports/investment-pipeline'), () => {
        return HttpResponse.json(mockReport);
      }),
    );

    renderWithProviders(<ReportsPage />);

    expect(screen.getByText('Pipeline de Inversión Pública')).toBeInTheDocument();
    expect(
      screen.getByText(/Visión Directiva & Planeación Territorial/i),
    ).toBeInTheDocument();

    // Esperar a que se carguen los KPIs
    await waitFor(() => {
      expect(screen.getByText('Presupuesto Estructurado')).toBeInTheDocument();
      expect(screen.getByText('Proyectos en Portafolio')).toBeInTheDocument();
      expect(screen.getByText('Costo Promedio / Proyecto')).toBeInTheDocument();
      expect(screen.getByText('Listos para Viabilidad')).toBeInTheDocument();
    });

    // Validar cantidad de proyectos
    expect(screen.getAllByText('5').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2').length).toBeGreaterThan(0); // Viable projects count
  });

  it('renderiza los pasos del embudo de ciclo de vida (funnel)', async () => {
    server.use(
      http.get(apiUrl('/tenant/reports/investment-pipeline'), () => {
        return HttpResponse.json(mockReport);
      }),
    );

    renderWithProviders(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('Embudo del Ciclo de Vida de Inversión')).toBeInTheDocument();
    });

    expect(screen.getByText('Ideación')).toBeInTheDocument();
    expect(screen.getByText('Formulación')).toBeInTheDocument();
    expect(screen.getByText('Auditoría')).toBeInTheDocument();
    expect(screen.getByText('Viabilidad')).toBeInTheDocument();
    expect(screen.getByText('Aprobado')).toBeInTheDocument();
  });

  it('renderiza la distribución presupuestal por sector DNP y la tabla resumen', async () => {
    server.use(
      http.get(apiUrl('/tenant/reports/investment-pipeline'), () => {
        return HttpResponse.json(mockReport);
      }),
    );

    renderWithProviders(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('Distribución de Inversión por Sector DNP')).toBeInTheDocument();
    });

    // Sectores
    expect(screen.getAllByText('Agricultura y Desarrollo Rural').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Educación').length).toBeGreaterThan(0);
    expect(screen.getAllByText('70.0%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('30.0%').length).toBeGreaterThan(0);

    // Tabla de resumen
    expect(screen.getByText('Resumen Consolidado de Inversión Territorial')).toBeInTheDocument();
    expect(screen.getByText('Totales Consolidados')).toBeInTheDocument();
  });

  it('permite imprimir el reporte invocando window.print', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    server.use(
      http.get(apiUrl('/tenant/reports/investment-pipeline'), () => {
        return HttpResponse.json(mockReport);
      }),
    );

    renderWithProviders(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('Imprimir Informe')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Imprimir Informe'));
    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it('muestra mensaje de error si el endpoint falla', async () => {
    server.use(
      http.get(apiUrl('/tenant/reports/investment-pipeline'), () => {
        return HttpResponse.json({ error: 'Database timeout' }, { status: 500 });
      }),
    );

    renderWithProviders(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('No fue posible cargar el informe gerencial')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Reintentar/i })).toBeInTheDocument();
    });
  });
});
