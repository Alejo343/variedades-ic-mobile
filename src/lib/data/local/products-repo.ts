import { asc, count, eq, getTableColumns, sql } from "drizzle-orm";
import { type ImageDraft, normalizeImages } from "../../domain/product-images";
import { formatSku, getSkuPrefix } from "../../domain/sku";
import { deleteProductImageFile } from "../../images";
import { enqueueOperation } from "../../sync/outbox";
import type { CreateProductInput, Product, ProductImage, ProductsRepo, UpdateProductInput } from "../products-repo";
import type { Tx } from "./db";
import { db } from "./db";
import { recordProductMovement } from "./inventory-repo";
import { categories, productImages, products } from "./schema";

// Select shape for any query that returns Product: every products column plus
// the thumbnail URL, resolved with the same subquery ordering as the web
// (primary first, then display order). Shared with local/inventory-repo.ts so
// there's a single products -> Product mapping in the project.
// `products.id` is written fully qualified on purpose: in a single-table
// select Drizzle renders `${products.id}` as a bare "id", which inside this
// subquery would silently bind to product_images.id instead.
export const productColumns = {
  ...getTableColumns(products),
  primaryImageUri: sql<string | null>`(
    SELECT ${productImages.url} FROM ${productImages}
    WHERE ${productImages.productId} = "products"."id"
    ORDER BY ${productImages.isPrimary} DESC, ${productImages.displayOrder} ASC
    LIMIT 1
  )`,
};

type ProductRow = typeof products.$inferSelect & { primaryImageUri: string | null };

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    uuid: row.uuid,
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
    primaryImageUri: row.primaryImageUri,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toProductImage(row: typeof productImages.$inferSelect): ProductImage {
  return {
    id: row.id,
    productId: row.productId,
    url: row.url,
    alt: row.alt,
    displayOrder: row.displayOrder,
    isPrimary: row.isPrimary,
  };
}

async function getProduct(id: number): Promise<Product | null> {
  const [row] = await db.select(productColumns).from(products).where(eq(products.id, id));
  return row ? toProduct(row) : null;
}

// upsertProduct never carries sku or stock (the server assigns/derives both —
// see CLAUDE.md, "Fase 10", sub-paso 7 parte 3a). `images` is included only
// when the CURRENT gallery has nothing left to upload: a fresh photo's url
// is still this device's local file:// path, which the server's push rejects
// outright ("todavía no se ha subido"), so sending it now would just get the
// whole operation rejected. Once sub-paso 13's photo-upload step turns every
// url into the server's own remote path, it calls this same function again
// (with nothing pending) and that follow-up carries `images` for real — an
// edit made after everything's already synced (e.g. removing a photo, or one
// that never had any) doesn't need to wait for that: this reads the gallery
// fresh every time, so it's included immediately whenever there's nothing
// local left in it.
export async function buildUpsertProductPayload(tx: Tx, row: typeof products.$inferSelect) {
  const categoryUuid = row.categoryId
    ? (await tx.query.categories.findFirst({ where: eq(categories.id, row.categoryId), columns: { uuid: true } }))?.uuid ?? null
    : null;
  const images = await tx.select().from(productImages).where(eq(productImages.productId, row.id)).orderBy(asc(productImages.displayOrder));
  const hasPendingUpload = images.some((image) => image.url.startsWith("file:"));

  return {
    uuid: row.uuid,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: row.price,
    purchasePrice: row.purchasePrice,
    categoryUuid,
    distributorCode: row.distributorCode,
    minStock: row.minStock,
    warrantyMonths: row.warrantyMonths,
    active: row.active,
    ...(hasPendingUpload
      ? {}
      : { images: images.map((image) => ({ uuid: image.uuid, url: image.url, alt: image.alt, displayOrder: image.displayOrder, isPrimary: image.isPrimary })) }),
  };
}

// Makes the product's gallery match `drafts` exactly (order = displayOrder).
// Rows whose URL survives are updated in place (keeping their id, which a
// future sync can rely on); the rest are deleted or inserted. Returns the URLs
// that were dropped, so the caller can delete their files after commit.
async function replaceImages(tx: Tx, productId: number, drafts: ImageDraft[]): Promise<string[]> {
  const normalized = normalizeImages(drafts);
  const existing = await tx.select().from(productImages).where(eq(productImages.productId, productId));
  const keptUrls = new Set(normalized.map((image) => image.url));
  const now = new Date().toISOString();

  // Clear the primary flag first so the one-primary unique index never sees
  // two primaries mid-update.
  await tx.update(productImages).set({ isPrimary: false }).where(eq(productImages.productId, productId));

  const removed: string[] = [];
  for (const row of existing) {
    if (!keptUrls.has(row.url)) {
      await tx.delete(productImages).where(eq(productImages.id, row.id));
      removed.push(row.url);
    }
  }

  for (const [displayOrder, image] of normalized.entries()) {
    const match = existing.find((row) => row.url === image.url);
    if (match) {
      await tx
        .update(productImages)
        .set({ displayOrder, isPrimary: image.isPrimary, updatedAt: now })
        .where(eq(productImages.id, match.id));
    } else {
      await tx.insert(productImages).values({ productId, url: image.url, displayOrder, isPrimary: image.isPrimary });
    }
  }
  return removed;
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
    const rows = await db.select(productColumns).from(products).orderBy(products.name);
    return rows.map(toProduct);
  },

  async getById(id: number) {
    const product = await getProduct(id);
    if (!product) return null;
    const images = await db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, id))
      .orderBy(asc(productImages.displayOrder));
    return { ...product, images: images.map(toProductImage) };
  },

  async findByDistributorCode(code: string) {
    const normalized = code.trim().toLowerCase();
    const [row] = await db
      .select(productColumns)
      .from(products)
      .where(sql`lower(${products.distributorCode}) = ${normalized}`);
    return row ? toProduct(row) : null;
  },

  async create(data: CreateProductInput, images?: ImageDraft[]) {
    const sku = await generateSku(data.categoryId);
    const id = await db.transaction(async (tx) => {
      // Inserted with stock 0 regardless of `data.stock` — the server's
      // upsertProduct handler never takes stock from the phone (CLAUDE.md,
      // "Fase 10": it's always derived from movements, never a raw field).
      // A nonzero initial stock gets its own "ajuste" movement right below
      // instead, so it has a real ledger entry the server actually accepts.
      const [row] = await tx
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
          stock: 0,
          minStock: data.minStock ?? 0,
          warrantyMonths: data.warrantyMonths ?? null,
          active: data.active ?? true,
        })
        .returning();
      if (images) await replaceImages(tx, row.id, images);
      await enqueueOperation(tx, "upsertProduct", await buildUpsertProductPayload(tx, row));

      if (data.stock && data.stock > 0) {
        const { productUuid, movementUuid, movementCreatedAt } = await recordProductMovement(tx, {
          productId: row.id,
          quantityDelta: data.stock,
          type: "ajuste",
          reason: "Stock inicial",
          sourceType: "manual",
        });
        await enqueueOperation(tx, "createInventoryAdjustment", {
          uuid: movementUuid,
          productUuid,
          quantityDelta: data.stock,
          reason: "Stock inicial",
          occurredAt: movementCreatedAt,
        });
      }

      return row.id;
    });
    return (await getProduct(id))!;
  },

  async update(id: number, data: UpdateProductInput, images?: ImageDraft[]) {
    const removedUrls = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(products)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(products.id, id))
        .returning();
      if (!row) throw new Error("Producto no encontrado");
      const removed = images ? await replaceImages(tx, id, images) : [];
      await enqueueOperation(tx, "upsertProduct", await buildUpsertProductPayload(tx, row));
      return removed;
    });
    // Only after commit: a rolled-back save must not lose the photo files.
    removedUrls.forEach(deleteProductImageFile);
    return (await getProduct(id))!;
  },

  async deactivate(id: number) {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(products)
        .set({ active: false, updatedAt: new Date().toISOString() })
        .where(eq(products.id, id))
        .returning();
      if (row) await enqueueOperation(tx, "upsertProduct", await buildUpsertProductPayload(tx, row));
    });
  },
};
