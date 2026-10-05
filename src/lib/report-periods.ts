/**
 * Date-range presets for the Reports screen. Pure — `today` is injected so
 * the ranges are testable.
 *
 * Contract:
 * - Dates are 'YYYY-MM-DD' strings in the device's LOCAL calendar, both ends
 *   inclusive (same shape ReportsRepo's from/to already take).
 * - 'all' has no bounds (`from`/`to` undefined) — "all time".
 * - Every bounded preset ends today except 'lastMonth', which covers the
 *   whole previous calendar month.
 */

export type ReportPeriod = 'today' | 'last7' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'all';

export type DateRange = { from?: string; to?: string };

export const REPORT_PERIODS: { key: ReportPeriod; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'last7', label: '7 días' },
  { key: 'thisMonth', label: 'Este mes' },
  { key: 'lastMonth', label: 'Mes anterior' },
  { key: 'thisYear', label: 'Este año' },
  { key: 'all', label: 'Todo' },
];

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function periodRange(period: ReportPeriod, today: Date): DateRange {
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const end = toDateString(today);

  switch (period) {
    case 'today':
      return { from: end, to: end };
    case 'last7':
      return { from: toDateString(new Date(y, m, d - 6)), to: end };
    case 'thisMonth':
      return { from: toDateString(new Date(y, m, 1)), to: end };
    case 'lastMonth':
      // Day 0 of the current month is the last day of the previous one.
      return { from: toDateString(new Date(y, m - 1, 1)), to: toDateString(new Date(y, m, 0)) };
    case 'thisYear':
      return { from: toDateString(new Date(y, 0, 1)), to: end };
    case 'all':
      return {};
  }
}

/** Human label for a range, e.g. "1 oct – 4 oct 2026", "4 oct 2026", "Todo el historial". */
export function formatRangeLabel(range: DateRange): string {
  if (!range.from || !range.to) return 'Todo el historial';
  const [fy, fm, fd] = range.from.split('-').map(Number);
  const [ty, tm, td] = range.to.split('-').map(Number);
  const short = (mo: number, day: number) => `${day} ${MONTHS[mo - 1]}`;
  if (range.from === range.to) return `${short(fm, fd)} ${fy}`;
  if (fy === ty) return `${short(fm, fd)} – ${short(tm, td)} ${ty}`;
  return `${short(fm, fd)} ${fy} – ${short(tm, td)} ${ty}`;
}
