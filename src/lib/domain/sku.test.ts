import { describe, expect, it } from "vitest";
import { formatSku, getSkuPrefix } from "./sku";

describe("getSkuPrefix", () => {
  it("toma las primeras 4 letras de la categoría, en mayúsculas y sin tildes", () => {
    expect(getSkuPrefix("Tecnología")).toBe("TECN");
  });

  it("usa el prefijo genérico cuando no hay categoría", () => {
    expect(getSkuPrefix(null)).toBe("GEN");
    expect(getSkuPrefix(undefined)).toBe("GEN");
    expect(getSkuPrefix("   ")).toBe("GEN");
  });

  it("conserva prefijos más cortos que 4 letras", () => {
    expect(getSkuPrefix("TV")).toBe("TV");
  });
});

describe("formatSku", () => {
  it("combina prefijo y secuencia con relleno de ceros a 5 dígitos", () => {
    expect(formatSku("ELEC", 1)).toBe("ELEC-00001");
  });

  it("rellena secuencias intermedias", () => {
    expect(formatSku("GEN", 42)).toBe("GEN-00042");
  });

  it("no trunca secuencias que superan 5 dígitos", () => {
    expect(formatSku("GEN", 100000)).toBe("GEN-100000");
  });
});
