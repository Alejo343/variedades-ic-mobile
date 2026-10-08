// Avoids Intl.NumberFormat currency style, whose ICU data isn't reliably
// bundled with Hermes on Android — plain grouping is enough for COP (no decimals).
export function formatCOP(amount: number): string {
  const rounded = Math.round(amount);
  const grouped = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${rounded < 0 ? '-' : ''}$${grouped}`;
}

export function stockLabel(stock: number, minStock: number): string {
  if (stock === 0) return ' · agotado';
  if (minStock > 0 && stock <= minStock) return ' · stock bajo';
  return '';
}

// SQLite's CURRENT_TIMESTAMP default stores 'YYYY-MM-DD HH:MM:SS' (UTC, no
// timezone marker) — new Date() needs an explicit 'Z' to parse it as UTC
// instead of (inconsistently, depending on JS engine) local time.
function parseSqliteDate(value: string): Date {
  const iso = value.includes('T') ? value : value.replace(' ', 'T');
  return new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
}

// Inverse of parseSqliteDate above — formats a Date as the same shape SQLite
// itself writes for a CURRENT_TIMESTAMP-backed createdAt column:
// 'YYYY-MM-DD HH:MM:SS', UTC, no timezone marker. Needed because
// `new Date().toISOString()`'s 'T...Z' shape doesn't match the server's
// utcTimestamp schema (CLAUDE.md, "Fase 10") — any outbox payload field
// built from a JS-generated timestamp (not one SQLite already wrote, like
// updatedAt before Fase 10) must go through this, or the server rejects the
// operation with "Fecha con formato inválido" (bug found live, sesión
// 2026-10-03: settlements-repo.ts#markSettled's settledAt).
export function toSqliteUtcTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
}

export function formatRelativeTime(value: string): string {
  const diffMs = Date.now() - parseSqliteDate(value).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Hace instantes';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return parseSqliteDate(value).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

// Local calendar date (not UTC) as 'YYYY-MM-DD', to match what "today" means
// to the person using the app rather than the UTC timestamps SQLite stores.
export function todayLocalDateString(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// First instant AFTER the local calendar day `localDate` ('YYYY-MM-DD'), as a
// SQLite UTC timestamp. "Everything up to that day" is then `col < this`.
// Comparing DATE(col) against the local date is wrong: the column is UTC, so a
// sale at 23:50 in Colombia (04:50 UTC next day) would fall outside "today"
// (bug found live, sesión 2026-10-07, pending commissions showing 0).
export function endOfLocalDayUtc(localDate: string): string {
  const [year, month, day] = localDate.split('-').map(Number);
  return toSqliteUtcTimestamp(new Date(year, month - 1, day + 1));
}

// First instant of the local calendar day `localDate`, as a SQLite UTC
// timestamp — the lower bound to pair with endOfLocalDayUtc.
export function startOfLocalDayUtc(localDate: string): string {
  const [year, month, day] = localDate.split('-').map(Number);
  return toSqliteUtcTimestamp(new Date(year, month - 1, day));
}
