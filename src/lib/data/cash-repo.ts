import type { CashMovementInput } from "../validations";

export type CashMovement = {
  id: number;
  type: "ingreso" | "gasto";
  amount: number;
  concept: string;
  movementDate: string;
  sourceType: string | null;
  sourceId: number | null;
  notes: string | null;
  createdAt: string;
};

export interface CashRepo {
  list(): Promise<CashMovement[]>;
  getBalance(): Promise<number>;
  recordMovement(input: CashMovementInput): Promise<CashMovement>;
}
