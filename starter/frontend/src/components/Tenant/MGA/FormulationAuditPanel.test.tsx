import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FormulationAuditPanel, { getTabForAuditFinding } from './FormulationAuditPanel';
import { useFormulationAuditStore } from '../../../store/formulationAuditStore';
import { useProjectStore } from '../../../store/projectStore';
import type { AuditResult } from '../../../lib/formulationAuditApi';

describe('FormulationAuditPanel & MGA Strict Audit', () => {
  beforeEach(() => {
    useFormulationAuditStore.getState().clearAudit();
    useFormulationAuditStore.getState().clearError();
  });

  describe('getTabForAuditFinding', () => {
    it('resolves cadena-valor correctly from sectionKey', () => {
      const res = getTabForAuditFinding({
        sectionKey: 'cadena-valor',
        message: 'La actividad no tiene costo',
      });
      expect(res.tabId).toBe('cadena-valor');
      expect(res.label).toBe('Cadena de Valor');
    });

    it('resolves identificacion from problem tree messages or sectionKey', () => {
      const res = getTabForAuditFinding({
        sectionKey: 'identificacion-causas',
        message: 'Falta causa directa',
      });
      expect(res.tabId).toBe('identificacion');
      expect(res.label).toBe('Problemática');
    });

    it('resolves poblacion correctly', () => {
      const res = getTabForAuditFinding({
        sectionKey: 'poblacion',
        message: 'No hay población objetivo',
      });
      expect(res.tabId).toBe('poblacion');
      expect(res.label).toBe('Población');
    });

    it('resolves localizacion correctly', () => {
      const res = getTabForAuditFinding({
        sectionKey: 'localizacion',
        message: 'Falta definir la localización geográfica',
      });
      expect(res.tabId).toBe('localizacion');
      expect(res.label).toBe('Localización');
    });
  });

  describe('FormulationAuditPanel rendering and viability blocking', () => {
    it('disables Enviar a Viabilidad button when there are CRITICAL findings and shows blocking alert', () => {
      const mockResult: AuditResult = {
        passed: false,
        findings: [
          {
            id: 'crit-1',
            message: 'El problema central debe contar con al menos una causa en el árbol de problemas.',
            severity: 'CRITICAL',
            sectionKey: 'identificacion',
            isResolved: false,
          },
          {
            id: 'warn-1',
            message: 'La situación existente debe tener mayor detalle narrativo.',
            severity: 'WARNING',
            sectionKey: 'identificacion',
            isResolved: false,
          },
        ],
        blockers: ['El problema central debe contar con al menos una causa en el árbol de problemas.'],
        warnings: ['La situación existente debe tener mayor detalle narrativo.'],
      };

      useFormulationAuditStore.setState({
        auditResult: mockResult,
        lastProjectId: 'proj-123',
        isAuditing: false,
      });

      const onNavigateToTab = vi.fn();

      render(
        <FormulationAuditPanel
          projectId="proj-123"
          onNavigateToTab={onNavigateToTab}
        />
      );

      // Verify severity badges and headers
      expect(screen.getByText(/Bloqueo de Viabilidad Activo/i)).toBeInTheDocument();
      expect(screen.getByText(/Hallazgos Críticos Bloqueantes/i)).toBeInTheDocument();
      expect(screen.getByText(/Advertencias de Coherencia Narrativa/i)).toBeInTheDocument();

      // Verify "Ir a gestionar" button calls navigation with correct tabId
      const navigateButtons = screen.getAllByRole('button', { name: /Ir a gestionar/i });
      expect(navigateButtons.length).toBeGreaterThan(0);
      fireEvent.click(navigateButtons[0]);
      expect(onNavigateToTab).toHaveBeenCalledWith('identificacion');

      // Verify Viability button is disabled
      const viabilityButton = screen.getByRole('button', { name: /Enviar a Viabilidad/i });
      expect(viabilityButton).toBeDisabled();
      expect(viabilityButton).toHaveAttribute(
        'title',
        'Debe corregir todos los hallazgos críticos de formulación (señalados en rojo) antes de enviar a viabilidad.'
      );
    });

    it('enables Enviar a Viabilidad button when there are no CRITICAL findings and triggers patchProject', async () => {
      const mockResult: AuditResult = {
        passed: true,
        findings: [
          {
            id: 'succ-1',
            message: 'Árbol de problemas formulado con causas y efectos.',
            severity: 'SUCCESS',
            sectionKey: 'identificacion',
            isResolved: true,
          },
          {
            id: 'warn-1',
            message: 'Se recomienda complementar la descripción de la magnitud.',
            severity: 'WARNING',
            sectionKey: 'identificacion',
            isResolved: false,
          },
        ],
        blockers: [],
        warnings: ['Se recomienda complementar la descripción de la magnitud.'],
      };

      useFormulationAuditStore.setState({
        auditResult: mockResult,
        lastProjectId: 'proj-456',
        isAuditing: false,
      });

      const patchProjectSpy = vi.spyOn(useProjectStore.getState(), 'patchProject').mockResolvedValue({
        id: 'proj-456',
        name: 'Proyecto Test',
        status: 'EN_VIABILIDAD',
      } as any);

      const onSentToViability = vi.fn();

      render(
        <FormulationAuditPanel
          projectId="proj-456"
          onSentToViability={onSentToViability}
        />
      );

      // Verify passed banner
      expect(screen.getByText(/Requisitos Estructurales MGA Cumplidos/i)).toBeInTheDocument();

      // Viability button should be enabled
      const viabilityButton = screen.getByRole('button', { name: /Enviar a Viabilidad/i });
      expect(viabilityButton).toBeEnabled();

      fireEvent.click(viabilityButton);

      await waitFor(() => {
        expect(patchProjectSpy).toHaveBeenCalledWith('proj-456', { status: 'EN_VIABILIDAD' });
        expect(onSentToViability).toHaveBeenCalled();
        expect(screen.getByText(/¡Proyecto enviado exitosamente a la etapa de Viabilidad!/i)).toBeInTheDocument();
      });

      patchProjectSpy.mockRestore();
    });

    it('allows toggling isResolved for user tracking', () => {
      const mockResult: AuditResult = {
        passed: false,
        findings: [
          {
            id: 'crit-edt',
            message: 'La cadena de valor (EDT) no cuenta con actividades registradas.',
            severity: 'CRITICAL',
            sectionKey: 'cadena-valor',
            isResolved: false,
          },
        ],
        blockers: ['La cadena de valor (EDT) no cuenta con actividades registradas.'],
        warnings: [],
      };

      useFormulationAuditStore.setState({
        auditResult: mockResult,
        lastProjectId: 'proj-789',
        isAuditing: false,
      });

      render(<FormulationAuditPanel projectId="proj-789" />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();

      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
      expect(screen.getByText(/Marcado como resuelto/i)).toBeInTheDocument();
    });
  });
});
