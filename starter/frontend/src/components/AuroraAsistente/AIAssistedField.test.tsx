import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import AIAssistedField from './AIAssistedField';
import { useAuroraCopilotStore } from '../../store/auroraCopilotStore';
import { extractSelectOptions, resolveListSuggestion } from '../../lib/aiSelectOptions';

const suggestSpy = vi.fn();

beforeEach(() => {
  suggestSpy.mockReset();
  useAuroraCopilotStore.setState({ suggestMgaField: suggestSpy, mgaFieldSuggestions: {} });
});

function Harness({ onFill }: { onFill?: (v: string) => void }) {
  const [v, setV] = useState('');
  return (
    <AIAssistedField label="Región" htmlFor="r" fieldHelpKey="test_region" onAutoFill={(x) => { setV(x); onFill?.(x); }}>
      <select id="r" aria-label="sel" value={v} onChange={(e) => setV(e.target.value)}>
        <option value="">Seleccione...</option>
        <option value="1">Andina</option>
        <option value="2">Caribe</option>
        <option value="3" disabled>Pacífico</option>
      </select>
    </AIAssistedField>
  );
}

describe('AIAssistedField', () => {
  it('lee opciones del select y las envía a la IA al hacer clic', () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText('sel'));
    expect(suggestSpy).toHaveBeenCalledTimes(1);
    const args = suggestSpy.mock.calls[0];
    expect(args[3]).toBe(true);
    expect(args[4]).toEqual([
      { label: 'Andina', value: '1' },
      { label: 'Caribe', value: '2' },
    ]);
  });

  it('pide sugerencia al enfocar solo una vez', () => {
    render(<Harness />);
    const sel = screen.getByLabelText('sel');
    fireEvent.focus(sel);
    fireEvent.click(sel);
    expect(suggestSpy).toHaveBeenCalledTimes(1);
  });

  it('aplica solo sugerencias que coinciden con un value', () => {
    const onFill = vi.fn();
    useAuroraCopilotStore.setState({
      mgaFieldSuggestions: { test_region: ['99|||Inventada', '2|||Costa norte'] },
    });
    render(<Harness onFill={onFill} />);
    expect(screen.queryByText(/Inventada/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '[Usar]' }));
    expect(onFill).toHaveBeenCalledWith('2');
    expect((screen.getByLabelText('sel') as HTMLSelectElement).value).toBe('2');
  });

  it('renderiza el popover en document.body', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Ayuda metodológica/ }));
    const tip = screen.getByRole('tooltip');
    expect(tip.parentElement).toBe(document.body);
  });
});

describe('aiSelectOptions', () => {
  it('extractSelectOptions ignora vacías y deshabilitadas y soporta optgroup', () => {
    const opts = extractSelectOptions(
      <select>
        <option value="">-</option>
        <optgroup label="g"><option value="a">A</option></optgroup>
        <option value="b" disabled>B</option>
      </select>,
    );
    expect(opts).toEqual([{ label: 'A', value: 'a' }]);
  });

  it('resolveListSuggestion es estricto', () => {
    const o = [{ label: 'Metro', value: 'M' }];
    expect(resolveListSuggestion('m|||x', o)?.value).toBe('M');
    expect(resolveListSuggestion('Metro', o)?.value).toBe('M');
    expect(resolveListSuggestion('Z|||x', o)).toBeNull();
  });
});
