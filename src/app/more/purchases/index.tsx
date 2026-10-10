import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { ChevronRight, Factory, Plus, ShoppingBasket, Truck, Wallet } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormChip } from '@/components/form';
import { PurchaseStatusChip } from '@/components/purchase-status';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useTheme } from '@/hooks/use-theme';
import { distributorsRepo, purchaseOrdersRepo, purchasePaymentsRepo, type PurchaseOrder } from '@/lib/data';
import { formatCOP, formatDateTime } from '@/lib/format';

type Filter = 'open' | 'recibido' | 'cancelado' | 'all';

function matches(order: PurchaseOrder, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'open') return order.status === 'pendiente' || order.status === 'en_viaje';
  return order.status === filter;
}

// Purchase orders, newest first. `?distributorId=` (from a distributor's
// screen) shows only theirs.
export default function PurchasesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { distributorId } = useLocalSearchParams<{ distributorId?: string }>();
  const onlyDistributorId = distributorId ? Number(distributorId) : null;
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [names, setNames] = useState<Record<number, string>>({});
  // Pending balance per crédito order (contado orders never owe anything).
  const [pending, setPending] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('open');

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [rows, distributors] = await Promise.all([purchaseOrdersRepo.list(), distributorsRepo.list()]);
        const visible = rows
          .filter((o) => onlyDistributorId === null || o.distributorId === onlyDistributorId)
          .sort((a, b) => (a.orderDate < b.orderDate ? 1 : -1));
        const credit = visible.filter((o) => o.purchaseType === 'credito' && o.status !== 'cancelado');
        const balances = await Promise.all(credit.map((o) => purchasePaymentsRepo.getBalance(o.id)));
        if (cancelled) return;
        setOrders(visible);
        setNames(Object.fromEntries(distributors.map((d) => [d.id, d.name])));
        setPending(Object.fromEntries(credit.map((o, i) => [o.id, balances[i].pending])));
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [onlyDistributorId]),
  );

  const totalOwed = Object.values(pending).reduce((sum, p) => sum + p, 0);
  const inTransit = orders.filter((o) => o.status === 'en_viaje').length;
  const counts = useMemo(
    () => ({
      open: orders.filter((o) => matches(o, 'open')).length,
      recibido: orders.filter((o) => matches(o, 'recibido')).length,
      cancelado: orders.filter((o) => matches(o, 'cancelado')).length,
      all: orders.length,
    }),
    [orders],
  );
  const visible = orders.filter((o) => matches(o, filter));
  const distributorName = onlyDistributorId !== null ? names[onlyDistributorId] : null;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: distributorName ? `Pedidos · ${distributorName}` : 'Compras',
          headerRight:
            onlyDistributorId === null
              ? () => (
                  <Link href="/more/purchases/distributors" asChild>
                    <Pressable hitSlop={8} style={styles.headerAction}>
                      <Factory color={theme.primary} size={18} />
                      <ThemedText type="smallBold" style={{ color: theme.primary }}>
                        Distribuidores
                      </ThemedText>
                    </Pressable>
                  </Link>
                )
              : undefined,
        }}
      />
      <SafeAreaView style={styles.flex} edges={[]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.tiles}>
            <ThemedView type="backgroundElement" style={[styles.tile, Shadow.subtle]}>
              <View style={[styles.iconDot, { backgroundColor: withAlpha(theme.error, 0.12) }]}>
                <Wallet color={theme.error} size={16} />
              </View>
              <ThemedText type="caption" themeColor="textSecondary">
                Por pagar
              </ThemedText>
              <ThemedText type="cardTitle" style={totalOwed > 0 ? { color: theme.error } : undefined} adjustsFontSizeToFit numberOfLines={1}>
                {formatCOP(totalOwed)}
              </ThemedText>
            </ThemedView>
            <ThemedView type="backgroundElement" style={[styles.tile, Shadow.subtle]}>
              <View style={[styles.iconDot, { backgroundColor: withAlpha(theme.info, 0.12) }]}>
                <Truck color={theme.info} size={16} />
              </View>
              <ThemedText type="caption" themeColor="textSecondary">
                En camino
              </ThemedText>
              <ThemedText type="cardTitle">
                {inTransit} {inTransit === 1 ? 'pedido' : 'pedidos'}
              </ThemedText>
            </ThemedView>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <FormChip label={`En curso · ${counts.open}`} selected={filter === 'open'} onPress={() => setFilter('open')} />
            <FormChip label={`Recibidos · ${counts.recibido}`} selected={filter === 'recibido'} onPress={() => setFilter('recibido')} />
            {counts.cancelado > 0 ? (
              <FormChip label={`Cancelados · ${counts.cancelado}`} selected={filter === 'cancelado'} onPress={() => setFilter('cancelado')} />
            ) : null}
            <FormChip label={`Todos · ${counts.all}`} selected={filter === 'all'} onPress={() => setFilter('all')} />
          </ScrollView>

          {!loading && visible.length === 0 ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.primaryLight }]}>
                <ShoppingBasket color={theme.primary} size={28} />
              </View>
              <ThemedText type="secondary" themeColor="textSecondary" style={styles.center}>
                {orders.length === 0 ? 'Todavía no hay pedidos.' : 'Ningún pedido con este filtro.'}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.list}>
            {visible.map((order) => {
              const units = order.items.reduce((sum, i) => sum + i.quantity, 0);
              const owed = pending[order.id] ?? 0;
              return (
                <Link key={order.id} href={`/more/purchases/${order.id}`} asChild>
                  <Pressable>
                    {/* Link asChild rejects style arrays on its direct child. */}
                    <View>
                      <ThemedView type="backgroundElement" style={[styles.row, Shadow.subtle, order.status === 'cancelado' && styles.dim]}>
                        <View style={styles.flex}>
                          <View style={styles.titleRow}>
                            <ThemedText type="default" numberOfLines={1} style={styles.shrink}>
                              {order.distributorId ? (names[order.distributorId] ?? 'Distribuidor') : 'Sin distribuidor'}
                            </ThemedText>
                            <PurchaseStatusChip status={order.status} />
                          </View>
                          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                            {formatDateTime(order.orderDate)} · {units} {units === 1 ? 'unidad' : 'unidades'} ·{' '}
                            {order.purchaseType === 'credito' ? 'crédito' : 'contado'}
                          </ThemedText>
                        </View>
                        <View style={styles.right}>
                          <ThemedText type="smallBold">{formatCOP(order.totalCost)}</ThemedText>
                          {owed > 0 ? (
                            <ThemedText type="caption" style={{ color: theme.error }}>
                              debe {formatCOP(owed)}
                            </ThemedText>
                          ) : null}
                        </View>
                        <ChevronRight color={theme.textSecondary} size={18} />
                      </ThemedView>
                    </View>
                  </Pressable>
                </Link>
              );
            })}
          </View>
        </ScrollView>

        <ThemedView
          type="backgroundElement"
          style={[styles.bottomBar, { borderTopColor: theme.border, paddingBottom: Spacing.three + insets.bottom }]}>
          <Link href={onlyDistributorId !== null ? `/more/purchases/new?distributorId=${onlyDistributorId}` : '/more/purchases/new'} asChild>
            <Pressable>
              <View style={[styles.primaryButton, { backgroundColor: theme.primary }]}>
                <Plus color="#FFFFFF" size={18} />
                <ThemedText type="cardTitle" style={styles.onPrimary}>
                  Nuevo pedido
                </ThemedText>
              </View>
            </Pressable>
          </Link>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  center: { textAlign: 'center' },
  headerAction: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  scrollContent: { padding: Layout.screenPadding, gap: Layout.cardGap, paddingBottom: Spacing.five },
  tiles: { flexDirection: 'row', gap: Layout.cardGap },
  tile: { flex: 1, borderRadius: Radii.card, padding: Spacing.three, gap: Spacing.one },
  iconDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  chips: { gap: Spacing.two },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  list: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radii.card },
  dim: { opacity: 0.6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  right: { alignItems: 'flex-end', gap: 2 },
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
