// A seller's commission is set per PRODUCT, as a percentage of its sale price
// in basis points (products.commission_bps: 1500 = 15%). Every seller earns
// the product's percentage — there is no per-seller configuration.
//
// Contract:
// - lineCommission = round(quantity × unitPrice × bps / 10000), to the peso.
// - A sale's commission is the sum of its rounded lines (each line rounds on
//   its own, so a line's commission is what the seller sees next to it).
// - unitPrice is the price actually charged on that line (a POS discount is
//   already spread over the lines' unitPrice), never the catalog price.
// The web repo has an identical copy of this file (lib/domain/commission.ts).

export type CommissionLine = { quantity: number; unitPrice: number; commissionBps: number };

export function lineCommission(line: CommissionLine): number {
  return Math.round((line.quantity * line.unitPrice * line.commissionBps) / 10000);
}

export function calculateCommission(lines: CommissionLine[]): number {
  return lines.reduce((sum, line) => sum + lineCommission(line), 0);
}

/**
 * Percentage as typed in a form or read from an Excel cell → basis points, or
 * null when empty or invalid (outside 0–100, or more than two decimals).
 * Text accepts a comma or dot decimal and an optional "%" ("12,5", "15 %").
 * A number is a percent (15 = 15%), except one strictly between 0 and 1,
 * which is what Excel gives for a cell formatted as percentage (15% → 0.15).
 */
export function parseCommissionPercent(value: unknown): number | null {
  let percent: number;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    percent = value > 0 && value < 1 ? value * 100 : value;
  } else if (typeof value === "string") {
    const text = value.replace(/%/g, "").trim();
    if (!/^\d+([.,]\d{1,2})?$/.test(text)) return null;
    percent = Number(text.replace(",", "."));
  } else {
    return null;
  }
  if (percent < 0 || percent > 100) return null;
  const bps = Math.round(percent * 100);
  if (Math.abs(bps - percent * 100) > 1e-6) return null;
  return bps;
}

/** Basis points → "15%", "12,5%". */
export function formatCommissionPercent(bps: number): string {
  return `${String(bps / 100).replace(".", ",")}%`;
}
