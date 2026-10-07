import { describe, expect, it } from 'vitest';
import { MGA_SEED_TEMPLATE } from '../data/mgaSeedTemplate';
import { useProjectTemplateStore } from '../store/projectTemplateStore';
import { buildProjectFromTemplate, cloneFormulation } from './projectTemplates';

describe('cloneFormulation', () => {
  it('produce una copia profunda con IDs nuevos y referencias consistentes', () => {
    const original = MGA_SEED_TEMPLATE.formulation;
    const snapshot = JSON.stringify(original);
    const copy = cloneFormulation(original);

    expect(JSON.stringify(original)).toBe(snapshot);
    expect(copy).not.toBe(original);
    expect(copy.identificacion).not.toBe(original.identificacion);

    const oldCausas = original.identificacion.problematica!.causas.map((c) => c.id);
    const newCausas = copy.identificacion.problematica!.causas.map((c) => c.id);
    expect(newCausas.some((id) => oldCausas.includes(id))).toBe(false);

    const directa = copy.identificacion.problematica!.causas.find((c) => c.tipo === 'directa')!;
    expect(copy.identificacion.objetivos!.objetivosEspecificos[directa.id]).toBeTruthy();
    const altId = copy.evaluacion.alternativaSeleccionadaId;
    expect(copy.preparacion.cadenaValorPrep![altId].objetivos[directa.id]).toBeDefined();
  });

  it('elimina campos de auditoría', () => {
    const copy = cloneFormulation({ id: 'a', tenant_id: 't', created_at: 'x', nested: [{ project_id: 'p', v: 1 }] });
    expect(copy).toEqual({ id: expect.any(String), nested: [{ v: 1 }] });
  });
});

describe('plantilla semilla', () => {
  it('es completa y de sistema', () => {
    const t = buildProjectFromTemplate(MGA_SEED_TEMPLATE);
    expect(MGA_SEED_TEMPLATE.isSystem).toBe(true);
    expect(t.problem_description).toBeTruthy();
    expect(t.general_objective.startsWith('Incrementar')).toBe(true);
    expect(t.mga_formulation_data.participants.length).toBeGreaterThanOrEqual(3);
  });

  it('no se puede eliminar', () => {
    expect(() => useProjectTemplateStore.getState().deleteProjectTemplate(MGA_SEED_TEMPLATE.id)).toThrow();
  });
});
