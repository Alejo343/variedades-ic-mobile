import { count, eq, sql } from "drizzle-orm";
import { formatSku, getSkuPrefix } from "../../domain/sku";
import type { CreateProductInput, Product, ProductsRepo, UpdateProductInput } from "../products-repo";
import { db } from "./db";
import { categories, products } from "./schema";

function toProduct(row: typeof products.$inferSelect): Product {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sku: row.sku,
    price: row.price,
    purchasePrice: row.purchasePrice,
    categoryId: row.categoryId,
    distributorCode: row.distributorCode,
    stock: row.stock,
    minStock: row.minStock,
    warrantyMonths: row.warrantyMonths,
    active: row.active,
    imageUri: row.imageUri,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// No concurrency risk to guard against (single device, single user, sequential
// awaits) — unlike the web's Postgres sequence, a simple count is enough here,
// and stays SKU-safe because products are only ever soft-deleted (see deactivate).
async function generateSku(categoryId: number | null | undefined): Promise<string> {
  let categoryName: string | null = null;
  if (categoryId) {
    const category = await db.query.categories.findFirst({ where: eq(categories.id, categoryId) });
    categoryName = category?.name ?? null;
  }
  const prefix = getSkuPrefix(categoryName);
  const [row] = await db.select({ total: count() }).from(products);
  return formatSku(prefix, row.total + 1);
}

export const localProductsRepo: ProductsRepo = {
  async list() {
    const rows = await db.select().from(products).orderBy(products.name);
    return rows.map(toProduct);
  },

  async getById(id: number) {
    const row = await db.query.products.findFirst({ where: eq(products.id, id) });
    return row ? toProduct(row) : null;
  },

  async findByDistributorCode(code: string) {
    const normalized = code.trim().toLowerCase();
    const row = await db.query.products.findFirst({
      where: sql`lower(${products.distributorCode}) = ${normalized}`,
    });
    return row ? toProduct(row) : null;
  },

  async create(data: CreateProductInput) {
    const sku = await generateSku(data.categoryId);
    const [row] = await db
      .insert(products)
      .values({
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        sku,
        price: data.price,
        purchasePrice: data.purchasePrice ?? 0,
        categoryId: data.categoryId ?? null,
        distributorCode: data.distributorCode ?? null,
        stock: data.stock ?? 0,
        minStock: data.minStock ?? 0,
        warrantyMonths: data.warrantyMonths ?? null,
        active: data.active ?? true,
        imageUri: data.imageUri ?? null,
      })
      .returning();
    return toProduct(row);
  },

  async update(id: number, data: UpdateProductInput) {
    const [row] = await db
      .update(products)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(products.id, id))
      .returning();
    if (!row) throw new Error("Producto no encontrado");
    return toProduct(row);
  },

  async deactivate(id: number) {
    await db
      .update(products)
      .set({ active: false, updatedAt: new Date().toISOString() })
      .where(eq(products.id, id));
  },
};
