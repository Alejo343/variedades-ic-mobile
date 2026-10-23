// A 'store' seller is paid either a commission on each sale (per product, see
// commission.ts) or a fixed salary, weekly or monthly (decisión del usuario,
// 2026-10-23). A salaried seller's sales carry no commission.
//
// Contract:
// - Dates are plain local calendar days "YYYY-MM-DD" (no time, no zone).
// - A week runs Monday → Sunday; a month, from the 1st to its last day. A
//   period is identified by its first day (periodStart).
// - The first period is the one containing sellers.salary_start_date: the day
//   the salary was configured, reset when the period type changes.
// - A salary payment covers exactly one period; its amount is editable (it
//   defaults to the configured salary) and a period is never paid twice.
// The web repo has an identical copy of this file (lib/domain/salary.ts).

export type SellerPayType = "commission" | "salary";
export type SalaryPeriod = "weekly" | "monthly";

export const SALARY_PERIOD_LABEL: Record<SalaryPeriod, string> = { weekly: "semanal", monthly: "mensual" };

export const PENDING_COMMISSION_BLOCKS_SALARY =
  "Este vendedor tiene comisiones sin pagar. Págalas antes de pasarlo a sueldo fijo.";
export const SALARY_PERIOD_ALREADY_PAID = "Ese período ya está pagado";

// Calendar arithmetic on UTC dates, so no local zone or DST can shift a day.
function parseDay(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d ? parsed : null;
}

function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function day(date: string): Date {
  const parsed = parseDay(date);
  if (!parsed) throw new Error(`Fecha inválida: ${date}`);
  return parsed;
}

function addDays(date: string, days: number): string {
  const d = day(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toDay(d);
}

const SHORT_MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/** First day of the period containing `date`: its Monday (weekly) or the 1st (monthly). */
export function salaryPeriodStart(date: string, period: SalaryPeriod): string {
  const d = day(date);
  if (period === "monthly") return toDay(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
  // getUTCDay: 0 = Sunday … 6 = Saturday; days back to that week's Monday.
  return addDays(date, -((d.getUTCDay() + 6) % 7));
}

/** Last day of the period that starts on `periodStart`: its Sunday, or the month's last day. */
export function salaryPeriodEnd(periodStart: string, period: SalaryPeriod): string {
  if (period === "weekly") return addDays(periodStart, 6);
  const d = day(periodStart);
  return toDay(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

/** Whether `date` is a real calendar day that starts a period (a Monday / a 1st). */
export function isSalaryPeriodStart(date: string, period: SalaryPeriod): boolean {
  return parseDay(date) !== null && salaryPeriodStart(date, period) === date;
}

/**
 * Short Spanish label: "13–19 oct 2026", "27 oct – 2 nov 2026",
 * "29 dic 2025 – 4 ene 2026" (weekly), "Octubre 2026" (monthly).
 */
export function formatSalaryPeriod(periodStart: string, period: SalaryPeriod): string {
  const start = day(periodStart);
  if (period === "monthly") return `${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
  const end = day(salaryPeriodEnd(periodStart, period));
  const [sd, sm, sy] = [start.getUTCDate(), SHORT_MONTHS[start.getUTCMonth()], start.getUTCFullYear()];
  const [ed, em, ey] = [end.getUTCDate(), SHORT_MONTHS[end.getUTCMonth()], end.getUTCFullYear()];
  if (sy !== ey) return `${sd} ${sm} ${sy} – ${ed} ${em} ${ey}`;
  if (sm !== em) return `${sd} ${sm} – ${ed} ${em} ${ey}`;
  return `${sd}–${ed} ${em} ${ey}`;
}

export type SalaryPeriodStatus = {
  start: string;
  end: string;
  // Its last day is before today: the salary is owed.
  ended: boolean;
  paid: boolean;
};

/**
 * Every period from the one containing `startDate` through the one containing
 * `today` (the current one included), oldest first. `paid` = its start is in
 * `paidStarts`. Empty when startDate is after today.
 */
export function salaryPeriods(
  startDate: string,
  period: SalaryPeriod,
  today: string,
  paidStarts: readonly string[],
): SalaryPeriodStatus[] {
  const paid = new Set(paidStarts);
  const periods: SalaryPeriodStatus[] = [];
  // Plain "YYYY-MM-DD" strings compare in calendar order.
  for (let start = salaryPeriodStart(startDate, period); start <= today; ) {
    const end = salaryPeriodEnd(start, period);
    periods.push({ start, end, ended: end < today, paid: paid.has(start) });
    start = addDays(end, 1);
  }
  return periods;
}

export type SellerPayConfig = {
  inventoryMode: string;
  payType: SellerPayType;
  salaryAmount: number | null;
  salaryPeriod: SalaryPeriod | null;
};

/** Why a seller's pay configuration is invalid, or null when it's fine. */
export function sellerPayConfigError(config: SellerPayConfig): string | null {
  if (config.payType !== "salary") return null;
  if (config.inventoryMode !== "store") return "Solo un vendedor de tienda puede tener sueldo fijo";
  if (config.salaryAmount === null || !Number.isInteger(config.salaryAmount) || config.salaryAmount <= 0) {
    return "El sueldo debe ser un valor mayor que cero";
  }
  if (config.salaryPeriod === null) return "Elige si el sueldo es semanal o mensual";
  return null;
}

type StartDateState = { payType: SellerPayType; salaryPeriod: SalaryPeriod | null; salaryStartDate: string | null };

/**
 * salary_start_date after saving a seller (`current` = null for a new one):
 * today when they become salaried or their period changes; unchanged when
 * only the amount (or nothing pay-related) changes; null when not salaried.
 */
export function nextSalaryStartDate(
  current: StartDateState | null,
  next: { payType: SellerPayType; salaryPeriod: SalaryPeriod | null },
  today: string,
): string | null {
  if (next.payType !== "salary") return null;
  if (current?.payType === "salary" && current.salaryPeriod === next.salaryPeriod && current.salaryStartDate) {
    return current.salaryStartDate;
  }
  return today;
}
