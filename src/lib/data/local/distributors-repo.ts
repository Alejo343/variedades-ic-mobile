import { eq } from "drizzle-orm";
import { enqueueOperation } from "../../sync/outbox";
import type { CreateDistributorInput, Distributor, DistributorsRepo, UpdateDistributorInput } from "../distributors-repo";
import { db } from "./db";
import { distributors } from "./schema";

function toDistributor(row: typeof distributors.$inferSelect): Distributor {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    phone: row.phone,
    notes: row.notes,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// See categories-repo.ts#toUpsertPayload — same "whole row, last write wins" contract.
function toUpsertPayload(row: typeof distributors.$inferSelect) {
  return { uuid: row.uuid, name: row.name, city: row.city, phone: row.phone, notes: row.notes, active: row.active };
}

export const localDistributorsRepo: DistributorsRepo = {
  async list() {
    const rows = await db.select().from(distributors).orderBy(distributors.name);
    return rows.map(toDistributor);
  },

  async getById(id: number) {
    const row = await db.query.distributors.findFirst({ where: eq(distributors.id, id) });
    return row ? toDistributor(row) : null;
  },

  async create(data: CreateDistributorInput) {
    return db.transaction(async (tx) => {
      const [row] = await tx
        .insert(distributors)
        .values({
          name: data.name,
          city: data.city ?? null,
          phone: data.phone ?? null,
          notes: data.notes ?? null,
          active: data.active ?? true,
        })
        .returning();
      await enqueueOperation(tx, "upsertDistributor", toUpsertPayload(row));
      return toDistributor(row);
    });
  },

  async update(id: number, data: UpdateDistributorInput) {
    return db.transaction(async (tx) => {
      const [row] = await tx
        .update(distributors)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(distributors.id, id))
        .returning();
      if (!row) throw new Error("Distribuidor no encontrado");
      await enqueueOperation(tx, "upsertDistributor", toUpsertPayload(row));
      return toDistributor(row);
    });
  },

  async deactivate(id: number) {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(distributors)
        .set({ active: false, updatedAt: new Date().toISOString() })
        .where(eq(distributors.id, id))
        .returning();
      if (row) await enqueueOperation(tx, "upsertDistributor", toUpsertPayload(row));
    });
  },
};
