import { describe, expect, it } from 'vitest';
import { computeNeedDeficit, draftDeficit, draftFromRow, isDraftDirty, parseNeedInput } from './mgaNeeds';

describe('mgaNeeds', () => {
  it('deficit = demanda - oferta', () => {
    expect(computeNeedDeficit(150, 15000)).toBe(14850);
    expect(computeNeedDeficit(100, 40)).toBe(-60);
    expect(computeNeedDeficit(0.1, 0.3)).toBe(0.2);
  });

  it('parseNeedInput: vacío=0, coma decimal, inválidos=null', () => {
    expect(parseNeedInput('')).toBe(0);
    expect(parseNeedInput('12,5')).toBe(12.5);
    expect(parseNeedInput('abc')).toBeNull();
    expect(parseNeedInput('-1')).toBeNull();
  });

  it('draftDeficit calcula en vivo y devuelve null con valores inválidos', () => {
    expect(draftDeficit({ oferta: '150', demanda: '15000' })).toBe(14850);
    expect(draftDeficit({ oferta: '', demanda: '10' })).toBe(10);
    expect(draftDeficit({ oferta: 'x', demanda: '10' })).toBeNull();
  });

  it('isDraftDirty compara contra la fila guardada', () => {
    const row = { anio: 2020, oferta: 150, demanda: 15000, deficit: 14850 };
    expect(isDraftDirty(draftFromRow(row), row)).toBe(false);
    expect(isDraftDirty({ oferta: '151', demanda: '15000' }, row)).toBe(true);
  });
});
