import { Link } from 'expo-router';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  ChevronRight,
  Landmark,
  PackageX,
  RotateCcw,
  ShoppingCart,
  Store,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Truck,
  Users,
  Wallet,
  type LucideProps,
} from 'lucide-react-native';
import { useCallback, useState, type ComponentType, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useTheme } from '@/hooks/use-theme';
import {
  cashAccountsRepo,
  cashRepo,
  distributorsRepo,
  inventoryRepo,
  productsRepo,
  purchasePaymentsRepo,
  reportsRepo,
  sellerReturnsRepo,
  sellersRepo,
  sellerSalesRepo,
  type CashAccountWithBalance,
  type InventorySummary,
  type ProfitReport,
  type PurchasesReport,
  type SalesReport,
} from '@/lib/data';
import { formatCOP } from '@/lib/format';
import { formatRangeLabel, periodRange, REPORT_PERIODS, type ReportPeriod } from '@/lib/report-periods';

// Channel colors for the local-vs-sellers split. Fixed in both themes (not
// theme.primary): this pair passed the dataviz palette validator against both
// card surfaces, while dark mode's brighter #22C55E falls out of its band.
const CHANNEL_COLORS = { local: '#16A34A', seller: '#3B82F6' } as const;

type Tab = 'summary' | 'sales' | 'money' | 'inventory';

const TABS: { key: Tab; label: string }[] = [
  { key: 'summary', label: 'Resumen' },
  { key: 'sales', label: 'Ventas' },
  { key: 'money', label: 'Dinero' },
  { key: 'inventory', label: 'Inventario' },
];

type SellerStock = { sellerId: number; name: string; units: number; products: string[] };

type ReportsData = {
  inventory: InventorySummary;
  lowStockCount: number;
  outOfStockCount: number;
  purchases: PurchasesReport;
  sales: SalesReport;
  profit: ProfitReport;
  accountBalances: CashAccountWithBalance[];
  cashBalance: number;
  cashPeriod: { income: number; expense: number };
  cashPeriodByAccount: { accountId: number; income: number; expense: number }[];
  accountsPayable: { distributorId: number; pending: number }[];
  sellerStock: SellerStock[];
  sellerSales: { sellerId: number; count: number; totalAmount: number; totalCommission: number }[];
  returnedProducts: { productId: number; totalQuantity: number }[];
  names: {
    products: Record<number, string>;
    sellers: Record<number, string>;
    distributors: Record<number, string>;
    accounts: Record<number, string>;
  };
};

export default function ReportsScreen() {
  const [period, setPeriod] = useState<ReportPeriod>('thisMonth');
  const [tab, setTab] = useState<Tab>('summary');
  const [data, setData] = useState<ReportsData | null>(null);

  // Recomputed per render on purpose: "today" must roll over if the screen
  // stays open past midnight. Strings keep the effect deps stable.
  const range = periodRange(period, new Date());
  const from = range.from;
  const to = range.to;
  const rangeLabel = formatRangeLabel(range);

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;

      Promise.all([
        reportsRepo.getInventorySummary(),
        inventoryRepo.getLowStock(),
        inventoryRepo.getOutOfStock(),
        reportsRepo.getPurchasesReport(from, to),
        reportsRepo.getSalesReport(from, to),
        reportsRepo.getProfitReport(from, to),
        cashRepo.getBalance(),
        cashRepo.list(),
        cashAccountsRepo.listWithBalances(),
        purchasePaymentsRepo.getAccountsPayableSummary(),
        sellersRepo.getAllInventory(),
        sellerSalesRepo.getSummaryBySeller(),
        sellerReturnsRepo.getReturnedProductsSummary(),
        productsRepo.list(),
        sellersRepo.list(),
        distributorsRepo.list(),
      ]).then(
        ([
          inventory,
          lowStock,
          outOfStock,
          purchases,
          sales,
          profit,
          cashBalance,
          cashMovements,
          accountBalances,
          accountsPayable,
          sellerInventory,
          sellerSalesSummary,
          returnedProducts,
          products,
          sellers,
          distributors,
        ]) => {
          if (cancelled) return;

          const productNames: Record<number, string> = Object.fromEntries(products.map((p) => [p.id, p.name]));
          const sellerNames: Record<number, string> = Object.fromEntries(sellers.map((s) => [s.id, s.name]));

          const cashInRange = cashMovements.filter((m) => {
            const day = m.movementDate.slice(0, 10);
            if (from && day < from) return false;
            if (to && day > to) return false;
            return true;
          });
          const cashPeriod = { income: 0, expense: 0 };
          const byAccount = new Map<number, { income: number; expense: number }>();
          for (const m of cashInRange) {
            const bucket = byAccount.get(m.accountId) ?? { income: 0, expense: 0 };
            if (m.type === 'ingreso') {
              bucket.income += m.amount;
              cashPeriod.income += m.amount;
            } else {
              bucket.expense += m.amount;
              cashPeriod.expense += m.amount;
            }
            byAccount.set(m.accountId, bucket);
          }

          const stockBySeller = new Map<number, SellerStock>();
          for (const line of sellerInventory) {
            const entry = stockBySeller.get(line.sellerId) ?? {
              sellerId: line.sellerId,
              name: sellerNames[line.sellerId] ?? `Vendedor #${line.sellerId}`,
              units: 0,
              products: [],
            };
            entry.units += line.quantity;
            entry.products.push(`${productNames[line.productId] ?? `Producto #${line.productId}`} (${line.quantity})`);
            stockBySeller.set(line.sellerId, entry);
          }

          setData({
            inventory,
            lowStockCount: lowStock.length,
            outOfStockCount: outOfStock.length,
            purchases,
            sales,
            profit,
            accountBalances,
            cashBalance,
            cashPeriod,
            cashPeriodByAccount: [...byAccount.entries()]
              .map(([accountId, totals]) => ({ accountId, ...totals }))
              .sort((a, b) => b.income + b.expense - (a.income + a.expense)),
            accountsPayable: [...accountsPayable].sort((a, b) => b.pending - a.pending),
            sellerStock: [...stockBySeller.values()].sort((a, b) => b.units - a.units),
            sellerSales: [...sellerSalesSummary].sort((a, b) => b.totalAmount - a.totalAmount),
            returnedProducts: [...returnedProducts].sort((a, b) => b.totalQuantity - a.totalQuantity),
            names: {
              products: productNames,
              sellers: sellerNames,
              distributors: Object.fromEntries(distributors.map((d) => [d.id, d.name])),
              accounts: Object.fromEntries(accountBalances.map((a) => [a.id, a.name])),
            },
          });
        },
      );

      return () => {
        cancelled = true;
      };
    }, [from, to]),
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[1]}
        >
          <PeriodPicker period={period} onChange={setPeriod} rangeLabel={rangeLabel} />
          <TabBar tab={tab} onChange={setTab} />

          {!data ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.loading}>
              Cargando…
            </ThemedText>
          ) : tab === 'summary' ? (
            <SummaryTab data={data} rangeLabel={rangeLabel} onOpenTab={setTab} />
          ) : tab === 'sales' ? (
            <SalesTab data={data} rangeLabel={rangeLabel} />
          ) : tab === 'money' ? (
            <MoneyTab data={data} rangeLabel={rangeLabel} />
          ) : (
            <InventoryTab data={data} />
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

// ─── Controls ────────────────────────────────────────────────────────────────

function PeriodPicker({
  period,
  onChange,
  rangeLabel,
}: {
  period: ReportPeriod;
  onChange: (p: ReportPeriod) => void;
  rangeLabel: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.periodBlock}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {REPORT_PERIODS.map(({ key, label }) => {
          const active = key === period;
          return (
            <Pressable
              key={key}
              onPress={() => onChange(key)}
              style={[
                styles.chip,
                active
                  ? { backgroundColor: theme.primary, borderColor: theme.primary }
                  : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}
            >
              <ThemedText type="small" style={{ color: active ? '#FFFFFF' : theme.text }}>
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.rangeRow}>
        <CalendarDays color={theme.textSecondary} size={14} />
        <ThemedText type="caption" themeColor="textSecondary">
          {rangeLabel}
        </ThemedText>
      </View>
    </View>
  );
}

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const theme = useTheme();
  return (
    // Opaque background so content scrolling under the sticky bar stays hidden.
    <ThemedView style={styles.tabBarWrap}>
      <View style={[styles.tabBar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        {TABS.map(({ key, label }) => {
          const active = key === tab;
          return (
            <Pressable
              key={key}
              onPress={() => onChange(key)}
              style={[styles.tabButton, active && { backgroundColor: theme.primaryLight }]}
            >
              <ThemedText
                type={active ? 'smallBold' : 'small'}
                style={{ color: active ? theme.primary : theme.textSecondary }}
              >
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </ThemedView>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

function SummaryTab({
  data,
  rangeLabel,
  onOpenTab,
}: {
  data: ReportsData;
  rangeLabel: string;
  onOpenTab: (t: Tab) => void;
}) {
  const theme = useTheme();
  const { profit, sales, purchases, cashPeriod } = data;
  const margin = profit.revenue > 0 ? Math.round((profit.profit / profit.revenue) * 100) : null;
  const profitColor = profit.profit < 0 ? theme.error : theme.primary;
  const payable = data.accountsPayable.reduce((s, r) => s + r.pending, 0);
  const hasAlerts = data.outOfStockCount > 0 || data.lowStockCount > 0 || payable > 0;

  return (
    <View style={styles.tabContent}>
      <Card>
        <View style={styles.heroHeader}>
          <ThemedText type="secondary" themeColor="textSecondary">
            Utilidad bruta
          </ThemedText>
          {margin !== null ? (
            <View style={[styles.pill, { backgroundColor: withAlpha(profitColor, 0.12) }]}>
              {profit.profit < 0 ? (
                <TrendingDown color={profitColor} size={14} />
              ) : (
                <TrendingUp color={profitColor} size={14} />
              )}
              <ThemedText type="caption" style={{ color: profitColor }}>
                {margin}% margen
              </ThemedText>
            </View>
          ) : null}
        </View>
        <ThemedText type="bigNumber" style={{ color: profitColor }} adjustsFontSizeToFit numberOfLines={1}>
          {formatCOP(profit.profit)}
        </ThemedText>
        <ThemedText type="secondary" themeColor="textSecondary">
          {formatCOP(profit.revenue)} en ventas − {formatCOP(profit.cogs)} de costo
        </ThemedText>
      </Card>

      <View style={styles.kpiGrid}>
        <KpiTile
          icon={ShoppingCart}
          color={theme.success}
          label="Ventas"
          value={formatCOP(sales.totalAmount)}
          caption={plural(sales.totalCount, 'venta', 'ventas')}
          onPress={() => onOpenTab('sales')}
        />
        <KpiTile
          icon={Truck}
          color={theme.info}
          label="Compras"
          value={formatCOP(purchases.totalAmount)}
          caption={plural(purchases.totalCount, 'pedido', 'pedidos')}
          onPress={() => onOpenTab('money')}
        />
        <KpiTile
          icon={ArrowDownLeft}
          color={theme.success}
          label="Entró a caja"
          value={formatCOP(cashPeriod.income)}
          onPress={() => onOpenTab('money')}
        />
        <KpiTile
          icon={ArrowUpRight}
          color={theme.error}
          label="Salió de caja"
          value={formatCOP(cashPeriod.expense)}
          onPress={() => onOpenTab('money')}
        />
      </View>

      <Section title="Cómo se vendió" scope={rangeLabel}>
        <Card>
          <ChannelSplit sales={sales} />
        </Card>
      </Section>

      <Section title="Para atender" scope="Hoy">
        {hasAlerts ? (
          <View style={styles.alertsRow}>
            {data.outOfStockCount > 0 ? (
              <AlertTile href="/more/inventory" icon={PackageX} color={theme.error} value={String(data.outOfStockCount)} label="Agotados" />
            ) : null}
            {data.lowStockCount > 0 ? (
              <AlertTile href="/more/inventory" icon={TriangleAlert} color={theme.warning} value={String(data.lowStockCount)} label="Stock bajo" />
            ) : null}
            {payable > 0 ? (
              <AlertTile href="/more/purchases" icon={Wallet} color={theme.info} value={formatCOP(payable)} label="Por pagar" />
            ) : null}
          </View>
        ) : (
          <Card>
            <ThemedText type="small" themeColor="textSecondary">
              Sin pendientes — todo en orden.
            </ThemedText>
          </Card>
        )}
      </Section>
    </View>
  );
}

function SalesTab({ data, rangeLabel }: { data: ReportsData; rangeLabel: string }) {
  const theme = useTheme();
  const { sales } = data;
  const avgTicket = sales.totalCount > 0 ? Math.round(sales.totalAmount / sales.totalCount) : 0;
  const maxAccount = Math.max(0, ...sales.localByAccount.map((l) => l.total));
  const maxSeller = Math.max(0, ...data.sellerSales.map((l) => l.totalAmount));

  return (
    <View style={styles.tabContent}>
      <Card>
        <ThemedText type="secondary" themeColor="textSecondary">
          Total vendido
        </ThemedText>
        <ThemedText type="bigNumber" adjustsFontSizeToFit numberOfLines={1}>
          {formatCOP(sales.totalAmount)}
        </ThemedText>
        <View style={styles.inlineStats}>
          <InlineStat label="Ventas" value={String(sales.totalCount)} />
          <InlineStat label="Ticket promedio" value={formatCOP(avgTicket)} />
        </View>
      </Card>

      <Section title="Por canal" scope={rangeLabel}>
        <Card>
          <ChannelSplit sales={sales} />
        </Card>
      </Section>

      <Section title="En local, por método de pago" scope={rangeLabel}>
        <Card>
          {sales.localByAccount.length === 0 ? (
            <Empty text="Sin ventas en local en este período." />
          ) : (
            sales.localByAccount.map((line, i) => (
              <BarRow
                key={line.accountId}
                divider={i > 0}
                label={data.names.accounts[line.accountId] ?? `Cuenta #${line.accountId}`}
                caption={plural(line.count, 'venta', 'ventas')}
                value={formatCOP(line.total)}
                ratio={maxAccount > 0 ? line.total / maxAccount : 0}
                color={theme.primary}
              />
            ))
          )}
        </Card>
      </Section>

      <Section title="Ranking de vendedores" scope="Histórico">
        <Card>
          {data.sellerSales.length === 0 ? (
            <Empty text="Sin ventas de vendedores todavía." />
          ) : (
            data.sellerSales.map((line, i) => (
              <Link
                key={line.sellerId}
                href={{ pathname: '/more/sellers/[id]', params: { id: String(line.sellerId) } }}
                asChild
              >
                <Pressable>
                  <BarRow
                    divider={i > 0}
                    rank={i + 1}
                    label={data.names.sellers[line.sellerId] ?? `Vendedor #${line.sellerId}`}
                    caption={`${plural(line.count, 'venta', 'ventas')} · comisión ${formatCOP(line.totalCommission)}`}
                    value={formatCOP(line.totalAmount)}
                    ratio={maxSeller > 0 ? line.totalAmount / maxSeller : 0}
                    color={CHANNEL_COLORS.seller}
                  />
                </Pressable>
              </Link>
            ))
          )}
        </Card>
      </Section>
    </View>
  );
}

function MoneyTab({ data, rangeLabel }: { data: ReportsData; rangeLabel: string }) {
  const theme = useTheme();
  const { cashPeriod } = data;
  const net = cashPeriod.income - cashPeriod.expense;
  const flowMax = Math.max(cashPeriod.income, cashPeriod.expense);
  const payable = data.accountsPayable.reduce((s, r) => s + r.pending, 0);
  const maxPurchase = Math.max(0, ...data.purchases.byDistributor.map((l) => l.total));

  return (
    <View style={styles.tabContent}>
      <Card>
        <ThemedText type="secondary" themeColor="textSecondary">
          Dinero disponible hoy
        </ThemedText>
        <ThemedText
          type="bigNumber"
          style={{ color: data.cashBalance < 0 ? theme.error : theme.text }}
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          {formatCOP(data.cashBalance)}
        </ThemedText>
        {data.accountBalances.length > 0 ? (
          <View style={styles.accountList}>
            {data.accountBalances.map((account) => {
              const Icon = account.type === 'banco' ? Landmark : Banknote;
              return (
                <View key={account.id} style={styles.accountRow}>
                  <View style={[styles.iconDot, { backgroundColor: withAlpha(theme.primary, 0.12) }]}>
                    <Icon color={theme.primary} size={16} />
                  </View>
                  <ThemedText type="small" style={styles.flex} numberOfLines={1}>
                    {account.name}
                    {!account.active ? (
                      <ThemedText type="caption" themeColor="textSecondary">
                        {'  '}inactiva
                      </ThemedText>
                    ) : null}
                  </ThemedText>
                  <ThemedText type="smallBold" style={account.balance < 0 ? { color: theme.error } : undefined}>
                    {formatCOP(account.balance)}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        ) : null}
      </Card>

      <Section title="Flujo de caja" scope={rangeLabel}>
        <Card>
          <FlowBar label="Entró" value={cashPeriod.income} max={flowMax} color={theme.success} icon={ArrowDownLeft} />
          <FlowBar label="Salió" value={cashPeriod.expense} max={flowMax} color={theme.error} icon={ArrowUpRight} />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.spaceBetween}>
            <ThemedText type="small" themeColor="textSecondary">
              Neto del período
            </ThemedText>
            <ThemedText type="cardTitle" style={{ color: net < 0 ? theme.error : theme.primary }}>
              {net > 0 ? '+' : ''}
              {formatCOP(net)}
            </ThemedText>
          </View>
          {data.cashPeriodByAccount.length > 1 ? (
            <View style={styles.subList}>
              {data.cashPeriodByAccount.map((line) => (
                <View key={line.accountId} style={styles.spaceBetween}>
                  <ThemedText type="caption" themeColor="textSecondary" style={styles.flex} numberOfLines={1}>
                    {data.names.accounts[line.accountId] ?? `Cuenta #${line.accountId}`}
                  </ThemedText>
                  <ThemedText type="caption">
                    <ThemedText type="caption" style={{ color: theme.success }}>
                      +{formatCOP(line.income)}
                    </ThemedText>
                    {'   '}
                    <ThemedText type="caption" style={{ color: theme.error }}>
                      −{formatCOP(line.expense)}
                    </ThemedText>
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      </Section>

      <Section title="Cuentas por pagar" scope="Hoy">
        <Card>
          {data.accountsPayable.length === 0 ? (
            <Empty text="No le debes nada a ningún distribuidor." />
          ) : (
            <>
              <View style={styles.spaceBetween}>
                <ThemedText type="small" themeColor="textSecondary">
                  Total pendiente
                </ThemedText>
                <ThemedText type="cardTitle" style={{ color: theme.info }}>
                  {formatCOP(payable)}
                </ThemedText>
              </View>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              {data.accountsPayable.map((line) => (
                <ListRow
                  key={line.distributorId}
                  label={data.names.distributors[line.distributorId] ?? `Distribuidor #${line.distributorId}`}
                  value={formatCOP(line.pending)}
                />
              ))}
              <LinkRow href="/more/purchases" label="Ver compras" />
            </>
          )}
        </Card>
      </Section>

      <Section title="Compras por distribuidor" scope={rangeLabel}>
        <Card>
          {data.purchases.byDistributor.length === 0 ? (
            <Empty text="Sin compras en este período." />
          ) : (
            data.purchases.byDistributor.map((line, i) => (
              <BarRow
                key={String(line.distributorId)}
                divider={i > 0}
                label={
                  line.distributorId
                    ? (data.names.distributors[line.distributorId] ?? `Distribuidor #${line.distributorId}`)
                    : 'Sin distribuidor'
                }
                caption={plural(line.count, 'pedido', 'pedidos')}
                value={formatCOP(line.total)}
                ratio={maxPurchase > 0 ? line.total / maxPurchase : 0}
                color={theme.info}
              />
            ))
          )}
        </Card>
      </Section>
    </View>
  );
}

function InventoryTab({ data }: { data: ReportsData }) {
  const theme = useTheme();
  const { inventory } = data;
  const maxReturned = Math.max(0, ...data.returnedProducts.map((l) => l.totalQuantity));
  const unitsWithSellers = data.sellerStock.reduce((s, r) => s + r.units, 0);

  return (
    <View style={styles.tabContent}>
      <Card>
        <ThemedText type="secondary" themeColor="textSecondary">
          Valor del inventario (a costo)
        </ThemedText>
        <ThemedText type="bigNumber" adjustsFontSizeToFit numberOfLines={1}>
          {formatCOP(inventory.totalValue)}
        </ThemedText>
        <View style={styles.inlineStats}>
          <InlineStat label="Productos activos" value={String(inventory.activeProducts)} />
          <InlineStat label="Unidades en bodega" value={String(inventory.totalUnits)} />
        </View>
      </Card>

      <View style={styles.alertsRow}>
        <AlertTile
          href="/more/inventory"
          icon={PackageX}
          color={theme.error}
          value={String(data.outOfStockCount)}
          label="Agotados"
          muted={data.outOfStockCount === 0}
        />
        <AlertTile
          href="/more/inventory"
          icon={TriangleAlert}
          color={theme.warning}
          value={String(data.lowStockCount)}
          label="Stock bajo"
          muted={data.lowStockCount === 0}
        />
      </View>

      <Section title="En manos de vendedores" scope={plural(unitsWithSellers, 'unidad', 'unidades')}>
        <Card>
          {data.sellerStock.length === 0 ? (
            <Empty text="Ningún vendedor tiene inventario ahora." />
          ) : (
            data.sellerStock.map((seller, i) => (
              <Link
                key={seller.sellerId}
                href={{ pathname: '/more/sellers/[id]', params: { id: String(seller.sellerId) } }}
                asChild
              >
                {/* Link asChild rejects style arrays on its direct child, so the
                    composed row style lives on an inner View. */}
                <Pressable>
                  <View style={[styles.sellerRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: 1 }]}>
                    <View style={[styles.iconDot, { backgroundColor: withAlpha(CHANNEL_COLORS.seller, 0.12) }]}>
                      <Users color={CHANNEL_COLORS.seller} size={16} />
                    </View>
                    <View style={styles.flex}>
                      <ThemedText type="small">{seller.name}</ThemedText>
                      <ThemedText type="caption" themeColor="textSecondary" numberOfLines={2}>
                        {seller.products.slice(0, 3).join(' · ')}
                        {seller.products.length > 3 ? ` · y ${seller.products.length - 3} más` : ''}
                      </ThemedText>
                    </View>
                    <ThemedText type="smallBold">{seller.units} u.</ThemedText>
                    <ChevronRight color={theme.textSecondary} size={16} />
                  </View>
                </Pressable>
              </Link>
            ))
          )}
        </Card>
      </Section>

      <Section title="Más devueltos" scope="Histórico">
        <Card>
          {data.returnedProducts.length === 0 ? (
            <Empty text="Sin devoluciones todavía." />
          ) : (
            data.returnedProducts.slice(0, 8).map((line, i) => (
              <BarRow
                key={line.productId}
                divider={i > 0}
                label={data.names.products[line.productId] ?? `Producto #${line.productId}`}
                value={`${line.totalQuantity} u.`}
                ratio={maxReturned > 0 ? line.totalQuantity / maxReturned : 0}
                color={theme.warning}
                icon={RotateCcw}
              />
            ))
          )}
        </Card>
      </Section>
    </View>
  );
}

// ─── Building blocks ─────────────────────────────────────────────────────────

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function Card({ children }: { children: ReactNode }) {
  return (
    <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
      {children}
    </ThemedView>
  );
}

// `scope` says which numbers the period chips affect: the range label for
// flow reports, "Hoy"/"Histórico" for the ones that ignore it.
function Section({ title, scope, children }: { title: string; scope: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText type="sectionTitle" style={styles.flex}>
          {title}
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {scope}
        </ThemedText>
      </View>
      {children}
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <ThemedText type="small" themeColor="textSecondary">
      {text}
    </ThemedText>
  );
}

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.inlineStat}>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="cardTitle">{value}</ThemedText>
    </View>
  );
}

function KpiTile({
  icon: Icon,
  color,
  label,
  value,
  caption,
  onPress,
}: {
  icon: ComponentType<LucideProps>;
  color: string;
  label: string;
  value: string;
  caption?: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.kpiFlex} onPress={onPress}>
      <ThemedView type="backgroundElement" style={[styles.kpiTile, Shadow.subtle]}>
        <View style={[styles.iconDot, { backgroundColor: withAlpha(color, 0.12) }]}>
          <Icon color={color} size={16} />
        </View>
        <ThemedText type="caption" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText type="cardTitle" adjustsFontSizeToFit numberOfLines={1}>
          {value}
        </ThemedText>
        {caption ? (
          <ThemedText type="caption" themeColor="textSecondary">
            {caption}
          </ThemedText>
        ) : null}
      </ThemedView>
    </Pressable>
  );
}

function AlertTile({
  href,
  icon: Icon,
  color,
  value,
  label,
  muted = false,
}: {
  href: '/more/inventory' | '/more/purchases';
  icon: ComponentType<LucideProps>;
  color: string;
  value: string;
  label: string;
  muted?: boolean;
}) {
  const theme = useTheme();
  const tint = muted ? theme.textSecondary : color;
  return (
    <Link href={href} asChild>
      <Pressable style={styles.flex}>
        <View style={[styles.alertTile, { backgroundColor: withAlpha(tint, muted ? 0.06 : 0.08) }]}>
          <Icon color={tint} size={20} />
          <ThemedText type="cardTitle" style={{ color: tint }} adjustsFontSizeToFit numberOfLines={1}>
            {value}
          </ThemedText>
          <ThemedText type="caption" style={{ color: tint }}>
            {label}
          </ThemedText>
        </View>
      </Pressable>
    </Link>
  );
}

// 100% stacked bar of the two sales channels. Labels carry the numbers, so
// identity never depends on color alone.
function ChannelSplit({ sales }: { sales: SalesReport }) {
  const theme = useTheme();
  const { local, seller } = sales.byChannel;
  const total = local.total + seller.total;

  if (total === 0) return <Empty text="Sin ventas en este período." />;

  const localPct = Math.round((local.total / total) * 100);
  const channels = [
    { key: 'local', label: 'En local', icon: Store, color: CHANNEL_COLORS.local, data: local, pct: localPct },
    { key: 'seller', label: 'Vendedores', icon: Users, color: CHANNEL_COLORS.seller, data: seller, pct: 100 - localPct },
  ];

  return (
    <View style={styles.splitWrap}>
      <View style={[styles.splitBar, { backgroundColor: withAlpha(theme.textSecondary, 0.12) }]}>
        {channels
          .filter((c) => c.data.total > 0)
          .map((c) => (
            <View key={c.key} style={[styles.splitSegment, { flex: c.data.total, backgroundColor: c.color }]} />
          ))}
      </View>
      {channels.map(({ key, label, icon: Icon, color, data, pct }) => (
        <View key={key} style={styles.legendRow}>
          <View style={[styles.legendSwatch, { backgroundColor: color }]} />
          <Icon color={theme.textSecondary} size={16} />
          <View style={styles.flex}>
            <ThemedText type="small">{label}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {plural(data.count, 'venta', 'ventas')} · {pct}%
            </ThemedText>
          </View>
          <ThemedText type="smallBold">{formatCOP(data.total)}</ThemedText>
        </View>
      ))}
    </View>
  );
}

function BarRow({
  label,
  caption,
  value,
  ratio,
  color,
  divider,
  rank,
  icon: Icon,
}: {
  label: string;
  caption?: string;
  value: string;
  ratio: number;
  color: string;
  divider?: boolean;
  rank?: number;
  icon?: ComponentType<LucideProps>;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.barRow, divider && { borderTopColor: theme.border, borderTopWidth: 1 }]}>
      <View style={styles.barHeader}>
        {rank !== undefined ? (
          <ThemedText type="caption" themeColor="textSecondary" style={styles.rank}>
            {rank}
          </ThemedText>
        ) : null}
        {Icon ? <Icon color={theme.textSecondary} size={14} /> : null}
        <ThemedText type="small" style={styles.flex} numberOfLines={1}>
          {label}
        </ThemedText>
        <ThemedText type="smallBold">{value}</ThemedText>
      </View>
      <View style={[styles.track, { backgroundColor: withAlpha(theme.textSecondary, 0.12) }]}>
        <View style={[styles.fill, { width: `${Math.max(ratio * 100, 2)}%`, backgroundColor: color }]} />
      </View>
      {caption ? (
        <ThemedText type="caption" themeColor="textSecondary">
          {caption}
        </ThemedText>
      ) : null}
    </View>
  );
}

function FlowBar({
  label,
  value,
  max,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  icon: ComponentType<LucideProps>;
}) {
  const theme = useTheme();
  const ratio = max > 0 ? value / max : 0;
  return (
    <View style={styles.flowRow}>
      <View style={styles.barHeader}>
        <Icon color={color} size={16} />
        <ThemedText type="small" style={styles.flex}>
          {label}
        </ThemedText>
        <ThemedText type="smallBold">{formatCOP(value)}</ThemedText>
      </View>
      <View style={[styles.track, styles.trackThick, { backgroundColor: withAlpha(theme.textSecondary, 0.12) }]}>
        {value > 0 ? <View style={[styles.fill, { width: `${Math.max(ratio * 100, 2)}%`, backgroundColor: color }]} /> : null}
      </View>
    </View>
  );
}

function ListRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={[styles.spaceBetween, styles.listRow]}>
      <ThemedText type="small" style={styles.flex} numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

function LinkRow({ href, label }: { href: '/more/purchases'; label: string }) {
  const theme = useTheme();
  return (
    <Link href={href} asChild>
      <Pressable style={styles.linkRow}>
        <ThemedText type="small" style={{ color: theme.primary }}>
          {label}
        </ThemedText>
        <ChevronRight color={theme.primary} size={16} />
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  flex: { flex: 1 },
  loading: { paddingVertical: Spacing.four, textAlign: 'center' },

  periodBlock: { gap: Spacing.two },
  chipsRow: { gap: Spacing.two, paddingRight: Spacing.four },
  chip: {
    borderRadius: Radii.chip,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },

  tabBarWrap: { paddingVertical: Spacing.one },
  tabBar: {
    flexDirection: 'row',
    borderRadius: Radii.button,
    borderWidth: 1,
    padding: Spacing.one,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radii.button - Spacing.one,
  },

  tabContent: { gap: Layout.cardGap },
  section: { gap: Spacing.two },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  card: { borderRadius: Radii.card, padding: Spacing.four, gap: Spacing.one },

  heroHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radii.chip,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  inlineStats: { flexDirection: 'row', gap: Spacing.four, marginTop: Spacing.two },
  inlineStat: { gap: Spacing.half },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Layout.cardGap },
  kpiFlex: { width: '47%', flexGrow: 1 },
  kpiTile: { borderRadius: Radii.card, padding: Spacing.three, gap: Spacing.one },
  iconDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  alertsRow: { flexDirection: 'row', gap: Spacing.two },
  alertTile: {
    borderRadius: Radii.card,
    padding: Spacing.three,
    gap: Spacing.half,
    minHeight: 96,
    justifyContent: 'flex-end',
  },

  splitWrap: { gap: Spacing.three },
  // overflow hidden + 2px gaps give rounded ends and a surface spacer between segments.
  splitBar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 },
  splitSegment: { height: '100%' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  legendSwatch: { width: 10, height: 10, borderRadius: 3 },

  barRow: { gap: Spacing.one, paddingVertical: Spacing.two },
  barHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rank: { width: 16, textAlign: 'center' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  trackThick: { height: 12, borderRadius: 6 },
  fill: { height: '100%', borderRadius: 4 },
  flowRow: { gap: Spacing.one, paddingVertical: Spacing.one },

  divider: { height: 1, marginVertical: Spacing.two },
  spaceBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  subList: { gap: Spacing.one, marginTop: Spacing.two },
  listRow: { paddingVertical: Spacing.one },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingTop: Spacing.two },

  accountList: { gap: Spacing.two, marginTop: Spacing.three },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
});
