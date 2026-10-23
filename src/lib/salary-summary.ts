import type { SalaryPayment, Seller } from "./data";
import { salaryPeriods, type SalaryPeriod, type SalaryPeriodStatus } from "./domain/salary";

// A salaried seller's salary at a glance, for the profile, the sellers list,
// the pay screen and the seller's own screens.
export type SalarySummary = {
  amount: number;
  period: SalaryPeriod;
  // Periods without a payment, oldest first — the current one included (it
  // can be paid on its last day); `owed` are the ones that already ended.
  unpaid: SalaryPeriodStatus[];
  owed: SalaryPeriodStatus[];
  // owed × the configured salary: an estimate, each payment's amount may differ.
  owedAmount: number;
};

// null unless the seller is salaried with a complete configuration. Only
// payments of the configured period count (a monthly payment from before a
// switch to weekly never covers a week).
export function salarySummary(
  seller: Pick<Seller, "payType" | "salaryAmount" | "salaryPeriod" | "salaryStartDate">,
  payments: Pick<SalaryPayment, "period" | "periodStart">[],
  today: string,
): SalarySummary | null {
  const { payType, salaryAmount, salaryPeriod, salaryStartDate } = seller;
  if (payType !== "salary" || !salaryAmount || !salaryPeriod || !salaryStartDate) return null;
  const paidStarts = payments.filter((p) => p.period === salaryPeriod).map((p) => p.periodStart);
  const unpaid = salaryPeriods(salaryStartDate, salaryPeriod, today, paidStarts).filter((p) => !p.paid);
  const owed = unpaid.filter((p) => p.ended);
  return { amount: salaryAmount, period: salaryPeriod, unpaid, owed, owedAmount: owed.length * salaryAmount };
}
