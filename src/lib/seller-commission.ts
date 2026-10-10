import { formatCOP } from './format';

export type CommissionType = 'percentage' | 'fixed_per_unit';

// A percentage commission is stored in basis points (1500 = 15%), like
// domain/commission.ts expects; the seller form shows and takes it as a
// percent. A fixed-per-unit commission is plain pesos on both sides.

/** Form text → stored value, or null when it isn't a valid commission. */
export function parseCommissionInput(type: CommissionType, text: string): number | null {
  const trimmed = text.trim();
  if (type === 'fixed_per_unit') {
    const digits = trimmed.replace(/\./g, '');
    return /^\d+$/.test(digits) ? Number(digits) : null;
  }
  const normalized = trimmed.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const percent = Number(normalized);
  if (percent > 100) return null;
  return Math.round(percent * 100);
}

/** Stored value → form text (inverse of parseCommissionInput). */
export function commissionToInput(type: CommissionType, value: number): string {
  if (type === 'fixed_per_unit') return String(value);
  return String(value / 100).replace('.', ',');
}

export function describeCommission(type: CommissionType, value: number): string {
  return type === 'percentage' ? `${commissionToInput(type, value)}% por venta` : `${formatCOP(value)} por unidad`;
}
