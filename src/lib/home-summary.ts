import { localDateKey, shiftLocalDate } from './format';

// Numbers behind the owner's Inicio (app/home/index.tsx). Sales dates are UTC
// SQLite text; every day here is the local calendar day ('YYYY-MM-DD').

export type DailyTotal = { date: string; total: number; count: number };

// Sales per local day for the `days` days ending on `today`, oldest first;
// days without sales are present with zeros.
export function dailySalesTotals(sales: { saleDate: string; totalAmount: number }[], today: string, days: number): DailyTotal[] {
  const buckets = new Map<string, DailyTotal>();
  for (let i = days - 1; i >= 0; i--) {
    const date = shiftLocalDate(today, -i);
    buckets.set(date, { date, total: 0, count: 0 });
  }
  for (const sale of sales) {
    const bucket = buckets.get(localDateKey(sale.saleDate));
    if (!bucket) continue;
    bucket.total += sale.totalAmount;
    bucket.count += 1;
  }
  return [...buckets.values()];
}

// Rounded percent change from `previous` to `current`; null when `previous`
// is 0 (no base to compare against).
export function changeVsPrevious(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// Units sold per product on or after the local day `since`, most sold first
// (ties keep first appearance), at most `limit` products.
export function topSoldProducts(
  sales: { saleDate: string; items: { productId: number; quantity: number }[] }[],
  since: string,
  limit: number,
): { productId: number; quantity: number }[] {
  const units = new Map<number, number>();
  for (const sale of sales) {
    if (localDateKey(sale.saleDate) < since) continue;
    for (const item of sale.items) units.set(item.productId, (units.get(item.productId) ?? 0) + item.quantity);
  }
  return [...units.entries()]
    .map(([productId, quantity]) => ({ productId, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
}
