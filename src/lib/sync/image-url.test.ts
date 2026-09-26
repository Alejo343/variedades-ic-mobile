import { describe, expect, it } from "vitest";
import { resolveImageUri } from "./image-url";

// Local product photos are stored the same shape the server pulls/pushes
// (sub-paso 13): a plain local file:// URI while unsynced, or the SAME
// relative path the server itself stores ("/uploads/products/x.webp") once
// uploaded — nothing rewrites it to an absolute URL at rest, only at render
// time, here.
describe("resolveImageUri", () => {
  it("deja intacta una foto local todavía no subida", () => {
    expect(resolveImageUri("file:///data/user/0/app/files/product-1.jpg")).toBe("file:///data/user/0/app/files/product-1.jpg");
  });

  it("le agrega el dominio del servidor a una ruta relativa ya subida", () => {
    expect(resolveImageUri("/uploads/products/abc.webp")).toBe("https://icvariedades.com/uploads/products/abc.webp");
  });

  it("deja intacta una url que ya viene absoluta", () => {
    expect(resolveImageUri("https://otrodominio.com/x.webp")).toBe("https://otrodominio.com/x.webp");
  });
});
