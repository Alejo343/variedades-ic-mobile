import { describe, expect, it } from 'vitest';

import { commissionToInput, describeCommission, parseCommissionInput } from './seller-commission';

// The form shows a percentage as a percent ("15", "12,5") while storage keeps
// basis points (1500, 1250) like commission.ts; fixed-per-unit stays in pesos.
describe('parseCommissionInput', () => {
  it('convierte un porcentaje a puntos base, con punto o coma decimal', () => {
    expect(parseCommissionInput('percentage', '15')).toBe(1500);
    expect(parseCommissionInput('percentage', '12.5')).toBe(1250);
    expect(parseCommissionInput('percentage', '12,5')).toBe(1250);
    expect(parseCommissionInput('percentage', '0')).toBe(0);
  });

  it('deja la comisión fija en pesos enteros, ignorando separadores de miles', () => {
    expect(parseCommissionInput('fixed_per_unit', '2000')).toBe(2000);
    expect(parseCommissionInput('fixed_per_unit', '2.000')).toBe(2000);
  });

  it('rechaza vacío, negativo, texto y un porcentaje mayor a 100', () => {
    expect(parseCommissionInput('percentage', '')).toBeNull();
    expect(parseCommissionInput('percentage', '-5')).toBeNull();
    expect(parseCommissionInput('percentage', 'abc')).toBeNull();
    expect(parseCommissionInput('percentage', '101')).toBeNull();
    expect(parseCommissionInput('fixed_per_unit', '')).toBeNull();
  });
});

describe('commissionToInput', () => {
  it('es la inversa para precargar el formulario', () => {
    expect(commissionToInput('percentage', 1500)).toBe('15');
    expect(commissionToInput('percentage', 1250)).toBe('12,5');
    expect(commissionToInput('fixed_per_unit', 2000)).toBe('2000');
  });
});

describe('describeCommission', () => {
  it('describe la comisión para mostrarla', () => {
    expect(describeCommission('percentage', 1500)).toBe('15% por venta');
    expect(describeCommission('percentage', 1250)).toBe('12,5% por venta');
    expect(describeCommission('fixed_per_unit', 2000)).toBe('$2.000 por unidad');
  });
});
