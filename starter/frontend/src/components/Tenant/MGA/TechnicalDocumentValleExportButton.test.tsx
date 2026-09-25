import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TechnicalDocumentValleExportButton from './TechnicalDocumentValleExportButton';
import * as mgaApi from '../../../lib/mgaApi';

describe('TechnicalDocumentValleExportButton', () => {
  it('renderiza con el texto exigido por el Decreto 1278', () => {
    render(
      <TechnicalDocumentValleExportButton
        projectId="proj-123"
        projectName="Vías Terciarias Palmira"
      />,
    );

    const button = screen.getByRole('button', {
      name: /Descargar Documento Técnico \(Dec\. 1278\)/i,
    });
    expect(button).toBeInTheDocument();
  });

  it('llama a downloadTechnicalDocumentValle al hacer clic', async () => {
    const downloadSpy = vi
      .spyOn(mgaApi, 'downloadTechnicalDocumentValle')
      .mockResolvedValueOnce(undefined);

    render(
      <TechnicalDocumentValleExportButton
        projectId="proj-123"
        projectName="Vías Terciarias Palmira"
      />,
    );

    const button = screen.getByRole('button', {
      name: /Descargar Documento Técnico \(Dec\. 1278\)/i,
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(downloadSpy).toHaveBeenCalledWith('proj-123', 'Vías Terciarias Palmira');
    });
  });
});
