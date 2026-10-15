import { describe, expect, it } from "vitest";
import { newProductsMissingCommission, parseCOPNumber, parseImportSheet, planNewProduct, resolveImportRows } from "./purchase-import";

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
      { rowNumber: 2, name: "Audifonos Bluetooth", quantity: 5, unitCost: 12000, commissionBps: null },
      { rowNumber: 3, name: "Mouse Inalambrico", quantity: 3, unitCost: 8500, commissionBps: null },
    ]);
  });

  it("lee el % de comisión de la columna F (vacío o inválido = null)", () => {
    const { rows, skipped } = parseImportSheet([
      ["Código", "Nombre", "Cantidad", "Valor", "Total", "Comisión"],
      ["P001", "A", 1, 1000, 1000, 15],
      ["P002", "B", 1, 1000, 1000, "12,5%"],
      ["P003", "C", 1, 1000, 1000, 0.1],
      ["P004", "D", 1, 1000, 1000, ""],
      ["P005", "E", 1, 1000, 1000, "mucha"],
    ]);
    expect(skipped).toEqual([]);
    expect(rows.map((r) => r.commissionBps)).toEqual([1500, 1250, 1000, null, null]);
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
    const resolved = resolveImportRows([{ rowNumber: 2, name: "audifonos bluetooth", quantity: 5, unitCost: 12000, commissionBps: 1500 }], existingProducts);
    expect(resolved).toEqual([{ kind: "existing", productId: 1, sku: "GEN-00001", name: "Audifonos Bluetooth", quantity: 5, unitCost: 12000 }]);
  });

  it("propone crear un producto nuevo cuando no hay coincidencia, con slug único", () => {
    const resolved = resolveImportRows([{ rowNumber: 3, name: "Mouse Inalambrico", quantity: 3, unitCost: 8500, commissionBps: 1500 }], existingProducts);
    expect(resolved).toEqual([{ kind: "new", name: "Mouse Inalambrico", slug: "mouse-inalambrico", quantity: 3, unitCost: 8500, commissionBps: 1500 }]);
  });

  it("suma cantidades cuando el mismo producto aparece en más de una fila", () => {
    const resolved = resolveImportRows(
      [
        { rowNumber: 3, name: "Mouse Inalambrico", quantity: 3, unitCost: 8500, commissionBps: null },
        { rowNumber: 5, name: "Mouse Inalambrico", quantity: 2, unitCost: 9000, commissionBps: 1000 },
      ],
      existingProducts,
    );
    // The first row's cost; the first commission any of its rows gives.
    expect(resolved).toEqual([{ kind: "new", name: "Mouse Inalambrico", slug: "mouse-inalambrico", quantity: 5, unitCost: 8500, commissionBps: 1000 }]);
  });

  it("evita colisión de slug con un producto existente cuyo slug ya está tomado", () => {
    const resolved = resolveImportRows(
      [{ rowNumber: 2, name: "Mouse Inalámbrico!!", quantity: 1, unitCost: 9000, commissionBps: 0 }],
      [{ id: 2, name: "Otro Producto", sku: "GEN-00002", slug: "mouse-inalambrico" }],
    );
    expect(resolved).toEqual([{ kind: "new", name: "Mouse Inalámbrico!!", slug: "mouse-inalambrico-2", quantity: 1, unitCost: 9000, commissionBps: 0 }]);
  });
});

describe("newProductsMissingCommission", () => {
  it("lista los productos nuevos sin % de comisión; los existentes no la necesitan", () => {
    const resolved = resolveImportRows(
      [
        { rowNumber: 2, name: "Audifonos Bluetooth", quantity: 1, unitCost: 1000, commissionBps: null },
        { rowNumber: 3, name: "Cable", quantity: 1, unitCost: 1000, commissionBps: null },
        { rowNumber: 4, name: "Mouse", quantity: 1, unitCost: 1000, commissionBps: 0 },
      ],
      [{ id: 1, name: "Audifonos Bluetooth", sku: "GEN-00001", slug: "audifonos-bluetooth" }],
    );
    expect(newProductsMissingCommission(resolved)).toEqual(["Cable"]);
  });
});

// Creating a product on the fly from "Nuevo pedido": same name rules as the
// Excel import, so the two never disagree about what counts as a duplicate.
describe('planNewProduct', () => {
  const existing = [
    { id: 1, name: 'Audífonos Bluetooth', sku: 'GEN-00001', slug: 'audifonos-bluetooth' },
    { id: 2, name: 'Cargador', sku: 'GEN-00002', slug: 'cargador' },
    { id: 3, name: 'Cargador USB', sku: 'GEN-00003', slug: 'cargador-2' },
  ];

  it('da un slug libre para un nombre nuevo', () => {
    expect(planNewProduct('Parlante Mini', existing)).toEqual({ ok: true, name: 'Parlante Mini', slug: 'parlante-mini' });
  });

  it('trata espacios de más como el mismo nombre y evita slugs ocupados', () => {
    expect(planNewProduct('Cargador  ', existing)).toEqual({ ok: false, reason: 'duplicate', existingId: 2, existingName: 'Cargador' });
    expect(planNewProduct('cargador nuevo', [...existing, { id: 4, name: 'X', sku: 'GEN-4', slug: 'cargador-nuevo' }])).toEqual({
      ok: true,
      name: 'cargador nuevo',
      slug: 'cargador-nuevo-2',
    });
  });

  it('reconoce un duplicado sin importar tildes ni mayúsculas', () => {
    expect(planNewProduct('  AUDIFONOS bluetooth ', existing)).toEqual({
      ok: false,
      reason: 'duplicate',
      existingId: 1,
      existingName: 'Audífonos Bluetooth',
    });
  });

  it('rechaza un nombre vacío', () => {
    expect(planNewProduct('   ', existing)).toEqual({ ok: false, reason: 'empty' });
  });
});
