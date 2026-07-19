import { eq } from "drizzle-orm";
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
    const [row] = await db
      .insert(categories)
      .values({
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        active: data.active ?? true,
      })
      .returning();
    return toCategory(row);
  },

  async update(id: number, data: UpdateCategoryInput) {
    const [row] = await db
      .update(categories)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(categories.id, id))
      .returning();
    if (!row) throw new Error("Categoría no encontrada");
    return toCategory(row);
  },

  async deactivate(id: number) {
    await db
      .update(categories)
      .set({ active: false, updatedAt: new Date().toISOString() })
      .where(eq(categories.id, id));
  },
};
