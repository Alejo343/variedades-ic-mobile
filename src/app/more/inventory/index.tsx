import { Link } from 'expo-router';
import {
  CircleCheck,
  PackageMinus,
  PackageX,
  ShoppingCart,
  SlidersHorizontal,
  TriangleAlert,
  Truck,
  Undo2,
  Users,
  type LucideProps,
} from 'lucide-react-native';
import { useCallback, useState, type ComponentType } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductThumb } from '@/components/pos';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useTheme } from '@/hooks/use-theme';
import { inventoryRepo, productsRepo, reportsRepo, type InventoryMovement, type InventorySummary, type Product } from '@/lib/data';
import type { MovementType } from '@/lib/domain/inventory-movement';
import { formatCOP, formatRelativeTime } from '@/lib/format';

type Tone = 'success' | 'info' | 'purple' | 'warning' | 'error';

const MOVEMENT_STYLE: Record<MovementType, { label: string; icon: ComponentType<LucideProps>; tone: Tone }> = {
  compra: { label: 'Compra recibida', icon: Truck, tone: 'success' },
  venta: { label: 'Venta', icon: ShoppingCart, tone: 'info' },
  entrega_vendedor: { label: 'Entrega a vendedor', icon: Users, tone: 'purple' },
  devolucion: { label: 'Devolución de vendedor', icon: Undo2, tone: 'success' },
  ajuste: { label: 'Ajuste', icon: SlidersHorizontal, tone: 'warning' },
  perdida: { label: 'Pérdida', icon: PackageMinus, tone: 'error' },
  dano: { label: 'Daño', icon: PackageMinus, tone: 'error' },
  robo: { label: 'Robo', icon: PackageMinus, tone: 'error' },
};

export default function InventoryScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [outOfStock, setOutOfStock] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [productNames, setProductNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([
        reportsRepo.getInventorySummary(),
        inventoryRepo.getLowStock(),
        inventoryRepo.getOutOfStock(),
        inventoryRepo.getRecentMovements(20),
        productsRepo.list(),
      ]).then(([inventory, low, out, recent, products]) => {
        if (cancelled) return;
        setSummary(inventory);
        setLowStock([...low].sort((a, b) => a.stock / a.minStock - b.stock / b.minStock));
        setOutOfStock([...out].sort((a, b) => a.stock - b.stock));
        setMovements(recent);
        setProductNames(Object.fromEntries(products.map((p) => [p.id, p.name])));
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const toneColor: Record<Tone, string> = {
    success: theme.success,
    info: theme.info,
    purple: theme.purple,
    warning: theme.warning,
    error: theme.error,
  };
  const toRestock = [...outOfStock, ...lowStock];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={[]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
            <ThemedText type="secondary" themeColor="textSecondary">
              Valor del inventario (a costo)
            </ThemedText>
            <ThemedText type="bigNumber" adjustsFontSizeToFit numberOfLines={1}>
              {formatCOP(summary?.totalValue ?? 0)}
            </ThemedText>
            <ThemedText type="secondary" themeColor="textSecondary">
              {summary ? `${summary.totalUnits} unidades · ${summary.activeProducts} productos activos` : 'Cargando…'}
            </ThemedText>
          </ThemedView>

          <View style={styles.tiles}>
            <AlertTile icon={PackageX} color={theme.error} value={outOfStock.length} label="Agotados" />
            <AlertTile icon={TriangleAlert} color={theme.warning} value={lowStock.length} label="Stock bajo" />
          </View>

          <View style={styles.section}>
            <ThemedText type="sectionTitle">Para reponer</ThemedText>
            {loading ? null : toRestock.length === 0 ? (
              <ThemedView type="backgroundElement" style={[styles.okCard, Shadow.subtle]}>
                <CircleCheck color={theme.primary} size={22} />
                <ThemedText type="secondary" themeColor="textSecondary" style={styles.flex}>
                  Todo tiene stock suficiente.
                </ThemedText>
              </ThemedView>
            ) : (
              <ThemedView type="backgroundElement" style={[styles.listCard, Shadow.subtle]}>
                {toRestock.map((product, i) => {
                  const out = product.stock <= 0;
                  const color = out ? theme.error : theme.warning;
                  const ratio = out || product.minStock <= 0 ? 0 : Math.min(1, product.stock / product.minStock);
                  return (
                    <Link key={product.id} href={{ pathname: '/more/products/[id]', params: { id: String(product.id) } }} asChild>
                      <Pressable>
                        <View style={[styles.restockRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                          <ProductThumb uri={product.primaryImageUri} style={styles.thumb} iconSize={18} />
                          <View style={styles.flex}>
                            <ThemedText type="small" numberOfLines={1}>
                              {product.name}
                            </ThemedText>
                            <View style={[styles.track, { backgroundColor: withAlpha(theme.textSecondary, 0.12) }]}>
                              {ratio > 0 ? <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} /> : null}
                            </View>
                            <ThemedText type="caption" style={{ color }}>
                              {out
                                ? product.stock < 0
                                  ? `Agotado (${product.stock}, revisar)`
                                  : 'Agotado'
                                : `Quedan ${product.stock} de un mínimo de ${product.minStock}`}
                            </ThemedText>
                          </View>
                        </View>
                      </Pressable>
                    </Link>
                  );
                })}
              </ThemedView>
            )}
          </View>

          <View style={styles.section}>
            <ThemedText type="sectionTitle">Movimientos recientes</ThemedText>
            {loading ? null : movements.length === 0 ? (
              <ThemedText type="secondary" themeColor="textSecondary">
                Sin movimientos todavía.
              </ThemedText>
            ) : (
              <ThemedView type="backgroundElement" style={[styles.listCard, Shadow.subtle]}>
                {movements.map((movement, i) => {
                  const style = MOVEMENT_STYLE[movement.type];
                  const color = toneColor[style.tone];
                  const Icon = style.icon;
                  const detail = movement.type === 'ajuste' && movement.reason ? `${style.label} · ${movement.reason}` : style.label;
                  return (
                    <View key={movement.id} style={[styles.movementRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                      <View style={[styles.iconDot, { backgroundColor: withAlpha(color, 0.12) }]}>
                        <Icon color={color} size={16} />
                      </View>
                      <View style={styles.flex}>
                        <ThemedText type="small" numberOfLines={1}>
                          {productNames[movement.productId] ?? `Producto #${movement.productId}`}
                        </ThemedText>
                        <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                          {detail} · {formatRelativeTime(movement.createdAt)}
                        </ThemedText>
                      </View>
                      <ThemedText type="smallBold" style={{ color: movement.quantityDelta > 0 ? theme.primary : theme.error }}>
                        {movement.quantityDelta > 0 ? '+' : ''}
                        {movement.quantityDelta}
                      </ThemedText>
                    </View>
                  );
                })}
              </ThemedView>
            )}
          </View>
        </ScrollView>

        <ThemedView type="backgroundElement" style={[styles.bottomBar, { borderTopColor: theme.border, paddingBottom: Spacing.three + insets.bottom }]}>
          <Link href="/more/inventory/adjust" asChild>
            <Pressable>
              <View style={[styles.primaryButton, { backgroundColor: theme.primary }]}>
                <SlidersHorizontal color="#FFFFFF" size={18} />
                <ThemedText type="cardTitle" style={styles.onPrimary}>
                  Ajustar stock
                </ThemedText>
              </View>
            </Pressable>
          </Link>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

function AlertTile({ icon: Icon, color, value, label }: { icon: ComponentType<LucideProps>; color: string; value: number; label: string }) {
  const theme = useTheme();
  const tint = value > 0 ? color : theme.textSecondary;
  return (
    <View style={[styles.alertTile, { backgroundColor: withAlpha(tint, value > 0 ? 0.08 : 0.06) }]}>
      <Icon color={tint} size={20} />
      <ThemedText type="cardTitle" style={{ color: tint }}>
        {value}
      </ThemedText>
      <ThemedText type="caption" style={{ color: tint }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { padding: Layout.screenPadding, gap: Layout.cardGap, paddingBottom: Spacing.five },
  card: { borderRadius: Radii.card, padding: Spacing.four, gap: Spacing.one },
  tiles: { flexDirection: 'row', gap: Spacing.two },
  alertTile: { flex: 1, borderRadius: Radii.card, padding: Spacing.three, gap: Spacing.half, minHeight: 96, justifyContent: 'flex-end' },
  section: { gap: Spacing.two },
  okCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderRadius: Radii.card, padding: Spacing.three },
  listCard: { borderRadius: Radii.card, paddingHorizontal: Spacing.three },
  restockRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  thumb: { width: 44, height: 44, borderRadius: Spacing.two },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginVertical: Spacing.one },
  fill: { height: '100%', borderRadius: 3 },
  movementRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  iconDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  bottomBar: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.three, borderTopWidth: 1 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Radii.buttonPrimary,
  },
  onPrimary: { color: '#FFFFFF' },
});
