export type SettlementStatus = "pendiente" | "liquidada";

const SETTLEMENT_TRANSITIONS: Record<SettlementStatus, SettlementStatus[]> = {
  pendiente: ["liquidada"],
  liquidada: [],
};

export function canTransitionSettlement(from: SettlementStatus, to: SettlementStatus): boolean {
  return SETTLEMENT_TRANSITIONS[from].includes(to);
}
