import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProjectDetailPage from './ProjectDetailPage';
import AdminProjectDetailPage from '../admin/AdminProjectDetailPage';
import { useProjectStore, type Project } from '../../store/projectStore';
import { useReadOnly } from '../../context/ReadOnlyContext';
import ReadOnlyScope from '../../components/ui/ReadOnlyScope';

const auth = vi.hoisted(() => ({ role: 'FORMULADOR' }));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'a@b.co', full_name: 'Ana', role: auth.role, tenant_id: auth.role === 'SUPER_ADMIN' ? null : 't1' },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  }),
}));

// La formulación real se prueba en MGALayout.readonly.test; aquí solo se comprueba lo que recibe.
vi.mock('../../components/Tenant/ProjectFormulation', () => ({
  default: () => {
    const { readOnly, backPath } = useReadOnly();
    return (
      <ReadOnlyScope>
        <div data-testid="formulation" data-readonly={String(readOnly)} data-back={backPath}>
          <input aria-label="campo" />
          <button type="button">Guardar Cambios</button>
        </div>
      </ReadOnlyScope>
    );
  },
}));
vi.mock('../../components/Tenant/BudgetManager', () => ({
  default: () => <button type="button">Agregar ítem</button>,
}));
vi.mock('../../components/Tenant/ProjectSummary', () => ({ default: () => <div>Resumen</div> }));
vi.mock('../../components/Tenant/MGA/FormulationAuditPanel', () => ({ default: () => <div>Auditoría</div> }));
vi.mock('../../components/Tenant/MGA/MgaPdfExportButton', () => ({ default: () => <button type="button">Ficha PDF</button> }));
vi.mock('../../components/Tenant/MGA/TechnicalDocumentValleExportButton', () => ({
  default: () => <button type="button">Documento técnico</button>,
}));

const project = {
  id: 'p1', tenant_id: 't1', creator_id: 'u9', name: 'Acueducto rural', sector: 'Agua', status: 'DRAFT',
  code_bpin: '2026-001', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
} as Project;

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/projects" element={<div>LISTA ADMIN</div>} />
        <Route path="/admin/projects/:id" element={<AdminProjectDetailPage />} />
        <Route path="/tenant/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/tenant/projects/:id/formulation" element={<ProjectDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProjectDetailPage en modo lectura', () => {
  beforeEach(() => {
    auth.role = 'FORMULADOR';
    useProjectStore.setState({
      currentProject: project,
      isLoading: false,
      error: null,
      fetchProjectById: vi.fn().mockResolvedValue(undefined),
      fetchBudget: vi.fn().mockResolvedValue(undefined),
      clearCurrentProject: vi.fn(),
    });
  });

  it('Super Admin: banner de vista previa, volver a Proyectos Admin y sin "Validar y Enviar"', () => {
    auth.role = 'SUPER_ADMIN';
    renderAt('/admin/projects/p1');

    expect(screen.getByTestId('readonly-banner')).toHaveTextContent('Vista Previa / Modo Lectura (Super Admin)');
    const back = screen.getByRole('link', { name: /Volver a Proyectos Admin/ });
    expect(back).toHaveAttribute('href', '/admin/projects');
    expect(screen.queryByRole('button', { name: /Validar y Enviar|Auditoría/ })).toBeNull();
    // La exportación (lectura) sigue disponible.
    expect(screen.getByRole('button', { name: 'Ficha PDF' })).toBeInTheDocument();
  });

  it('Super Admin: la formulación recibe readOnly y sus campos y botones quedan deshabilitados', () => {
    auth.role = 'SUPER_ADMIN';
    renderAt('/admin/projects/p1');

    const formulation = screen.getByTestId('formulation');
    expect(formulation).toHaveAttribute('data-readonly', 'true');
    expect(formulation).toHaveAttribute('data-back', '/admin/projects');
    expect(screen.getByLabelText('campo')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Guardar Cambios' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Agregar ítem' })).toBeDisabled(); // presupuesto
  });

  it('?mode=readonly activa el modo lectura también en la ruta de la entidad', () => {
    renderAt('/tenant/projects/p1?mode=readonly');
    expect(screen.getByTestId('readonly-banner')).toHaveTextContent('Vista Previa / Modo Lectura');
    expect(screen.getByTestId('readonly-banner')).not.toHaveTextContent('Super Admin');
    expect(screen.getByRole('link', { name: 'Volver a proyectos' })).toHaveAttribute('href', '/tenant/projects');
    expect(screen.getByLabelText('campo')).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Validar y Enviar/ })).toBeNull();
  });

  it('el formulador en su ruta normal conserva la edición completa', () => {
    renderAt('/tenant/projects/p1');
    expect(screen.queryByTestId('readonly-banner')).toBeNull();
    expect(screen.getByTestId('formulation')).toHaveAttribute('data-readonly', 'false');
    expect(screen.getByLabelText('campo')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Guardar Cambios' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Validar y Enviar/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar ítem' })).toBeEnabled();
  });
});
