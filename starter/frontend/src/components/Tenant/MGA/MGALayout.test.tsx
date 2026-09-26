import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MGALayout from './MGALayout';
import { hasMgaSectionData, useProjectMgaStore } from '../../../store/projectMgaStore';
import { useProjectEdtStore } from '../../../store/projectEdtStore';
import type { Project } from '../../../store/projectStore';

const mockProjectWithData: Project = {
  id: 'proj-mga-test-1',
  tenant_id: 'tenant-1',
  creator_id: 'user-1',
  name: 'Proyecto de Acueducto Rural',
  status: 'DRAFT',
  problem_description: 'Deficiente acceso a agua potable',
  general_objective: 'Mejorar el acceso a agua potable',
  product_code: '4001001',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  mga_formulation_data: {
    tipologia: 'General - Esquemas SUIFP',
    localizaciones: [
      {
        region_id: 1,
        departamento_id: 76,
        municipio_id: 76001,
      },
    ],
    necesidades: {
      items: [{ id: 'nec-1', bienServicio: 'Agua' }],
    },
    analisisTecnico: {
      items: { 'alt-1': 'Estudios hidrológicos concluidos' },
    },
    riesgos: {
      items: [{ id: 'risk-1', descripcion: 'Sequía severa' }],
    },
  },
};

describe('Evaluación de datos MGA y Desbloqueo de Navegación', () => {
  it('evalúa correctamente hasMgaSectionData para diferentes secciones', () => {
    // 1. Identificación: tiene problem_description
    expect(hasMgaSectionData('identificacion', mockProjectWithData, null, null)).toBe(true);

    // 2. Objetivos: tiene general_objective
    expect(hasMgaSectionData('objetivos', mockProjectWithData, null, null)).toBe(true);

    // 3. Localización: tiene localizaciones en mga_formulation_data
    expect(hasMgaSectionData('localizacion', mockProjectWithData, null, null)).toBe(true);

    // 4. Cadena de valor: tiene product_code
    expect(hasMgaSectionData('cadena-valor', mockProjectWithData, null, null)).toBe(true);

    // 5. Necesidades: tiene items
    expect(hasMgaSectionData('necesidades', mockProjectWithData, null, null)).toBe(true);

    // 6. Análisis técnico: tiene items
    expect(hasMgaSectionData('analisis-tecnico', mockProjectWithData, null, null)).toBe(true);

    // 7. Riesgos: tiene items
    expect(hasMgaSectionData('riesgos', mockProjectWithData, null, null)).toBe(true);

    // 8. Participantes: vacío inicialmente en mockProjectWithData
    expect(hasMgaSectionData('participantes', mockProjectWithData, null, null)).toBe(false);

    // Si le agregamos participantes a la formulación:
    const mockFormulation = {
      ...useProjectMgaStore.getState().getFormulation(mockProjectWithData.id),
      participants: [{ id: 'p-1', actor_id: 1, position_id: 1, interests: 'Comunidad' } as any],
    };
    expect(hasMgaSectionData('participantes', mockProjectWithData, mockFormulation, null)).toBe(true);
  });

  it('desbloquea pestañas con información gestionada y muestra icono de check', () => {
    // Inicializamos stores con datos para el proyecto
    useProjectMgaStore.setState((state) => ({
      byProjectId: {
        ...state.byProjectId,
        [mockProjectWithData.id]: {
          ...state.byProjectId[mockProjectWithData.id],
          causeRelations: [
            {
              id: 'c-1',
              causeType: 'Causa directa',
              causeDescription: 'Tuberías obsoletas',
              specificObjective: 'Reemplazar tuberías obsoletas',
            },
          ],
          generalIndicators: [],
          effects: [],
          participants: [{ id: 'part-1', actor_id: 1, position_id: 1, interests: 'Afectados' } as any],
          populations: [
            {
              id: 'pop-1',
              population_type: 'afectada',
              total_number: 1200,
              source: 'DANE',
            } as any,
          ],
          alternativas: [
            {
              id: 'alt-1',
              description: 'Construcción red nueva',
              proceeds_to_preparation: true,
            } as any,
          ],
          completedSections: {},
        },
      },
    }));

    useProjectEdtStore.setState((state) => ({
      byProjectId: {
        ...state.byProjectId,
        [mockProjectWithData.id]: {
          catalogLink: { product_code: '4001001', product_name: 'Acueducto' } as any,
          edtNodes: [{ id: 'node-1', code: '1.1', name: 'Obras preliminares' } as any],
          deliverables: [],
          activities: [],
        },
      },
    }));

    const handleChangeSubTab = vi.fn();

    render(
      <MGALayout
        project={mockProjectWithData}
        activeTab="identificacion"
        onChangeSubTab={handleChangeSubTab}
      />
    );

    // Problemática (identificacion) debe estar desbloqueada y tener check
    const problematicaBtn = screen.getByRole('button', { name: /^Problemática$/i });
    expect(problematicaBtn).not.toBeDisabled();

    // Participantes debe estar desbloqueado y tener check
    const participantesBtn = screen.getByRole('button', { name: /^Participantes$/i });
    expect(participantesBtn).not.toBeDisabled();

    // Población debe estar desbloqueada y tener check
    const poblacionBtn = screen.getByRole('button', { name: /^Población$/i });
    expect(poblacionBtn).not.toBeDisabled();

    // Objetivos debe estar desbloqueado y tener check
    const objetivosBtn = screen.getByRole('button', { name: /^Objetivos$/i });
    expect(objetivosBtn).not.toBeDisabled();

    // Alternativas debe estar desbloqueada y tener check
    const alternativasBtn = screen.getByRole('button', { name: /^Alternativas$/i });
    expect(alternativasBtn).not.toBeDisabled();

    // Verificar que al hacer click se llama onChangeSubTab
    fireEvent.click(participantesBtn);
    expect(handleChangeSubTab).toHaveBeenCalledWith('participantes');

    // Verificar la presencia de badges de verificación para las secciones completas
    const checkBadges = screen.getAllByTitle('Sección con información gestionada');
    expect(checkBadges.length).toBeGreaterThanOrEqual(4);
  });
});
