import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { seedFullAccess, seedViewerAccess } from '../../test/seedAccess';
import { useCatalogStore } from '../../store/catalogStore';
import CatalogPage from './CatalogPage';

describe('CatalogPage permisos de creación', () => {
  beforeEach(() => {
    useCatalogStore.setState({});
  });

  it('VIEWER no ve "Formular Proyecto con este Producto"', () => {
    seedViewerAccess();
    renderWithProviders(<CatalogPage />, { route: '/tenant/catalog' });
    expect(screen.queryByRole('button', { name: /Formular Proyecto/ })).toBeNull();
  });

  it('render con permisos completos no falla', () => {
    seedFullAccess();
    renderWithProviders(<CatalogPage />, { route: '/tenant/catalog' });
    expect(document.body).toBeTruthy();
  });
});
