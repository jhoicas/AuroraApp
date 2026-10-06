import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { seedFullAccess, seedViewerAccess } from '../../test/seedAccess';
import { useCatalogStore, type Product } from '../../store/catalogStore';
import CatalogPage from './CatalogPage';

const buildProduct = (): Product => ({
  id: 'prod-1',
  sector: '40',
  nombre_del_sector: 'Vivienda',
  codigo_del_programa: '4001',
  nombre_del_programa: 'Acceso a soluciones de vivienda',
  codigo_del_producto: '4001001',
  producto: 'Viviendas construidas',
  descripcion: 'Viviendas nuevas',
  medido_a_traves_de: 'Número de viviendas',
  codigo_del_indicador_de_producto: 'I400100100',
  indicador_de_producto: 'Viviendas construidas',
  unidad_de_medida: 'Número',
  indicador_principal: true,
  es_nacional: true,
  es_territorial: true,
  objetivos_de_desarrollo_sostenible_ods: '',
  meta_ods: '',
  tipologia_general_suifp: '',
  tipologia_d: false,
  tipologia_e: false,
  tipologia_a: false,
  tipologia_b: false,
  tipologia_c: false,
  tiene_edt: false,
  edt: '',
});

/** Precarga el catálogo y neutraliza los fetch para que no pisen la semilla. */
const seedCatalog = () => {
  useCatalogStore.setState({
    sectors: [{ id: 'sec-1', code: '40', name: 'Vivienda' }],
    programs: [{ id: 'prg-1', sector_id: 'sec-1', code: '4001', name: 'Acceso a soluciones de vivienda' }],
    programsSectorId: 'sec-1',
    catalogProducts: [buildProduct()],
    catalogProductsProgramCode: '4001',
    fetchSectors: vi.fn().mockResolvedValue(undefined),
    fetchProgramsBySector: vi.fn().mockResolvedValue(undefined),
    fetchCatalogProducts: vi.fn().mockResolvedValue(undefined),
    clearPrograms: vi.fn(),
    clearProducts: vi.fn(),
  } as never);
};

/** Recorre el wizard Sector → Programa → Producto. */
const selectProduct = async (user: ReturnType<typeof renderWithProviders>['user']) => {
  const pick = async (index: number, optionName: RegExp) => {
    await user.click(screen.getAllByRole('combobox')[index]);
    const option = await screen.findByRole('option', { name: optionName });
    await user.click(within(option).getByRole('button'));
  };
  await pick(0, /Vivienda/);
  await pick(1, /Acceso a soluciones de vivienda/);
  await pick(2, /Viviendas construidas/);
};

describe('CatalogPage permisos de creación', () => {
  beforeEach(() => {
    seedCatalog();
  });

  it('VIEWER con producto seleccionado no ve "Formular Proyecto con este Producto"', async () => {
    seedViewerAccess();
    const { user } = renderWithProviders(<CatalogPage />, { route: '/tenant/catalog' });
    await selectProduct(user);

    expect(await screen.findByText('Unidad de medida')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Formular Proyecto/ })).toBeNull();
  });

  it('usuario con permisos completos y producto seleccionado ve "Formular Proyecto con este Producto"', async () => {
    seedFullAccess();
    const { user } = renderWithProviders(<CatalogPage />, { route: '/tenant/catalog' });
    await selectProduct(user);

    expect(
      await screen.findByRole('button', { name: /Formular Proyecto con este Producto/ }),
    ).toBeInTheDocument();
  });
});
