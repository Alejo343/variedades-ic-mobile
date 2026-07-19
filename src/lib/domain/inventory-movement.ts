import { deductStock, receiveStock } from "./stock";

export type MovementType =
  | "compra"
  | "venta"
  | "entrega_vendedor"
  | "devolucion"
  | "ajuste"
  | "perdida"
  | "dano"
  | "robo";

export type OwnerType = "principal" | "seller";

export type ApplyMovementResult = { ok: true; newBalance: number } | { ok: false; reason: string };

export function applyMovement(currentBalance: number, delta: number): ApplyMovementResult {
  if (delta === 0) {
    return { ok: false, reason: "El movimiento no puede tener cantidad cero" };
  }
  if (delta > 0) {
    return { ok: true, newBalance: receiveStock(currentBalance, delta) };
  }
  const result = deductStock(currentBalance, -delta);
  if (!result.ok) {
    return result;
  }
  return { ok: true, newBalance: result.newStock };
}

export function validateAdjustmentReason(type: MovementType, reason?: string | null): boolean {
  if (type !== "ajuste") {
    return true;
  }
  return !!reason && reason.trim().length > 0;
}
