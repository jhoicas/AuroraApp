import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from './ErrorBoundary';

function BrokenView({ shouldThrow }: { shouldThrow: () => boolean }) {
  if (shouldThrow()) {
    throw new Error('Fallo controlado de la vista');
  }
  return <p>Vista recuperada</p>;
}

describe('ErrorBoundary', () => {
  it('renderiza sus hijos cuando no ocurre ningún error', () => {
    render(
      <ErrorBoundary>
        <p>Contenido estable</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText('Contenido estable')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('aísla el fallo y muestra el título de fallback configurado', () => {
    render(
      <ErrorBoundary fallbackTitle="Error en el módulo de proyectos">
        <BrokenView shouldThrow={() => true} />
      </ErrorBoundary>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Error en el módulo de proyectos');
    expect(alert).toHaveTextContent('Fallo controlado de la vista');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('usa el título predeterminado si no se proporciona fallbackTitle', () => {
    render(
      <ErrorBoundary>
        <BrokenView shouldThrow={() => true} />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Algo salió mal');
  });

  it('permite reintentar cuando la causa del error ya desapareció', async () => {
    const user = userEvent.setup();
    let shouldThrow = true;

    render(
      <ErrorBoundary>
        <BrokenView shouldThrow={() => shouldThrow} />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    shouldThrow = false;

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Vista recuperada')).toBeInTheDocument();
  });
});
