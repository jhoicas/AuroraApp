import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActionCard from './ActionCard';
import type { ActionCardPayload } from '../../store/auroraCopilotStore';

const card: ActionCardPayload = {
  catalog: 'ods',
  code: '6.1',
  label: 'Agua limpia y saneamiento',
  description: 'Meta ODS aplicable a proyectos de acueducto rural.',
};

describe('ActionCard', () => {
  it('muestra catálogo, etiqueta, código y descripción', () => {
    render(<ActionCard card={card} onApply={vi.fn()} />);

    expect(screen.getByText('ODS')).toBeInTheDocument();
    expect(screen.getByText('Agua limpia y saneamiento')).toBeInTheDocument();
    expect(screen.getByText('Código: 6.1')).toBeInTheDocument();
    expect(
      screen.getByText('Meta ODS aplicable a proyectos de acueducto rural.'),
    ).toBeInTheDocument();
  });

  it('omite la descripción cuando no viene en el payload', () => {
    const { description: _omitted, ...withoutDescription } = card;
    render(<ActionCard card={withoutDescription} onApply={vi.fn()} />);

    expect(
      screen.queryByText('Meta ODS aplicable a proyectos de acueducto rural.'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Código: 6.1')).toBeInTheDocument();
  });

  it('al hacer clic en "Aplicar" entrega la tarjeta completa al handler', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();

    render(<ActionCard card={card} onApply={onApply} />);
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(card);
  });

  it.each([
    { catalog: 'products' as const, expected: 'Producto DNP' },
    { catalog: 'sectors' as const, expected: 'Sector' },
    { catalog: 'programs' as const, expected: 'Programa' },
    { catalog: 'edt' as const, expected: 'EDT' },
    { catalog: 'deliverables' as const, expected: 'Entregable' },
    { catalog: 'activities' as const, expected: 'Actividad' },
  ])('traduce el catálogo $catalog a "$expected"', ({ catalog, expected }) => {
    render(<ActionCard card={{ ...card, catalog }} onApply={vi.fn()} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
