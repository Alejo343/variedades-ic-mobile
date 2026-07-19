export function receiveStock(currentStock: number, quantity: number): number {
  return currentStock + quantity;
}

export type StockDeductionResult = { ok: true; newStock: number } | { ok: false; reason: string };

export function deductStock(currentStock: number, quantity: number): StockDeductionResult {
  if (quantity > currentStock) {
    return { ok: false, reason: `Stock insuficiente: hay ${currentStock}, se requieren ${quantity}` };
  }
  return { ok: true, newStock: currentStock - quantity };
}
