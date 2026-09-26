import { eq } from "drizzle-orm";
import { enqueueOperation } from "../../sync/outbox";
import type { CategoriesRepo, Category, CreateCategoryInput, UpdateCategoryInput } from "../categories-repo";
import { db } from "./db";
import { categories } from "./schema";

function toCategory(row: typeof categories.$inferSelect): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// upsertCategory carries the whole row: creating, editing and deactivating a
// category are all "the current state wins" as far as sync is concerned (see
// CLAUDE.md, "Fase 10", sub-paso 7 parte 3a) — the payload is the same shape
// every time, only the values change.
function toUpsertPayload(row: typeof categories.$inferSelect) {
  return { uuid: row.uuid, name: row.name, slug: row.slug, description: row.description, active: row.active };
}

export const localCategoriesRepo: CategoriesRepo = {
  async list() {
    const rows = await db.select().from(categories).orderBy(categories.name);
    return rows.map(toCategory);
  },

  async getById(id: number) {
    const row = await db.query.categories.findFirst({ where: eq(categories.id, id) });
    return row ? toCategory(row) : null;
  },

  async create(data: CreateCategoryInput) {
    return db.transaction(async (tx) => {
      const [row] = await tx
        .insert(categories)
        .values({
          name: data.name,
          slug: data.slug,
          description: data.description ?? null,
          active: data.active ?? true,
        })
        .returning();
      await enqueueOperation(tx, "upsertCategory", toUpsertPayload(row));
      return toCategory(row);
    });
  },

  async update(id: number, data: UpdateCategoryInput) {
    return db.transaction(async (tx) => {
      const [row] = await tx
        .update(categories)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(categories.id, id))
        .returning();
      if (!row) throw new Error("Categoría no encontrada");
      await enqueueOperation(tx, "upsertCategory", toUpsertPayload(row));
      return toCategory(row);
    });
  },

  async deactivate(id: number) {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(categories)
        .set({ active: false, updatedAt: new Date().toISOString() })
        .where(eq(categories.id, id))
        .returning();
      if (row) await enqueueOperation(tx, "upsertCategory", toUpsertPayload(row));
    });
  },
};
