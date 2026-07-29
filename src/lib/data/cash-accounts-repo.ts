import type { CashAccountInput } from "../validations";

export type CashAccount = {
  id: number;
  name: string;
  type: "efectivo" | "banco";
  active: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateCashAccountInput = CashAccountInput;
export type UpdateCashAccountInput = Partial<CreateCashAccountInput>;

// balance is derived (SUM of the account's own cash_movements), never stored
// — same criterion as cashRepo.getBalance today, just scoped per account.
export type CashAccountWithBalance = CashAccount & { balance: number };

export interface CashAccountsRepo {
  list(): Promise<CashAccount[]>;
  getById(id: number): Promise<CashAccount | null>;
  create(data: CreateCashAccountInput): Promise<CashAccount>;
  update(id: number, data: UpdateCashAccountInput): Promise<CashAccount>;
  deactivate(id: number): Promise<void>;
  listWithBalances(): Promise<CashAccountWithBalance[]>;
}
