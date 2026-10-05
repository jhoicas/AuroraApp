import { describe, expect, it } from 'vitest';
import type { Project } from '../store/projectStore';
import { applyBaseToRow, applyBaseToRows, resolveProjectBaseLocation } from './projectBaseLocation';

const project = (extra: Partial<Project>): Partial<Project> => ({ id: 'p1', ...extra });

describe('resolveProjectBaseLocation', () => {
  it('prioriza base_* del backend', () => {
    const base = resolveProjectBaseLocation(
      project({ base_departamento_id: 76, base_region_id: 3, departamento_id: 11, region_id: 1 }),
    );
    expect(base).toEqual({ regionId: 3, departamentoId: 76 });
  });

  it('usa la clave reservada localizacion_base de mga_formulation_data', () => {
    const base = resolveProjectBaseLocation(
      project({ mga_formulation_data: { localizacion_base: { departamento_id: '05', region_id: 2 } } }),
    );
    expect(base).toEqual({ regionId: 2, departamentoId: 5 });
  });

  it('cae a departamento_id/region_id de respuestas antiguas, aceptando camelCase', () => {
    expect(resolveProjectBaseLocation(project({ departamentoId: 11, regionId: 1 }))).toEqual({
      regionId: 1,
      departamentoId: 11,
    });
    expect(resolveProjectBaseLocation(project({ departamento_id: 11 }))).toEqual({ regionId: null, departamentoId: 11 });
  });

  it('prueba las fuentes en orden y devuelve null sin departamento', () => {
    expect(resolveProjectBaseLocation(null, project({ base_departamento_id: 76 }))?.departamentoId).toBe(76);
    expect(resolveProjectBaseLocation(null, undefined, project({ region_id: 1 }))).toBeNull();
    expect(resolveProjectBaseLocation()).toBeNull();
  });
});

describe('applyBaseToRow(s)', () => {
  const base = { regionId: 3, departamentoId: 76 };
  const empty = { region_id: null, departamento_id: null, municipio_id: null, tipo_agrupacion_id: null, agrupacion_id: null };

  it('fuerza región y departamento base sin tocar el municipio de filas ya válidas', () => {
    const { row, adjusted } = applyBaseToRow({ ...empty, departamento_id: 76, municipio_id: 76001 }, base);
    expect(adjusted).toBe(false);
    expect(row).toMatchObject({ region_id: 3, departamento_id: 76, municipio_id: 76001 });
  });

  it('completa filas vacías con la base', () => {
    const { row, adjusted } = applyBaseToRow(empty, base);
    expect(adjusted).toBe(false);
    expect(row).toMatchObject({ region_id: 3, departamento_id: 76, municipio_id: null });
  });

  it('una fila de otro departamento se ajusta y pierde municipio y agrupación', () => {
    const { row, adjusted } = applyBaseToRow(
      { ...empty, region_id: 1, departamento_id: 11, municipio_id: 11001, tipo_agrupacion_id: 1, agrupacion_id: 9 },
      base,
    );
    expect(adjusted).toBe(true);
    expect(row).toEqual({
      region_id: 3,
      departamento_id: 76,
      municipio_id: null,
      tipo_agrupacion_id: null,
      agrupacion_id: null,
    });
  });

  it('applyBaseToRows cuenta las filas ajustadas', () => {
    const { rows, adjusted } = applyBaseToRows(
      [
        { ...empty, departamento_id: 76, municipio_id: 76001 },
        { ...empty, departamento_id: 5, municipio_id: 5001 },
      ],
      base,
    );
    expect(adjusted).toBe(1);
    expect(rows.every((r) => r.departamento_id === 76)).toBe(true);
  });

  it('con región base desconocida conserva la región de la fila', () => {
    const { row } = applyBaseToRow({ ...empty, region_id: 2, departamento_id: 76 }, { regionId: null, departamentoId: 76 });
    expect(row.region_id).toBe(2);
  });
});
