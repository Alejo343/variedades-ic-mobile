import { localCashRepo } from "./local/cash-repo";
import { localCategoriesRepo } from "./local/categories-repo";
import { localDirectSalesRepo } from "./local/direct-sales-repo";
import { localInventoryRepo } from "./local/inventory-repo";
import { localProductsRepo } from "./local/products-repo";
import type { CashRepo } from "./cash-repo";
import type { CategoriesRepo } from "./categories-repo";
import type { DirectSalesRepo } from "./direct-sales-repo";
import type { InventoryRepo } from "./inventory-repo";
import type { ProductsRepo } from "./products-repo";

// Only implementation today. When a remote sync phase exists, a
// lib/data/remote/* implementation of the same interfaces gets added and
// swapped in here — screens never import local/ or remote/ directly.
export const productsRepo: ProductsRepo = localProductsRepo;
export const inventoryRepo: InventoryRepo = localInventoryRepo;
export const categoriesRepo: CategoriesRepo = localCategoriesRepo;
export const cashRepo: CashRepo = localCashRepo;
export const directSalesRepo: DirectSalesRepo = localDirectSalesRepo;

export type { Product, CreateProductInput, UpdateProductInput } from "./products-repo";
export type { InventoryMovement } from "./inventory-repo";
export type { Category, CreateCategoryInput, UpdateCategoryInput } from "./categories-repo";
export type { CashMovement } from "./cash-repo";
export type { DirectSale, DirectSaleItem } from "./direct-sales-repo";
