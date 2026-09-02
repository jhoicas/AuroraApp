import { describe, expect, it } from 'vitest';
import { buildMgaLogicMatrix } from './mgaReportMatrix';

describe('buildMgaLogicMatrix', () => {
  it('incluye objetivo general y productos con actividades', () => {
    const rows = buildMgaLogicMatrix({
      generalObjective: 'Mejorar el acceso al agua',
      formulation: {
        causeRelations: [],
        generalIndicators: [
          {
            id: 'ind-1',
            indicator: 'Cobertura de acueducto',
            measuredThrough: 'Porcentaje',
            target: '85%',
            sourceType: 'Administrativa',
            verificationSource: 'Empresa de acueducto',
          },
        ],
        effects: [],
        participants: [],
        populations: [],
        alternatives: [],
      },
      edtChain: {
        catalogLink: null,
        edtNodes: [],
        deliverables: [
          {
            id: 'del-1',
            tenant_id: 't',
            project_id: 'p',
            project_edt_node_id: 'edt-1',
            code: 'P1',
            name: 'Red de distribución',
            amount: 100,
            created_at: '',
            updated_at: '',
          },
        ],
        activities: [
          {
            id: 'act-1',
            tenant_id: 't',
            project_id: 'p',
            project_deliverable_id: 'del-1',
            code: 'A1',
            name: 'Tubería principal',
            quantity: 5,
            unit_cost: 1000,
            total_cost: 5000,
            created_at: '',
            updated_at: '',
          },
        ],
      },
    });

    expect(rows[0].level).toBe('objective');
    expect(rows[0].narrative).toContain('Mejorar el acceso');
    expect(rows.some((row) => row.level === 'product' && row.narrative.includes('Red de distribución'))).toBe(
      true,
    );
    expect(rows.some((row) => row.level === 'activity' && row.indicators.includes('Meta: 5'))).toBe(true);
  });
});
