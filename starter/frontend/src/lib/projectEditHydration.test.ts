import { describe, expect, it } from 'vitest';
import {
  extractProjectEditValues,
  resolveOptionValue,
  resolveProcesoId,
  resolveSectorId,
} from './projectEditHydration';

describe('extractProjectEditValues', () => {
  it('lee proceso, tipología y tipo de inversión desde identificacion', () => {
    const v = extractProjectEditValues({
      sector_id: 'sec-1',
      product_code: '4001001',
      mga_formulation_data: {
        identificacion: { proceso_id: 3, tipologia: 'A - PIIP - Bienes y Servicios', tipo_inversion: 'Territorial' },
      },
    });
    expect(v).toMatchObject({
      proceso: '3',
      tipologia: 'A - PIIP - Bienes y Servicios',
      tipoInversion: 'Territorial',
      sectorId: 'sec-1',
      productCode: '4001001',
    });
  });

  it('usa la raíz de mga_formulation_data y el proyecto como respaldo', () => {
    const v = extractProjectEditValues({
      sector: 'Educación',
      proceso: 'Planeación',
      mga_formulation_data: JSON.stringify({ tipologia: 'General', identificacion: { product_code: '22' } }),
    });
    expect(v).toMatchObject({ proceso: 'Planeación', tipologia: 'General', sectorName: 'Educación', productCode: '22' });
    expect(v.tipoInversion).toBe('Territorial');
  });
});

describe('resolvers', () => {
  const procesos = [{ id: 7, name: 'Gestión Educativa' }];
  it('resuelve proceso por id o por nombre sin tildes', () => {
    expect(resolveProcesoId('7', procesos)).toBe('7');
    expect(resolveProcesoId('gestion educativa', procesos)).toBe('7');
    expect(resolveProcesoId('Otro', procesos)).toBe('Otro');
  });

  it('ajusta la tipología a la opción del select', () => {
    const opts = ["General - Esquemas SUIFP's", 'A - PIIP - Bienes y Servicios'];
    expect(resolveOptionValue('a - piip - bienes y servicios', opts)).toBe('A - PIIP - Bienes y Servicios');
    expect(resolveOptionValue('General - Esquemas SUIFP’s', opts)).toBe("General - Esquemas SUIFP's");
  });

  it('resuelve sector por id, código o nombre', () => {
    const sectors = [{ id: 'uuid-1', code: '22', name: 'Educación' }];
    expect(resolveSectorId('uuid-1', '', sectors)).toBe('uuid-1');
    expect(resolveSectorId('', 'educacion', sectors)).toBe('uuid-1');
    expect(resolveSectorId('22', '', sectors)).toBe('uuid-1');
    expect(resolveSectorId('missing', '', sectors)).toBe('missing');
  });
});
