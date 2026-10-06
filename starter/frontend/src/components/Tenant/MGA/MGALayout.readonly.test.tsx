import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MGALayout from './MGALayout';
import { ReadOnlyProvider } from '../../../context/ReadOnlyContext';
import type { Project } from '../../../store/projectStore';

const project = {
  id: 'proj-readonly-1',
  tenant_id: 'tenant-1',
  creator_id: 'user-1',
  name: 'Proyecto de Acueducto Rural',
  status: 'DRAFT',
  problem_description: 'Deficiente acceso a agua potable',
  general_objective: 'Mejorar el acceso a agua potable',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as Project;

function renderLayout(readOnly: boolean) {
  return render(
    <ReadOnlyProvider readOnly={readOnly}>
      <MGALayout project={project} activeTab="plan-desarrollo" onChangeSubTab={vi.fn()} />
    </ReadOnlyProvider>,
  );
}

function workAreaControls(): HTMLElement[] {
  const main = document.querySelector('main') as HTMLElement;
  return Array.from(main.querySelectorAll<HTMLElement>('input, select, textarea, button'));
}

describe('MGALayout en modo lectura', () => {
  it('modo edición (referencia): hay botón de guardar, edición de datos y controles habilitados', () => {
    renderLayout(false);
    expect(screen.getByRole('button', { name: /Guardar y Continuar/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Editar/ })).toBeInTheDocument();
    const controls = workAreaControls();
    expect(controls.some((el) => el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')).toBe(true);
    expect(controls.filter((el) => (el as HTMLInputElement).disabled && el.getAttribute('data-readonly-locked'))).toHaveLength(0);
  });

  it('oculta guardar/continuar y editar datos del proyecto', () => {
    renderLayout(true);
    expect(screen.queryByRole('button', { name: /Guardar y Continuar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Guardar$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Editar/ })).toBeNull();
  });

  it('deshabilita todos los campos y botones del área de trabajo', async () => {
    renderLayout(true);
    await waitFor(() => {
      const editable = workAreaControls().filter(
        (el) => !el.hasAttribute('aria-expanded') && el.getAttribute('role') !== 'tab',
      );
      expect(editable.length).toBeGreaterThan(0);
      for (const el of editable) {
        expect(el, `${el.tagName} ${el.id || el.textContent?.slice(0, 30)}`).toBeDisabled();
      }
    });
    // Hay campos de texto reales y todos quedaron deshabilitados.
    const fields = workAreaControls().filter((el) => el.tagName === 'TEXTAREA' || el.tagName === 'INPUT');
    expect(fields.length).toBeGreaterThan(0);
    fields.forEach((f) => expect(f).toBeDisabled());
  });

  it('la navegación entre etapas sigue disponible para poder leer toda la formulación', () => {
    renderLayout(true);
    const nav = screen.getByRole('navigation', { name: 'Etapas principales MGA' });
    const stageButtons = Array.from(nav.querySelectorAll('button'));
    expect(stageButtons.length).toBeGreaterThan(0);
    // Ningún botón de etapa fue bloqueado por el modo lectura.
    stageButtons.forEach((b) => expect(b).not.toHaveAttribute('data-readonly-locked'));
  });
});
