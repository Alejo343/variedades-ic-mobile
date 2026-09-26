import { describe, expect, it, vi } from "vitest";
import { createMigratedTestDb } from "./test-db";

// Runs the real repo against an in-memory SQLite with every migration applied
// (see test-db.ts). Seeds a product with the old image_uri right before 0013
// to cover the backfill too. Caught a real bug: the primaryImageUri subquery
// correlating against the wrong table's "id".

const deleted: string[] = [];
const { db: proxy } = createMigratedTestDb({
  "0013": "INSERT INTO products (name, slug, sku, price, image_uri) VALUES ('Viejo','viejo','GEN-00001',1,'file:///old.jpg')",
});

vi.mock("./db", () => ({ get db() { return proxy; } }));
vi.mock("../../images", () => ({ deleteProductImageFile: (u: string) => deleted.push(u) }));

describe("localProductsRepo + product_images", async () => {
  const { localProductsRepo: repo } = await import("./products-repo");
  const { localInventoryRepo } = await import("./inventory-repo");

  it("la foto migrada quedó como principal", async () => {
    const p = await repo.getById(1);
    expect(p?.primaryImageUri).toBe("file:///old.jpg");
    expect(p?.images.map((i) => [i.url, i.isPrimary, i.displayOrder])).toEqual([["file:///old.jpg", true, 0]]);
  });

  it("crear con varias fotos normaliza y list() trae la principal", async () => {
    const created = await repo.create({ name: "Nuevo", slug: "nuevo", price: 10 } as never, [
      { url: "a", isPrimary: false }, { url: "b", isPrimary: true }, { url: "c", isPrimary: false },
    ]);
    expect(created.primaryImageUri).toBe("b");
    const list = await repo.list();
    expect(list.find((p) => p.id === created.id)?.primaryImageUri).toBe("b");
  });

  it("editar: cambiar principal, reordenar, quitar y agregar; conserva ids y borra solo archivos quitados", async () => {
    const before = (await repo.getById(2))!;
    const idOfC = before.images.find((i) => i.url === "c")!.id;
    await repo.update(2, {}, [{ url: "c", isPrimary: true }, { url: "a", isPrimary: false }, { url: "d", isPrimary: false }]);
    const after = (await repo.getById(2))!;
    expect(after.images.map((i) => [i.url, i.isPrimary, i.displayOrder])).toEqual([["c", true, 0], ["a", false, 1], ["d", false, 2]]);
    expect(after.images.find((i) => i.url === "c")!.id).toBe(idOfC);
    expect(after.primaryImageUri).toBe("c");
    expect(deleted).toEqual(["b"]);
  });

  it("update sin images no toca la galería; con [] la vacía", async () => {
    await repo.update(2, { price: 20 });
    expect((await repo.getById(2))!.images).toHaveLength(3);
    await repo.update(2, {}, []);
    const p = (await repo.getById(2))!;
    expect(p.images).toEqual([]);
    expect(p.primaryImageUri).toBeNull();
  });

  it("inventory-repo devuelve primaryImageUri con el mapeo compartido", async () => {
    const out = await localInventoryRepo.getOutOfStock();
    expect(out.find((p) => p.id === 1)?.primaryImageUri).toBe("file:///old.jpg");
  });
});
