import { describe, expect, it } from "vitest";
import { parseCOPNumber, parseImportSheet, resolveImportRows } from "./purchase-import";

describe("parseCOPNumber", () => {
  it("redondea un número tal cual", () => {
    expect(parseCOPNumber(12000)).toBe(12000);
  });

  it("parsea un string con separador de miles", () => {
    expect(parseCOPNumber("8.500")).toBe(8500);
  });

  it("devuelve null para texto sin dígitos", () => {
    expect(parseCOPNumber("N/A")).toBeNull();
  });

  it("devuelve null para vacío o indefinido", () => {
    expect(parseCOPNumber("")).toBeNull();
    expect(parseCOPNumber(undefined)).toBeNull();
  });
});

describe("parseImportSheet", () => {
  const sheet: unknown[][] = [
    ["Código", "Nombre", "Cantidad", "Valor", "Total"],
    ["P001", "Audifonos Bluetooth", 5, 12000, 60000],
    ["P002", "Mouse Inalambrico", "3", "8.500", "25.500"],
    ["", "TOTAL", "", "", "85500"],
  ];

  it("lee las filas válidas por posición de columna (B, C, D)", () => {
    const { rows } = parseImportSheet(sheet);
    expect(rows).toEqual([
      { rowNumber: 2, name: "Audifonos Bluetooth", quantity: 5, unitCost: 12000 },
      { rowNumber: 3, name: "Mouse Inalambrico", quantity: 3, unitCost: 8500 },
    ]);
  });

  it("omite la fila de encabezado (fila 1) sin reportarla como error", () => {
    const { skipped } = parseImportSheet(sheet);
    expect(skipped.some((s) => s.rowNumber === 1)).toBe(false);
  });

  it("reporta filas inválidas después del encabezado (ej. fila de TOTAL)", () => {
    const { skipped } = parseImportSheet(sheet);
    expect(skipped).toEqual([{ rowNumber: 4, reason: "cantidad o valor inválido" }]);
  });
});

describe("resolveImportRows", () => {
  const existingProducts = [{ id: 1, name: "Audifonos Bluetooth", sku: "GEN-00001", slug: "audifonos-bluetooth" }];

  it("emparienta por nombre normalizado contra productos existentes", () => {
    const resolved = resolveImportRows([{ rowNumber: 2, name: "audifonos bluetooth", quantity: 5, unitCost: 12000 }], existingProducts);
    expect(resolved).toEqual([{ kind: "existing", productId: 1, sku: "GEN-00001", name: "Audifonos Bluetooth", quantity: 5, unitCost: 12000 }]);
  });

  it("propone crear un producto nuevo cuando no hay coincidencia, con slug único", () => {
    const resolved = resolveImportRows([{ rowNumber: 3, name: "Mouse Inalambrico", quantity: 3, unitCost: 8500 }], existingProducts);
    expect(resolved).toEqual([{ kind: "new", name: "Mouse Inalambrico", slug: "mouse-inalambrico", quantity: 3, unitCost: 8500 }]);
  });

  it("suma cantidades cuando el mismo producto aparece en más de una fila", () => {
    const resolved = resolveImportRows(
      [
        { rowNumber: 3, name: "Mouse Inalambrico", quantity: 3, unitCost: 8500 },
        { rowNumber: 5, name: "Mouse Inalambrico", quantity: 2, unitCost: 9000 },
      ],
      existingProducts,
    );
    expect(resolved).toEqual([{ kind: "new", name: "Mouse Inalambrico", slug: "mouse-inalambrico", quantity: 5, unitCost: 8500 }]);
  });

  it("evita colisión de slug con un producto existente cuyo slug ya está tomado", () => {
    const resolved = resolveImportRows(
      [{ rowNumber: 2, name: "Mouse Inalámbrico!!", quantity: 1, unitCost: 9000 }],
      [{ id: 2, name: "Otro Producto", sku: "GEN-00002", slug: "mouse-inalambrico" }],
    );
    expect(resolved).toEqual([{ kind: "new", name: "Mouse Inalámbrico!!", slug: "mouse-inalambrico-2", quantity: 1, unitCost: 9000 }]);
  });
});
