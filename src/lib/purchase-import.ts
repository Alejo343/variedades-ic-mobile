import { toSlug } from "./validations";

// Fixed column layout the user's Excel always uses (no header-name detection):
// A=código (unused, provider's own code doesn't map to our SKU), B=nombre,
// C=cantidad, D=valor unitario, E=total (unused, quantity*unitCost is recomputed).
const COL_NAME = 1;
const COL_QUANTITY = 2;
const COL_UNIT_COST = 3;

export type ParsedImportRow = {
  rowNumber: number;
  name: string;
  quantity: number;
  unitCost: number;
};

export type SkippedImportRow = {
  rowNumber: number;
  reason: string;
};

export type ImportParseResult = {
  rows: ParsedImportRow[];
  skipped: SkippedImportRow[];
};

export function parseCOPNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value) : null;
  }
  if (typeof value === "string") {
    const digits = value.replace(/[^0-9]/g, "");
    return digits ? parseInt(digits, 10) : null;
  }
  return null;
}

// Row 1 is always the sheet's header ("Código", "Nombre", ...) and is skipped
// silently. Any other row that fails to parse is reported in `skipped` instead
// of being dropped without explanation (e.g. a trailing "TOTAL" summary row).
export function parseImportSheet(sheetRows: unknown[][]): ImportParseResult {
  const rows: ParsedImportRow[] = [];
  const skipped: SkippedImportRow[] = [];

  sheetRows.forEach((row, index) => {
    const rowNumber = index + 1;
    const rawName = row[COL_NAME];
    const name = typeof rawName === "string" ? rawName.trim() : rawName != null ? String(rawName).trim() : "";
    const quantity = parseCOPNumber(row[COL_QUANTITY]);
    const unitCost = parseCOPNumber(row[COL_UNIT_COST]);
    const valid = name.length > 0 && quantity !== null && quantity > 0 && unitCost !== null && unitCost >= 0;

    if (!valid) {
      if (index === 0) return;
      skipped.push({ rowNumber, reason: name.length === 0 ? "sin nombre de producto" : "cantidad o valor inválido" });
      return;
    }

    rows.push({ rowNumber, name, quantity, unitCost });
  });

  return { rows, skipped };
}

export type ExistingProductLookup = { id: number; name: string; sku: string; slug: string };

export type ResolvedImportRow =
  | { kind: "existing"; productId: number; sku: string; name: string; quantity: number; unitCost: number }
  | { kind: "new"; name: string; slug: string; quantity: number; unitCost: number };

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function uniqueSlug(base: string, used: Set<string>): string {
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

// Matches each row against existing products by normalized name (the
// provider's código in column A never matches our auto-generated SKU, so
// name is the only usable key). Rows with no match become "new" entries with
// a slug that's already guaranteed unique against both existing products and
// other new rows in the same file. Rows that resolve to the same product
// (existing or new) are merged, summing quantity and keeping the first
// row's unitCost — same merge behavior as adding a product twice from the
// cart's product picker.
export function resolveImportRows(rows: ParsedImportRow[], existingProducts: ExistingProductLookup[]): ResolvedImportRow[] {
  const byName = new Map<string, ExistingProductLookup>();
  for (const product of existingProducts) {
    byName.set(normalizeName(product.name), product);
  }

  const usedSlugs = new Set(existingProducts.map((p) => p.slug));
  const resolved: ResolvedImportRow[] = [];
  const indexByKey = new Map<string, number>();

  for (const row of rows) {
    const key = normalizeName(row.name);
    const existingIndex = indexByKey.get(key);
    if (existingIndex !== undefined) {
      resolved[existingIndex] = { ...resolved[existingIndex], quantity: resolved[existingIndex].quantity + row.quantity };
      continue;
    }

    const match = byName.get(key);
    if (match) {
      resolved.push({ kind: "existing", productId: match.id, sku: match.sku, name: match.name, quantity: row.quantity, unitCost: row.unitCost });
    } else {
      const slug = uniqueSlug(toSlug(row.name), usedSlugs);
      usedSlugs.add(slug);
      resolved.push({ kind: "new", name: row.name, slug, quantity: row.quantity, unitCost: row.unitCost });
    }
    indexByKey.set(key, resolved.length - 1);
  }

  return resolved;
}
