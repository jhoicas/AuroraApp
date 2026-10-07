import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/ui/Toast';
import DocumentTemplatesPage from './DocumentTemplatesPage';

const api = vi.hoisted(() => ({
  listDocumentTemplates: vi.fn(),
  getDocumentTemplate: vi.fn(),
  deleteDocumentTemplate: vi.fn(),
  createDocumentTemplate: vi.fn(),
  activateDocumentTemplate: vi.fn(),
}));
vi.mock('../../lib/documentTemplatesApi', () => api);

const base = { tenant_id: null, is_active: false, created_at: '', updated_at: '' };
const sys = { ...base, id: 's1', name: 'Sistema', is_system_default: true };
const own = { ...base, id: 'o1', tenant_id: 't', name: 'Mía', is_system_default: false };

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <DocumentTemplatesPage />
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe('DocumentTemplatesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listDocumentTemplates.mockResolvedValue([sys, own]);
    api.getDocumentTemplate.mockResolvedValue({ ...own, html_content: '<p>Hola plantilla</p>' });
    api.deleteDocumentTemplate.mockResolvedValue(undefined);
  });

  it('muestra Eliminar solo en plantillas personalizadas', async () => {
    renderPage();
    await screen.findByText('Mía');
    expect(screen.getByLabelText('Eliminar Mía')).toBeInTheDocument();
    expect(screen.queryByLabelText('Eliminar Sistema')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Vista previa Sistema')).toBeInTheDocument();
  });

  it('abre vista previa con el HTML de la plantilla', async () => {
    renderPage();
    await userEvent.click(await screen.findByLabelText('Vista previa Mía'));
    expect(await screen.findByTestId('template-preview-modal')).toHaveTextContent('Hola plantilla');
  });

  it('confirma y elimina, luego recarga la lista', async () => {
    renderPage();
    await userEvent.click(await screen.findByLabelText('Eliminar Mía'));
    expect(screen.getByText(/Esta acción no se puede deshacer/)).toBeInTheDocument();
    api.listDocumentTemplates.mockResolvedValue([sys]);
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(api.deleteDocumentTemplate).toHaveBeenCalledWith('o1'));
    await waitFor(() => expect(screen.queryByText('Mía')).not.toBeInTheDocument());
  });
});
