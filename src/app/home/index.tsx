import { Image } from "expo-image";
import { Link, useFocusEffect } from "expo-router";
import {
  ChartColumn,
  ChevronRight,
  Package,
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
} from "lucide-react-native";
import { useCallback, useMemo, useState, type ComponentType } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PrimaryActionButton } from "@/components/primary-action-button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Layout, Radii, Shadow, Spacing, withAlpha } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
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
} from "@/lib/data";
import {
  formatCOP,
  formatRelativeTime,
  todayLocalDateString,
} from "@/lib/format";
import { resolveImageUri } from "@/lib/sync/image-url";

type ActivityKind = "sale" | "purchase" | "adjustment" | "settlement";

type ActivityEntry = {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  amount: string;
  date: string;
};

type FavoriteProduct = { product: Product; quantity: number };

const QUICK_ACTIONS: {
  href: string;
  label: string;
  icon: ComponentType<LucideProps>;
}[] = [
  { href: "/more/purchases/new", label: "Registrar compra", icon: PackagePlus },
  { href: "/more/products/new", label: "Agregar producto", icon: Tag },
  { href: "/more/reports", label: "Ver reportes", icon: ChartColumn },
  { href: "/more/inventory", label: "Inventario", icon: Package },
];

export default function HomeScreen() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [todayIncome, setTodayIncome] = useState(0);
  const [todaySalesCount, setTodaySalesCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [outOfStockCount, setOutOfStockCount] = useState(0);
  const [payableTotal, setPayableTotal] = useState(0);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);

      Promise.all([
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
      ]).then(
        ([
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
        ]) => {
          if (cancelled) return;

          const today = todayLocalDateString();
          setTodayIncome(
            cashMovements
              .filter(
                (m) => m.type === "ingreso" && m.movementDate.startsWith(today),
              )
              .reduce((sum, m) => sum + m.amount, 0),
          );
          setTodaySalesCount(
            directSales.filter((s) => s.saleDate.startsWith(today)).length +
              sellerSales.filter((s) => s.saleDate.startsWith(today)).length,
          );
          setLowStockCount(lowStock.length);
          setOutOfStockCount(outOfStock.length);
          setPayableTotal(payableLines.reduce((sum, l) => sum + l.pending, 0));

          const productNames = new Map(products.map((p) => [p.id, p.name]));
          const sellerNames = new Map(sellers.map((s) => [s.id, s.name]));
          const distributorNames = new Map(
            distributors.map((d) => [d.id, d.name]),
          );

          const entries: ActivityEntry[] = [];

          for (const sale of directSales) {
            entries.push({
              id: `direct-${sale.id}`,
              kind: "sale",
              title: "Venta en local",
              detail: `${sale.items.length} producto${sale.items.length === 1 ? "" : "s"}`,
              amount: formatCOP(sale.totalAmount),
              date: sale.saleDate,
            });
          }
          for (const sale of sellerSales) {
            entries.push({
              id: `seller-sale-${sale.id}`,
              kind: "sale",
              title: "Venta",
              detail:
                sellerNames.get(sale.sellerId) ?? `Vendedor #${sale.sellerId}`,
              amount: formatCOP(sale.totalAmount),
              date: sale.saleDate,
            });
          }
          for (const order of purchaseOrders) {
            if (order.status !== "recibido") continue;
            entries.push({
              id: `purchase-${order.id}`,
              kind: "purchase",
              title: "Compra",
              detail: order.distributorId
                ? (distributorNames.get(order.distributorId) ??
                  `Distribuidor #${order.distributorId}`)
                : "Sin distribuidor",
              amount: formatCOP(order.totalCost),
              date: order.updatedAt,
            });
          }
          for (const movement of recentMovements) {
            if (movement.type !== "ajuste") continue;
            entries.push({
              id: `movement-${movement.id}`,
              kind: "adjustment",
              title: "Ajuste",
              detail:
                productNames.get(movement.productId) ??
                `Producto #${movement.productId}`,
              amount: `${movement.quantityDelta > 0 ? "+" : ""}${movement.quantityDelta}`,
              date: movement.createdAt,
            });
          }
          for (const settlement of settlements) {
            if (settlement.status !== "liquidada" || !settlement.settledAt)
              continue;
            entries.push({
              id: `settlement-${settlement.id}`,
              kind: "settlement",
              title: "Liquidación",
              detail:
                sellerNames.get(settlement.sellerId) ??
                `Vendedor #${settlement.sellerId}`,
              amount: formatCOP(settlement.amountDue),
              date: settlement.settledAt,
            });
          }

          entries.sort((a, b) => (a.date < b.date ? 1 : -1));
          setActivity(entries.slice(0, 8));

          // No dedicated "favorites" tracking exists — proxy it as the
          // products with the most units sold across every recorded sale.
          const soldByProduct = new Map<number, number>();
          for (const sale of [...directSales, ...sellerSales]) {
            for (const item of sale.items) {
              soldByProduct.set(
                item.productId,
                (soldByProduct.get(item.productId) ?? 0) + item.quantity,
              );
            }
          }
          const productById = new Map(products.map((p) => [p.id, p]));
          setFavorites(
            [...soldByProduct.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([productId, quantity]) => {
                const product = productById.get(productId);
                return product ? { product, quantity } : null;
              })
              .filter((entry): entry is FavoriteProduct => entry !== null),
          );

          setLoading(false);
        },
      );

      return () => {
        cancelled = true;
      };
    }, []),
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 19) return "Buenas tardes";
    return "Buenas noches";
  }, []);

  const activityStyle: Record<
    ActivityKind,
    { icon: ComponentType<LucideProps>; color: string }
  > = {
    sale: { icon: ShoppingCart, color: theme.success },
    purchase: { icon: Truck, color: theme.info },
    adjustment: { icon: Wrench, color: theme.purple },
    settlement: { icon: Users, color: theme.purple },
  };

  const hasAlerts =
    outOfStockCount > 0 || lowStockCount > 0 || payableTotal > 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View>
            <ThemedText type="greeting">{greeting}</ThemedText>
            <ThemedText type="secondary" themeColor="textSecondary">
              IC Variedades
            </ThemedText>
          </View>

          <ThemedView
            type="backgroundElement"
            style={[styles.card, Shadow.subtle]}
          >
            <ThemedText type="secondary" themeColor="textSecondary">
              Ingresos de hoy
            </ThemedText>
            <ThemedText type="bigNumber" style={{ color: theme.primary }}>
              {formatCOP(todayIncome)}
            </ThemedText>
            <ThemedText type="secondary" themeColor="textSecondary">
              {todaySalesCount} venta{todaySalesCount === 1 ? "" : "s"} hoy
            </ThemedText>
          </ThemedView>

          <PrimaryActionButton
            href="/sell"
            icon={<ShoppingCart color="#FFFFFF" size={24} />}
            label="VENTA RÁPIDA"
            caption="Ir al POS"
          />

          <View style={styles.section}>
            <ThemedText type="sectionTitle">Acciones rápidas</ThemedText>
            <View style={styles.quickActionsGrid}>
              {QUICK_ACTIONS.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href as never} asChild>
                  <Pressable style={styles.quickActionFlex}>
                    <ThemedView
                      type="backgroundElement"
                      style={[styles.quickActionCard, Shadow.subtle]}
                    >
                      <Icon color={theme.primary} size={28} />
                      <ThemedText
                        type="cardTitle"
                        style={styles.quickActionLabel}
                      >
                        {label}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                </Link>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText type="sectionTitle">Alertas</ThemedText>
            {hasAlerts ? (
              <View style={styles.alertsRow}>
                {outOfStockCount > 0 ? (
                  <Link href="/more/inventory" asChild>
                    <Pressable style={styles.alertFlex}>
                      <AlertTile
                        icon={PackageX}
                        color={theme.error}
                        value={String(outOfStockCount)}
                        label="Agotados"
                      />
                    </Pressable>
                  </Link>
                ) : null}
                {lowStockCount > 0 ? (
                  <Link href="/more/inventory" asChild>
                    <Pressable style={styles.alertFlex}>
                      <AlertTile
                        icon={TriangleAlert}
                        color={theme.warning}
                        value={String(lowStockCount)}
                        label="Stock bajo"
                      />
                    </Pressable>
                  </Link>
                ) : null}
                {payableTotal > 0 ? (
                  <Link href="/more/purchases" asChild>
                    <Pressable style={styles.alertFlex}>
                      <AlertTile
                        icon={Wallet}
                        color={theme.info}
                        value={formatCOP(payableTotal)}
                        label="Por pagar"
                      />
                    </Pressable>
                  </Link>
                ) : null}
              </View>
            ) : (
              <ThemedView
                type="backgroundElement"
                style={[styles.card, Shadow.subtle]}
              >
                <ThemedText themeColor="textSecondary" type="small">
                  Sin alertas por ahora — todo en orden.
                </ThemedText>
              </ThemedView>
            )}
          </View>

          <View style={styles.section}>
            <ThemedText type="sectionTitle">Actividad reciente</ThemedText>
            {activity.length === 0 ? (
              <ThemedText
                themeColor="textSecondary"
                type="small"
                style={styles.emptyText}
              >
                {loading ? "Cargando…" : "Sin actividad reciente todavía."}
              </ThemedText>
            ) : (
              <ThemedView
                type="backgroundElement"
                style={[styles.card, Shadow.subtle, styles.timeline]}
              >
                {activity.map((entry, index) => {
                  const { icon: Icon, color } = activityStyle[entry.kind];
                  return (
                    <View key={entry.id}>
                      <View style={styles.timelineRow}>
                        <View
                          style={[
                            styles.timelineDot,
                            { backgroundColor: withAlpha(color, 0.12) },
                          ]}
                        >
                          <Icon color={color} size={16} />
                        </View>
                        <View style={styles.timelineInfo}>
                          <ThemedText type="small">
                            {entry.title} · {entry.detail}
                          </ThemedText>
                          <ThemedText type="caption" themeColor="textSecondary">
                            {formatRelativeTime(entry.date)}
                          </ThemedText>
                        </View>
                        <ThemedText type="smallBold">{entry.amount}</ThemedText>
                      </View>
                      {index < activity.length - 1 ? (
                        <View
                          style={[
                            styles.timelineDivider,
                            { backgroundColor: theme.border },
                          ]}
                        />
                      ) : null}
                    </View>
                  );
                })}
              </ThemedView>
            )}
          </View>

          {favorites.length > 0 ? (
            <View style={styles.section}>
              <ThemedText type="sectionTitle">Productos favoritos</ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.favoritesRow}
              >
                {favorites.map(({ product }) => (
                  <Link
                    key={product.id}
                    href={{
                      pathname: "/more/products/[id]",
                      params: { id: String(product.id) },
                    }}
                    asChild
                  >
                    <Pressable>
                      <ThemedView
                        type="backgroundElement"
                        style={[styles.favoriteCard, Shadow.subtle]}
                      >
                        {product.primaryImageUri ? (
                          <Image
                            source={{ uri: resolveImageUri(product.primaryImageUri) }}
                            style={styles.favoriteImage}
                          />
                        ) : (
                          <View
                            style={[
                              styles.favoriteImage,
                              styles.favoritePlaceholder,
                              { backgroundColor: theme.primaryLight },
                            ]}
                          >
                            <Package color={theme.primary} size={24} />
                          </View>
                        )}
                        <ThemedText
                          type="small"
                          numberOfLines={1}
                          style={styles.favoriteName}
                        >
                          {product.name}
                        </ThemedText>
                        <ThemedText type="caption" themeColor="textSecondary">
                          {formatCOP(product.price)}
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                  </Link>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <Link href="/more" asChild>
            <Pressable style={styles.moreLink}>
              <ThemedText type="small" themeColor="textSecondary">
                Ver todo en Más
              </ThemedText>
              <ChevronRight color={theme.textSecondary} size={16} />
            </Pressable>
          </Link>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function AlertTile({
  icon: Icon,
  color,
  value,
  label,
}: {
  icon: ComponentType<LucideProps>;
  color: string;
  value: string;
  label: string;
}) {
  return (
    <View
      style={[styles.alertTile, { backgroundColor: withAlpha(color, 0.08) }]}
    >
      <Icon color={color} size={20} />
      <ThemedText type="cardTitle" style={{ color }}>
        {value}
      </ThemedText>
      <ThemedText type="caption" style={{ color }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: {
    padding: Layout.screenPadding,
    paddingTop: Layout.screenPadding + Spacing.one,
    gap: Layout.cardGap,
  },
  section: { gap: Spacing.two },
  card: {
    borderRadius: Radii.card,
    padding: Spacing.four,
    gap: Spacing.half,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Layout.cardGap,
  },
  quickActionFlex: { width: "47%" },
  quickActionCard: {
    borderRadius: Radii.card,
    padding: Spacing.four,
    gap: Spacing.three,
    minHeight: 120,
    justifyContent: "flex-end",
  },
  quickActionLabel: { lineHeight: 22 },
  alertsRow: { flexDirection: "row", gap: Spacing.two },
  alertFlex: { flex: 1 },
  alertTile: {
    borderRadius: Radii.card,
    padding: Spacing.three,
    gap: Spacing.half,
    alignItems: "flex-start",
    minHeight: 100,
    justifyContent: "flex-end",
  },
  emptyText: { paddingVertical: Spacing.two },
  timeline: { gap: 0, padding: Spacing.three },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  timelineDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineInfo: { flex: 1, gap: 2 },
  timelineDivider: { height: 1, marginLeft: 36 + Spacing.three },
  favoritesRow: { gap: Spacing.three, paddingRight: Spacing.four },
  favoriteCard: {
    width: 120,
    borderRadius: Radii.card,
    padding: Spacing.two,
    gap: Spacing.half,
  },
  favoriteImage: { width: "100%", height: 88, borderRadius: Spacing.two },
  favoritePlaceholder: { alignItems: "center", justifyContent: "center" },
  favoriteName: { marginTop: Spacing.half },
  moreLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
    paddingVertical: Spacing.three,
  },
});
