export type CommissionConfig =
  | { type: "percentage"; value: number }
  | { type: "fixed_per_unit"; value: number };

export function calculateCommission(config: CommissionConfig, saleTotal: number, quantity: number): number {
  if (config.type === "percentage") {
    return Math.round((saleTotal * config.value) / 10000);
  }
  return config.value * quantity;
}
