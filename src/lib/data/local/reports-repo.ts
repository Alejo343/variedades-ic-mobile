import { and, eq, ne, sql, type AnyColumn, type SQL } from "drizzle-orm";
import type {
  InventorySummary,
  ProfitReport,
  PurchasesReport,
  ReportsRepo,
  SalesReport,
} from "../reports-repo";
import { endOfLocalDayUtc, startOfLocalDayUtc } from "../../format";
import { db } from "./db";
import { directSaleItems, directSales, products, purchaseOrders, sellerSaleItems, sellerSales } from "./schema";

// from/to are LOCAL calendar days 'YYYY-MM-DD' (inclusive); the columns are
// UTC text, so both ends become UTC instants (format.ts) instead of DATE(col),
// which would push evening sales into the next day.
function dateRangeCondition(column: AnyColumn, from?: string, to?: string): SQL | undefined {
  const conditions: SQL[] = [];
  if (from) conditions.push(sql`${column} >= ${startOfLocalDayUtc(from)}`);
  if (to) conditions.push(sql`${column} < ${endOfLocalDayUtc(to)}`);
  if (conditions.length === 0) return undefined;
  return and(...conditions);
}

export const localReportsRepo: ReportsRepo = {
  async getInventorySummary(): Promise<InventorySummary> {
    const [row] = await db
      .select({
        activeProducts: sql<number>`COUNT(*)`,
        totalUnits: sql<number>`COALESCE(SUM(${products.stock}), 0)`,
        totalValue: sql<number>`COALESCE(SUM(${products.stock} * ${products.purchasePrice}), 0)`,
      })
      .from(products)
      .where(eq(products.active, true));
    return row ?? { activeProducts: 0, totalUnits: 0, totalValue: 0 };
  },

  async getPurchasesReport(from?: string, to?: string): Promise<PurchasesReport> {
    const dateCond = dateRangeCondition(purchaseOrders.orderDate, from, to);
    const where = dateCond ? and(ne(purchaseOrders.status, "cancelado"), dateCond) : ne(purchaseOrders.status, "cancelado");

    const rows = await db
      .select({
        distributorId: purchaseOrders.distributorId,
        count: sql<number>`COUNT(*)`,
        total: sql<number>`COALESCE(SUM(${purchaseOrders.totalCost}), 0)`,
      })
      .from(purchaseOrders)
      .where(where)
      .groupBy(purchaseOrders.distributorId);

    return {
      totalCount: rows.reduce((s, r) => s + r.count, 0),
      totalAmount: rows.reduce((s, r) => s + r.total, 0),
      byDistributor: rows,
    };
  },

  async getSalesReport(from?: string, to?: string): Promise<SalesReport> {
    const localCond = dateRangeCondition(directSales.saleDate, from, to);
    const sellerCond = dateRangeCondition(sellerSales.saleDate, from, to);

    const [[local], [seller], localByAccount] = await Promise.all([
      db
        .select({
          count: sql<number>`COUNT(*)`,
          total: sql<number>`COALESCE(SUM(${directSales.totalAmount}), 0)`,
          commission: sql<number>`COALESCE(SUM(${directSales.commissionAmount}), 0)`,
        })
        .from(directSales)
        .where(localCond),
      db
        .select({ count: sql<number>`COUNT(*)`, total: sql<number>`COALESCE(SUM(${sellerSales.totalAmount}), 0)` })
        .from(sellerSales)
        .where(sellerCond),
      db
        .select({
          accountId: directSales.accountId,
          count: sql<number>`COUNT(*)`,
          total: sql<number>`COALESCE(SUM(${directSales.totalAmount}), 0)`,
        })
        .from(directSales)
        .where(localCond)
        .groupBy(directSales.accountId),
    ]);

    const byChannel = {
      local: { count: local?.count ?? 0, total: local?.total ?? 0 },
      seller: { count: seller?.count ?? 0, total: seller?.total ?? 0 },
    };

    return {
      totalCount: byChannel.local.count + byChannel.seller.count,
      totalAmount: byChannel.local.total + byChannel.seller.total,
      byChannel,
      localByAccount,
      storeSellerCommission: local?.commission ?? 0,
    };
  },

  async getProfitReport(from?: string, to?: string): Promise<ProfitReport> {
    const localCond = dateRangeCondition(directSales.saleDate, from, to);
    const sellerCond = dateRangeCondition(sellerSales.saleDate, from, to);

    const [sales, [localRow], [sellerRow]] = await Promise.all([
      localReportsRepo.getSalesReport(from, to),
      db
        .select({ cogs: sql<number>`COALESCE(SUM(${directSaleItems.quantity} * ${products.purchasePrice}), 0)` })
        .from(directSaleItems)
        .innerJoin(directSales, eq(directSaleItems.saleId, directSales.id))
        .innerJoin(products, eq(directSaleItems.productId, products.id))
        .where(localCond),
      db
        .select({ cogs: sql<number>`COALESCE(SUM(${sellerSaleItems.quantity} * ${products.purchasePrice}), 0)` })
        .from(sellerSaleItems)
        .innerJoin(sellerSales, eq(sellerSaleItems.saleId, sellerSales.id))
        .innerJoin(products, eq(sellerSaleItems.productId, products.id))
        .where(sellerCond),
    ]);

    const cogs = (localRow?.cogs ?? 0) + (sellerRow?.cogs ?? 0);
    return { revenue: sales.totalAmount, cogs, profit: sales.totalAmount - cogs };
  },
};
