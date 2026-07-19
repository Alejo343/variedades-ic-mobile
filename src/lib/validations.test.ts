import { describe, expect, it } from "vitest";
import { toSlug } from "./validations";

describe("toSlug", () => {
  it("convierte a minúsculas", () => {
    expect(toSlug("Auriculares")).toBe("auriculares");
  });

  it("reemplaza espacios por guiones", () => {
    expect(toSlug("Crema Facial Hidratante")).toBe("crema-facial-hidratante");
  });

  it("colapsa espacios múltiples en un solo guion", () => {
    expect(toSlug("Set  de   Belleza")).toBe("set-de-belleza");
  });

  it("quita acentos", () => {
    expect(toSlug("Cámara Réflex")).toBe("camara-reflex");
  });

  it("quita caracteres especiales", () => {
    expect(toSlug("Audífonos (Bluetooth) 5.0!")).toBe("audifonos-bluetooth-50");
  });

  it("recorta espacios al inicio y al final", () => {
    expect(toSlug("  Producto  ")).toBe("producto");
  });

  it("devuelve string vacío para entrada vacía", () => {
    expect(toSlug("")).toBe("");
  });
});
