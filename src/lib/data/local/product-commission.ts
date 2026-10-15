import { eq } from "drizzle-orm";
import type { Tx } from "./db";
import { products } from "./schema";

// A sold product's commission percentage, for a sale's local commission
// estimate (seller-sales-repo, direct-sales-repo). The server recomputes it
// from its own copy of the product, and the next pull replaces the estimate.
// Its own file so those repos don't pull in products-repo (and with it the
// photo-file code, which needs the native modules).
export async function productCommissionBps(tx: Tx, productId: number): Promise<number> {
  const [row] = await tx.select({ commissionBps: products.commissionBps }).from(products).where(eq(products.id, productId));
  return row?.commissionBps ?? 0;
}
