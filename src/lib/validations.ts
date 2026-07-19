import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  slug: z.string().min(1, "El slug es requerido").regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones"),
  description: z.string().optional(),
  active: z.boolean().optional().default(true),
});

export const productSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  slug: z.string().min(1, "El slug es requerido").regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones"),
  description: z.string().optional(),
  price: z.number().int().min(0, "El precio debe ser mayor a 0"),
  purchasePrice: z.number().int().min(0, "El precio de compra debe ser mayor a 0").optional().default(0),
  categoryId: z.number().int().nullable().optional(),
  stock: z.number().int().min(0).optional().default(0),
  minStock: z.number().int().min(0).optional().default(0),
  warrantyMonths: z.number().int().min(0).nullable().optional(),
  active: z.boolean().optional().default(true),
  imageUri: z.string().nullable().optional(),
});

export const inventoryAdjustmentSchema = z.object({
  productId: z.number().int(),
  quantityDelta: z.number().int().refine((v) => v !== 0, "La cantidad no puede ser cero"),
  reason: z.string().min(1, "El motivo es requerido"),
});

export const cashMovementSchema = z.object({
  type: z.enum(["ingreso", "gasto"]),
  amount: z.number().int().min(1, "El monto debe ser mayor a 0"),
  concept: z.string().min(1, "El concepto es requerido"),
  notes: z.string().optional(),
});

export const directSaleItemSchema = z.object({
  productId: z.number().int(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().int().min(0),
});

export const directSaleSchema = z.object({
  items: z.array(directSaleItemSchema).min(1, "Debe incluir al menos un producto"),
  notes: z.string().optional(),
});

export type CategoryInput = z.infer<typeof categorySchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type InventoryAdjustmentInput = z.infer<typeof inventoryAdjustmentSchema>;
export type CashMovementInput = z.infer<typeof cashMovementSchema>;
export type DirectSaleItemInput = z.infer<typeof directSaleItemSchema>;
export type DirectSaleInput = z.infer<typeof directSaleSchema>;

export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}
