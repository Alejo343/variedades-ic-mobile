import type { CashMovementInput, CashTransferInput } from "../validations";

export type CashMovement = {
  id: number;
  type: "ingreso" | "gasto";
  amount: number;
  concept: string;
  movementDate: string;
  sourceType: string | null;
  sourceId: number | null;
  accountId: number;
  notes: string | null;
  createdAt: string;
};

export interface CashRepo {
  list(): Promise<CashMovement[]>;
  getBalance(): Promise<number>;
  recordMovement(input: CashMovementInput): Promise<CashMovement>;
  // Two movements (gasto in the origin, ingreso in the destination) that move
  // each account's balance but aren't business income/expense (domain/cash.ts).
  transfer(input: CashTransferInput): Promise<void>;
}
