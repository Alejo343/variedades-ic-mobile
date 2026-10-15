import { parseCommissionPercent } from "./domain/commission";
import { toSlug } from "./validations";

// Fixed column layout the user's Excel always uses (no header-name detection):
// A=código (unused, provider's own code doesn't map to our SKU), B=nombre,
// C=cantidad, D=valor unitario, E=total (unused, quantity*unitCost is recomputed),
// F=% de comisión del vendedor — added by the owner, only needed (and only
// used) for products the import creates; an existing product keeps its own.
const COL_NAME = 1;
const COL_QUANTITY = 2;
const COL_UNIT_COST = 3;
const COL_COMMISSION = 5;

export type ParsedImportRow = {
  rowNumber: number;
  name: string;
  quantity: number;
  unitCost: number;
  /** Column F in basis points; null when empty or not a valid percentage. */
  commissionBps: number | null;
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

    rows.push({ rowNumber, name, quantity, unitCost, commissionBps: parseCommissionPercent(row[COL_COMMISSION]) });
  });

  return { rows, skipped };
}

export type ExistingProductLookup = { id: number; name: string; sku: string; slug: string };

export type ResolvedImportRow =
  | { kind: "existing"; productId: number; sku: string; name: string; quantity: number; unitCost: number }
  | { kind: "new"; name: string; slug: string; quantity: number; unitCost: number; commissionBps: number | null };

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
// cart's product picker. A merged new product takes the first commission any
// of its rows gives.
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
      const merged = resolved[existingIndex];
      resolved[existingIndex] =
        merged.kind === "new"
          ? { ...merged, quantity: merged.quantity + row.quantity, commissionBps: merged.commissionBps ?? row.commissionBps }
          : { ...merged, quantity: merged.quantity + row.quantity };
      continue;
    }

    const match = byName.get(key);
    if (match) {
      resolved.push({ kind: "existing", productId: match.id, sku: match.sku, name: match.name, quantity: row.quantity, unitCost: row.unitCost });
    } else {
      const slug = uniqueSlug(toSlug(row.name), usedSlugs);
      usedSlugs.add(slug);
      resolved.push({ kind: "new", name: row.name, slug, quantity: row.quantity, unitCost: row.unitCost, commissionBps: row.commissionBps });
    }
    indexByKey.set(key, resolved.length - 1);
  }

  return resolved;
}

// Every product needs its commission, and the import creates the new ones
// without asking: if any of them has no valid % in column F, nothing may be
// imported (the caller shows these names).
export function newProductsMissingCommission(resolved: ResolvedImportRow[]): string[] {
  return resolved.filter((r) => r.kind === "new" && r.commissionBps === null).map((r) => r.name);
}

export type NewProductPlan =
  | { ok: true; name: string; slug: string }
  | { ok: false; reason: "empty" }
  | { ok: false; reason: "duplicate"; existingId: number; existingName: string };

// A product created on the fly from "Nuevo pedido": same rules as the Excel
// import above — a name that normalizes to an existing product's is that
// product (so the screen offers to add it instead of duplicating it), and the
// slug is made unique against every existing one.
export function planNewProduct(rawName: string, existingProducts: ExistingProductLookup[]): NewProductPlan {
  const name = rawName.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, reason: "empty" };
  const match = existingProducts.find((p) => normalizeName(p.name) === normalizeName(name));
  if (match) return { ok: false, reason: "duplicate", existingId: match.id, existingName: match.name };
  return { ok: true, name, slug: uniqueSlug(toSlug(name), new Set(existingProducts.map((p) => p.slug))) };
}
