export type PurchaseOrderStatus = "pendiente" | "en_viaje" | "recibido" | "cancelado";

const PURCHASE_ORDER_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  pendiente: ["en_viaje", "cancelado"],
  en_viaje: ["recibido", "cancelado"],
  recibido: [],
  cancelado: [],
};

export function canTransitionPurchaseOrder(from: PurchaseOrderStatus, to: PurchaseOrderStatus): boolean {
  return PURCHASE_ORDER_TRANSITIONS[from].includes(to);
}
