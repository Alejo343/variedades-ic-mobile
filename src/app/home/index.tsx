import { Link } from 'expo-router';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CloudAlert,
  HandCoins,
  PackagePlus,
  PackageX,
  ShoppingCart,
  Tag,
  TriangleAlert,
  Truck,
  Users,
  Wallet,
  Wrench,
  type LucideProps,
} from 'lucide-react-native';
import { useCallback, useState, type ComponentType } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MenuRow } from '@/components/menu-row';
import { ProductThumb } from '@/components/pos';
import { PrimaryActionButton } from '@/components/primary-action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useTheme } from '@/hooks/use-theme';
import {
  cashRepo,
  directSalesRepo,
  distributorsRepo,
  inventoryRepo,
  productsRepo,
  purchaseOrdersRepo,
  purchasePaymentsRepo,
  sellerSalesRepo,
  sellersRepo,
  settlementsRepo,
  type Product,
} from '@/lib/data';
import { isBusinessCashMovement } from '@/lib/domain/cash';
import { formatCOP, formatRelativeTime, isOnLocalDay, shiftLocalDate, todayLocalDateString } from '@/lib/format';
import { changeVsPrevious, dailySalesTotals, topSoldProducts, type DailyTotal } from '@/lib/home-summary';
import { listRejections } from '@/lib/sync/push-engine';

type ActivityKind = 'sale' | 'sellerSale' | 'purchase' | 'adjustment' | 'settlement';

type ActivityEntry = {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  amount: string;
  date: string;
  href: string;
};

type Pending = {
  outOfStock: number;
  lowStock: number;
  payable: number;
  ordersOnTheWay: number;
  // Consignment money not settled yet, and how many sellers owe it.
  receivable: number;
  receivableSellers: number;
  rejections: number;
};

type HomeData = {
  week: DailyTotal[];
  localToday: number;
  sellersToday: number;
  cashIn: number;
  cashOut: number;
  pending: Pending;
  activity: ActivityEntry[];
  topProducts: { product: Product; quantity: number }[];
};

const QUICK_ACTIONS: { href: string; label: string; icon: ComponentType<LucideProps> }[] = [
  { href: '/more/purchases/new', label: 'Pedido', icon: PackagePlus },
  { href: '/more/products', label: 'Productos', icon: Tag },
  { href: '/more/cash/new', label: 'Caja', icon: Wallet },
  { href: '/more/sellers/deliveries/new', label: 'Entrega', icon: Truck },
];

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function parseLocalDate(localDate: string): Date {
  const [y, m, d] = localDate.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

async function loadHome(): Promise<HomeData> {
  const [
    cashMovements,
    lowStock,
    outOfStock,
    recentMovements,
    payableLines,
    directSales,
    sellerSales,
    purchaseOrders,
    settlements,
    products,
    sellers,
    distributors,
    rejections,
  ] = await Promise.all([
    cashRepo.list(),
    inventoryRepo.getLowStock(),
    inventoryRepo.getOutOfStock(),
    inventoryRepo.getRecentMovements(10),
    purchasePaymentsRepo.getAccountsPayableSummary(),
    directSalesRepo.list(),
    sellerSalesRepo.list(),
    purchaseOrdersRepo.list(),
    settlementsRepo.list(),
    productsRepo.list(),
    sellersRepo.list(),
    distributorsRepo.list(),
    listRejections(),
  ]);

  const today = todayLocalDateString();
  // What each consignment seller would hand over if settled today.
  const consignment = sellers.filter((s) => s.active && s.inventoryMode === 'consignment');
  const previews = await Promise.all(consignment.map((s) => settlementsRepo.preview(s.id, today)));
  const owing = previews.filter((p) => p.amountDue > 0);

  // Transfers and adjustments aren't business income or expenses.
  const todayCash = cashMovements.filter((m) => isBusinessCashMovement(m) && isOnLocalDay(m.movementDate, today));

  const productById = new Map(products.map((p) => [p.id, p]));
  const sellerNames = new Map(sellers.map((s) => [s.id, s.name]));
  const distributorNames = new Map(distributors.map((d) => [d.id, d.name]));
  const allSales = [...directSales, ...sellerSales];

  const entries: ActivityEntry[] = [];
  for (const sale of directSales) {
    entries.push({
      id: `direct-${sale.id}`,
      kind: 'sale',
      title: sale.sellerId !== null ? `Venta · ${sellerNames.get(sale.sellerId) ?? 'vendedor'}` : 'Venta en local',
      detail: plural(sale.items.length, 'producto', 'productos'),
      amount: formatCOP(sale.totalAmount),
      date: sale.saleDate,
      href: sale.sellerId !== null ? `/sell/history?sellerId=${sale.sellerId}` : '/sell/history',
    });
  }
  for (const sale of sellerSales) {
    entries.push({
      id: `seller-sale-${sale.id}`,
      kind: 'sellerSale',
      title: `Venta · ${sellerNames.get(sale.sellerId) ?? 'vendedor'}`,
      detail: plural(sale.items.length, 'producto', 'productos'),
      amount: formatCOP(sale.totalAmount),
      date: sale.saleDate,
      href: `/more/sellers/sales?sellerId=${sale.sellerId}`,
    });
  }
  for (const order of purchaseOrders) {
    if (order.status !== 'recibido') continue;
    entries.push({
      id: `purchase-${order.id}`,
      kind: 'purchase',
      title: 'Compra recibida',
      detail: order.distributorId !== null ? (distributorNames.get(order.distributorId) ?? 'Distribuidor') : 'Sin distribuidor',
      amount: formatCOP(order.totalCost),
      date: order.updatedAt,
      href: `/more/purchases/${order.id}`,
    });
  }
  for (const movement of recentMovements) {
    if (movement.type !== 'ajuste') continue;
    entries.push({
      id: `movement-${movement.id}`,
      kind: 'adjustment',
      title: 'Ajuste de stock',
      detail: productById.get(movement.productId)?.name ?? 'Producto',
      amount: `${movement.quantityDelta > 0 ? '+' : ''}${movement.quantityDelta}`,
      date: movement.createdAt,
      href: '/more/inventory',
    });
  }
  for (const settlement of settlements) {
    if (settlement.status !== 'liquidada' || !settlement.settledAt) continue;
    entries.push({
      id: `settlement-${settlement.id}`,
      kind: 'settlement',
      title: 'Liquidación',
      detail: sellerNames.get(settlement.sellerId) ?? 'Vendedor',
      amount: formatCOP(settlement.amountDue),
      date: settlement.settledAt,
      href: `/more/sellers/settlements/${settlement.id}`,
    });
  }
  entries.sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    week: dailySalesTotals(allSales, today, 7),
    localToday: directSales.filter((s) => isOnLocalDay(s.saleDate, today)).reduce((sum, s) => sum + s.totalAmount, 0),
    sellersToday: sellerSales.filter((s) => isOnLocalDay(s.saleDate, today)).reduce((sum, s) => sum + s.totalAmount, 0),
    cashIn: todayCash.filter((m) => m.type === 'ingreso').reduce((sum, m) => sum + m.amount, 0),
    cashOut: todayCash.filter((m) => m.type === 'gasto').reduce((sum, m) => sum + m.amount, 0),
    pending: {
      outOfStock: outOfStock.length,
      lowStock: lowStock.length,
      payable: payableLines.reduce((sum, l) => sum + l.pending, 0),
      ordersOnTheWay: purchaseOrders.filter((o) => o.status === 'en_viaje').length,
      receivable: owing.reduce((sum, p) => sum + p.amountDue, 0),
      receivableSellers: owing.length,
      rejections: rejections.length,
    },
    activity: entries.slice(0, 6),
    topProducts: topSoldProducts(allSales, shiftLocalDate(today, -29), 8)
      .map(({ productId, quantity }) => {
        const product = productById.get(productId);
        return product ? { product, quantity } : null;
      })
      .filter((e): e is { product: Product; quantity: number } => e !== null),
  };
}

export default function HomeScreen() {
  const theme = useTheme();
  const [data, setData] = useState<HomeData | null>(null);

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadHome().then((d) => {
        if (!cancelled) setData(d);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const dateLine = `${WEEKDAYS[now.getDay()]} ${now.getDate()} de ${MONTHS[now.getMonth()]}`;

  const todayTotal = data?.week[data.week.length - 1];
  const yesterdayTotal = data?.week[data.week.length - 2];
  const change = todayTotal && yesterdayTotal ? changeVsPrevious(todayTotal.total, yesterdayTotal.total) : null;

  const activityStyle: Record<ActivityKind, { icon: ComponentType<LucideProps>; color: string }> = {
    sale: { icon: ShoppingCart, color: theme.success },
    sellerSale: { icon: ShoppingCart, color: theme.purple },
    purchase: { icon: Truck, color: theme.info },
    adjustment: { icon: Wrench, color: theme.warning },
    settlement: { icon: HandCoins, color: theme.purple },
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View>
            <ThemedText type="greeting">{greeting}</ThemedText>
            <ThemedText type="secondary" themeColor="textSecondary">
              {dateLine.charAt(0).toUpperCase() + dateLine.slice(1)}
            </ThemedText>
          </View>

          <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
            <View style={styles.heroTop}>
              <ThemedText type="secondary" themeColor="textSecondary">
                Vendido hoy
              </ThemedText>
              {change !== null ? <ChangeChip change={change} /> : null}
            </View>
            <ThemedText type="bigNumber" style={{ color: theme.primary }} adjustsFontSizeToFit numberOfLines={1}>
              {formatCOP(todayTotal?.total ?? 0)}
            </ThemedText>
            <ThemedText type="secondary" themeColor="textSecondary">
              {plural(todayTotal?.count ?? 0, 'venta', 'ventas')}
              {data && data.sellersToday > 0
                ? ` · local ${formatCOP(data.localToday)} · vendedores ${formatCOP(data.sellersToday)}`
                : ''}
            </ThemedText>

            {data ? <WeekChart week={data.week} /> : null}

            <View style={[styles.cashRow, { borderTopColor: theme.border }]}>
              <CashStat icon={ArrowDownLeft} color={theme.success} label="Entró a caja" value={formatCOP(data?.cashIn ?? 0)} />
              <CashStat icon={ArrowUpRight} color={theme.error} label="Salió" value={formatCOP(data?.cashOut ?? 0)} />
            </View>
          </ThemedView>

          <PrimaryActionButton href="/sell" icon={<ShoppingCart color="#FFFFFF" size={24} />} label="VENTA RÁPIDA" caption="Ir al POS" />

          <View style={styles.quickRow}>
            {QUICK_ACTIONS.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href as never} asChild>
                <Pressable style={styles.quickItem}>
                  <View style={styles.quickInner}>
                    <ThemedView type="backgroundElement" style={[styles.quickIcon, Shadow.subtle]}>
                      <Icon color={theme.primary} size={22} />
                    </ThemedView>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {label}
                    </ThemedText>
                  </View>
                </Pressable>
              </Link>
            ))}
          </View>

          {data ? <PendingSection pending={data.pending} /> : null}

          <View style={styles.section}>
            <ThemedText type="sectionTitle">Actividad reciente</ThemedText>
            {!data ? (
              <ThemedText type="small" themeColor="textSecondary">
                Cargando…
              </ThemedText>
            ) : data.activity.length === 0 ? (
              <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
                <ThemedText type="small" themeColor="textSecondary">
                  Todavía no hay movimientos. Las ventas, compras y liquidaciones aparecen aquí.
                </ThemedText>
              </ThemedView>
            ) : (
              <ThemedView type="backgroundElement" style={[styles.listCard, Shadow.subtle]}>
                {data.activity.map((entry, index) => {
                  const { icon: Icon, color } = activityStyle[entry.kind];
                  return (
                    <Link key={entry.id} href={entry.href as never} asChild>
                      <Pressable>
                        {/* Link asChild rejects style arrays on its direct child. */}
                        <View style={[styles.activityRow, index > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                          <View style={[styles.dot, { backgroundColor: withAlpha(color, 0.12) }]}>
                            <Icon color={color} size={16} />
                          </View>
                          <View style={styles.flex}>
                            <ThemedText type="small" numberOfLines={1}>
                              {entry.title}
                            </ThemedText>
                            <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                              {entry.detail} · {formatRelativeTime(entry.date)}
                            </ThemedText>
                          </View>
                          <ThemedText type="smallBold">{entry.amount}</ThemedText>
                        </View>
                      </Pressable>
                    </Link>
                  );
                })}
              </ThemedView>
            )}
          </View>

          {data && data.topProducts.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText type="sectionTitle">Lo más vendido</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  últimos 30 días
                </ThemedText>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topRow}>
                {data.topProducts.map(({ product, quantity }, index) => (
                  <Link key={product.id} href={{ pathname: '/more/products/[id]', params: { id: String(product.id) } }} asChild>
                    <Pressable>
                      <ThemedView type="backgroundElement" style={[styles.topCard, Shadow.subtle]}>
                        <View>
                          <ProductThumb uri={product.primaryImageUri} style={styles.topImage} iconSize={24} />
                          <View style={[styles.rank, { backgroundColor: theme.primary }]}>
                            <ThemedText type="caption" style={styles.onPrimary}>
                              {index + 1}
                            </ThemedText>
                          </View>
                        </View>
                        <ThemedText type="small" numberOfLines={1}>
                          {product.name}
                        </ThemedText>
                        <ThemedText type="caption" themeColor="textSecondary">
                          {plural(quantity, 'vendida', 'vendidas')}
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                  </Link>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function ChangeChip({ change }: { change: number }) {
  const theme = useTheme();
  const color = change > 0 ? theme.success : change < 0 ? theme.error : theme.textSecondary;
  const label = change === 0 ? 'Igual que ayer' : `${change > 0 ? '+' : ''}${change}% vs. ayer`;
  return (
    <View style={[styles.chip, { backgroundColor: withAlpha(color, 0.12) }]}>
      <ThemedText type="caption" style={{ color }}>
        {label}
      </ThemedText>
    </View>
  );
}

// Seven bars, one per local day ending today; today in full color.
function WeekChart({ week }: { week: DailyTotal[] }) {
  const theme = useTheme();
  const max = Math.max(...week.map((d) => d.total), 1);
  const lastIndex = week.length - 1;
  return (
    <View style={styles.chart}>
      {week.map((day, i) => {
        const isToday = i === lastIndex;
        const weekday = WEEKDAYS[parseLocalDate(day.date).getDay()];
        return (
          <View key={day.date} style={styles.chartColumn}>
            <View style={styles.chartTrack}>
              <View
                style={[
                  styles.chartBar,
                  {
                    height: `${Math.max((day.total / max) * 100, day.total > 0 ? 6 : 2)}%`,
                    backgroundColor: isToday ? theme.primary : withAlpha(theme.primary, 0.25),
                  },
                ]}
              />
            </View>
            <ThemedText type="caption" themeColor={isToday ? undefined : 'textSecondary'} style={isToday ? styles.bold : undefined}>
              {isToday ? 'Hoy' : weekday.charAt(0).toUpperCase()}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

function CashStat({ icon: Icon, color, label, value }: { icon: ComponentType<LucideProps>; color: string; label: string; value: string }) {
  return (
    <View style={styles.cashStat}>
      <View style={[styles.dot, { backgroundColor: withAlpha(color, 0.12) }]}>
        <Icon color={color} size={16} />
      </View>
      <View style={styles.flex}>
        <ThemedText type="caption" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText type="smallBold" adjustsFontSizeToFit numberOfLines={1}>
          {value}
        </ThemedText>
      </View>
    </View>
  );
}

// Everything that needs the owner's attention, most urgent first; a calm
// card when there's nothing.
function PendingSection({ pending: p }: { pending: Pending }) {
  const theme = useTheme();
  const rows: { href: string; icon: ComponentType<LucideProps>; color: string; title: string; subtitle: string }[] = [];
  if (p.rejections > 0)
    rows.push({
      href: '/more/settings',
      icon: CloudAlert,
      color: theme.error,
      title: `El servidor rechazó ${plural(p.rejections, 'cambio', 'cambios')}`,
      subtitle: 'Revísalos en Configuración',
    });
  if (p.outOfStock > 0)
    rows.push({
      href: '/more/inventory',
      icon: PackageX,
      color: theme.error,
      title: plural(p.outOfStock, 'producto agotado', 'productos agotados'),
      subtitle: 'Sin unidades en el inventario principal',
    });
  if (p.lowStock > 0)
    rows.push({
      href: '/more/inventory',
      icon: TriangleAlert,
      color: theme.warning,
      title: `${plural(p.lowStock, 'producto', 'productos')} con stock bajo`,
      subtitle: 'En su mínimo o por debajo',
    });
  if (p.receivable > 0)
    rows.push({
      href: '/more/sellers',
      icon: Users,
      color: theme.purple,
      title: `${formatCOP(p.receivable)} por liquidar`,
      subtitle: `${plural(p.receivableSellers, 'vendedor tiene', 'vendedores tienen')} ventas sin liquidar`,
    });
  if (p.payable > 0)
    rows.push({
      href: '/more/purchases',
      icon: Wallet,
      color: theme.info,
      title: `${formatCOP(p.payable)} por pagar`,
      subtitle: 'Compras a crédito con saldo pendiente',
    });
  if (p.ordersOnTheWay > 0)
    rows.push({
      href: '/more/purchases',
      icon: Truck,
      color: theme.info,
      title: `${plural(p.ordersOnTheWay, 'pedido', 'pedidos')} en camino`,
      subtitle: 'Márcalos como recibidos al llegar',
    });

  return (
    <View style={styles.section}>
      <ThemedText type="sectionTitle">Pendientes</ThemedText>
      <ThemedView type="backgroundElement" style={[styles.listCard, Shadow.subtle]}>
        {rows.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.calm}>
            Nada pendiente por ahora — todo en orden.
          </ThemedText>
        ) : (
          rows.map((r, i) => <MenuRow key={r.title} {...r} divider={i > 0} />)
        )}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  bold: { fontFamily: Fonts.inter.bold },
  onPrimary: { color: '#FFFFFF' },
  scrollContent: {
    padding: Layout.screenPadding,
    // The safe area already clears the status bar; little extra on top.
    paddingTop: Spacing.two,
    gap: Layout.cardGap,
    paddingBottom: Spacing.six,
  },
  section: { gap: Spacing.two },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  card: { borderRadius: Radii.card, padding: Spacing.four, gap: Spacing.half },
  listCard: { borderRadius: Radii.card, paddingHorizontal: Spacing.three },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: { borderRadius: Radii.chip, paddingHorizontal: Spacing.two, paddingVertical: 2 },
  chart: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three, height: 96 },
  chartColumn: { flex: 1, alignItems: 'center', gap: Spacing.one },
  chartTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  chartBar: { width: '100%', borderRadius: 6 },
  cashRow: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.three, paddingTop: Spacing.three, borderTopWidth: 1 },
  cashStat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between' },
  quickItem: { flex: 1 },
  quickInner: { alignItems: 'center', gap: Spacing.one },
  quickIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  dot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  calm: { paddingVertical: Spacing.four, textAlign: 'center' },
  topRow: { gap: Spacing.three, paddingRight: Spacing.four, paddingBottom: Spacing.one },
  topCard: { width: 120, borderRadius: Radii.card, padding: Spacing.two, gap: Spacing.half },
  topImage: { width: '100%', height: 88, borderRadius: Spacing.two },
  rank: {
    position: 'absolute',
    top: Spacing.one,
    left: Spacing.one,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});
