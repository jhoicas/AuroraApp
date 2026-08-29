import { describe, expect, it } from 'vitest';
import { validateInfinitiveObjective } from './mgaObjectiveValidation';

describe('validateInfinitiveObjective', () => {
  it('acepta objetivos que inician con infinitivo', () => {
    expect(validateInfinitiveObjective('Mejorar las vías interconectoras del municipio')).toBeNull();
    expect(validateInfinitiveObjective('Construir acueductos rurales')).toBeNull();
    expect(validateInfinitiveObjective('Reducir la mortalidad infantil')).toBeNull();
  });

  it('rechaza objetivos que no inician con infinitivo', () => {
    expect(validateInfinitiveObjective('Mejoramiento de vías urbanas')).toMatch(/infinitivo/i);
    expect(validateInfinitiveObjective('La infraestructura vial renovada')).toMatch(/infinitivo/i);
  });

  it('no valida texto vacío', () => {
    expect(validateInfinitiveObjective('')).toBeNull();
    expect(validateInfinitiveObjective('   ')).toBeNull();
  });
});
