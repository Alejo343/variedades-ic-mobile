import { describe, expect, it, vi } from "vitest";
import { createMigratedTestDb } from "../data/local/test-db";

// uploadPendingProductPhotos (sub-paso 13) uploads every product_images row
// still pointing at a local file:// URI, then — only once ALL of a given
// product's photos are done — enqueues a fresh upsertProduct that finally
// carries `images` (buildUpsertProductPayload picks it up automatically,
// since by then the gallery has nothing local left in it).

const { raw, db: proxy } = createMigratedTestDb();
vi.mock("../data/local/db", () => ({ get db() { return proxy; } }));
// products-repo.ts (imported for buildUpsertProductPayload) pulls in
// lib/images.ts, which imports expo-image-picker — unmockable native code
// this test never exercises. Same stub already used by products-repo.test.ts
// and outbox-wiring.test.ts (there, at local/, one directory further away
// from src/lib than this file, so the relative path differs).
vi.mock("../images", () => ({ deleteProductImageFile: () => {} }));

const uploadMock = vi.fn();
vi.mock("expo-file-system", () => ({
  File: class {
    uri: string;
    constructor(uri: string) { this.uri = uri; }
    get extension() { return "." + this.uri.split(".").pop(); }
    upload(...args: unknown[]) { return uploadMock(this.uri, ...args); }
  },
  UploadType: { MULTIPART: 1 },
}));

const one = (sql: string) => raw.prepare(sql).get() as Record<string, unknown>;
const outboxPayloads = () => (raw.prepare("SELECT payload FROM sync_outbox WHERE type = 'upsertProduct' ORDER BY id").all() as { payload: string }[]).map((r) => JSON.parse(r.payload));

describe("uploadPendingProductPhotos", async () => {
  const { uploadPendingProductPhotos } = await import("./photo-upload");

  it("sube cada foto local, guarda la ruta relativa del servidor y encola upsertProduct con la galería completa", async () => {
    raw.exec(`
      INSERT INTO products (uuid, name, slug, sku, price, stock) VALUES ('p1', 'Audifonos', 'audifonos', 'GEN-1', 5000, 1);
      INSERT INTO product_images (uuid, product_id, url, display_order, is_primary) VALUES
        ('img-1', 1, 'file:///a.jpg', 0, 1),
        ('img-2', 1, 'file:///b.png', 1, 0);
    `);
    uploadMock
      .mockResolvedValueOnce({ status: 201, body: JSON.stringify({ url: "/uploads/products/a.webp" }) })
      .mockResolvedValueOnce({ status: 201, body: JSON.stringify({ url: "/uploads/products/b.webp" }) });

    const summary = await uploadPendingProductPhotos("tok");
    expect(summary).toEqual({ uploaded: 2, productsSynced: 1 });

    expect(one("SELECT url FROM product_images WHERE uuid = 'img-1'")).toEqual({ url: "/uploads/products/a.webp" });
    expect(one("SELECT url FROM product_images WHERE uuid = 'img-2'")).toEqual({ url: "/uploads/products/b.webp" });

    const payloads = outboxPayloads();
    expect(payloads).toHaveLength(1);
    expect(payloads[0].images).toEqual([
      { uuid: "img-1", url: "/uploads/products/a.webp", alt: null, displayOrder: 0, isPrimary: true },
      { uuid: "img-2", url: "/uploads/products/b.webp", alt: null, displayOrder: 1, isPrimary: false },
    ]);

    expect(uploadMock).toHaveBeenNthCalledWith(1, "file:///a.jpg", expect.stringContaining("/api/sync/upload"), expect.objectContaining({
      httpMethod: "POST", mimeType: "image/jpeg", headers: { Authorization: "Bearer tok" },
    }));
    expect(uploadMock).toHaveBeenNthCalledWith(2, "file:///b.png", expect.anything(), expect.objectContaining({ mimeType: "image/png" }));
  });

  it("nada pendiente no hace ninguna llamada", async () => {
    uploadMock.mockClear();
    const summary = await uploadPendingProductPhotos("tok");
    expect(summary).toEqual({ uploaded: 0, productsSynced: 0 });
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("una foto que falla detiene ese producto sin encolar nada, pero conserva lo ya subido", async () => {
    raw.exec(`
      INSERT INTO products (uuid, name, slug, sku, price, stock) VALUES ('p2', 'Cable', 'cable', 'GEN-2', 3000, 1);
      INSERT INTO product_images (uuid, product_id, url, display_order, is_primary) VALUES
        ('img-3', 2, 'file:///c.jpg', 0, 1),
        ('img-4', 2, 'file:///d.jpg', 1, 0);
    `);
    uploadMock.mockClear();
    uploadMock
      .mockResolvedValueOnce({ status: 201, body: JSON.stringify({ url: "/uploads/products/c.webp" }) })
      .mockResolvedValueOnce({ status: 500, body: JSON.stringify({ error: "El archivo supera 10MB" }) });

    const before = outboxPayloads().length;
    const summary = await uploadPendingProductPhotos("tok");
    expect(summary.uploaded).toBe(1);
    expect(summary.error).toMatch(/10MB/);
    expect(one("SELECT url FROM product_images WHERE uuid = 'img-3'")).toEqual({ url: "/uploads/products/c.webp" });
    expect(one("SELECT url FROM product_images WHERE uuid = 'img-4'")).toEqual({ url: "file:///d.jpg" });
    expect(outboxPayloads()).toHaveLength(before); // sin encolar todavía — falta img-4
  });
});
