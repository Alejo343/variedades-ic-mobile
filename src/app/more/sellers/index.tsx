import { Link } from 'expo-router';
import { ChevronRight, ClipboardList, PackageMinus, PackagePlus, ShoppingBag, Undo2, UserPlus, Users } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormChip } from '@/components/form';
import { MenuRow } from '@/components/menu-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useTheme } from '@/hooks/use-theme';
import { commissionPaymentsRepo, sellersRepo, settlementsRepo, type Seller } from '@/lib/data';
import { formatCOP, todayLocalDateString } from '@/lib/format';
import { describeCommission } from '@/lib/seller-commission';

type Filter = 'all' | 'consignment' | 'store' | 'inactive';

// The one number that matters per seller: what a consignment seller holds and
// would hand over today, or a store seller's unpaid commission.
type Metric = { units: number; amount: number };

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export default function SellersScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [metrics, setMetrics] = useState<Record<number, Metric>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [rows, inventory] = await Promise.all([sellersRepo.list(), sellersRepo.getAllInventory()]);
        const today = todayLocalDateString();
        // A few sellers at this scale: one preview each is fine.
        const amounts = await Promise.all(
          rows.map((s) =>
            s.inventoryMode === 'store'
              ? commissionPaymentsRepo.preview(s.id, today).then((p) => p.totalCommission)
              : settlementsRepo.preview(s.id, today).then((p) => p.amountDue),
          ),
        );
        if (cancelled) return;
        const next: Record<number, Metric> = {};
        rows.forEach((s, i) => {
          next[s.id] = {
            units: inventory.filter((l) => l.sellerId === s.id).reduce((sum, l) => sum + l.quantity, 0),
            amount: amounts[i],
          };
        });
        setSellers([...rows].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)));
        setMetrics(next);
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const counts = useMemo(
    () => ({
      all: sellers.filter((s) => s.active).length,
      consignment: sellers.filter((s) => s.active && s.inventoryMode !== 'store').length,
      store: sellers.filter((s) => s.active && s.inventoryMode === 'store').length,
      inactive: sellers.filter((s) => !s.active).length,
    }),
    [sellers],
  );

  const visible = sellers.filter((s) => {
    if (filter === 'inactive') return !s.active;
    if (!s.active) return false;
    if (filter === 'consignment') return s.inventoryMode !== 'store';
    if (filter === 'store') return s.inventoryMode === 'store';
    return true;
  });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={[]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <FormChip label={`Activos · ${counts.all}`} selected={filter === 'all'} onPress={() => setFilter('all')} />
            <FormChip label={`Consignación · ${counts.consignment}`} selected={filter === 'consignment'} onPress={() => setFilter('consignment')} />
            <FormChip label={`Tienda · ${counts.store}`} selected={filter === 'store'} onPress={() => setFilter('store')} />
            {counts.inactive > 0 ? (
              <FormChip label={`Inactivos · ${counts.inactive}`} selected={filter === 'inactive'} onPress={() => setFilter('inactive')} />
            ) : null}
          </ScrollView>

          {!loading && visible.length === 0 ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.primaryLight }]}>
                <Users color={theme.primary} size={28} />
              </View>
              <ThemedText type="secondary" themeColor="textSecondary" style={styles.center}>
                {sellers.length === 0 ? 'Todavía no hay vendedores. Crea el primero con el botón de abajo.' : 'Ningún vendedor con este filtro.'}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.list}>
            {visible.map((seller) => {
              const metric = metrics[seller.id] ?? { units: 0, amount: 0 };
              const isStore = seller.inventoryMode === 'store';
              return (
                <Link key={seller.id} href={`/more/sellers/${seller.id}`} asChild>
                  <Pressable>
                    {/* Link asChild rejects style arrays on its direct child. */}
                    <View>
                      <ThemedView type="backgroundElement" style={[styles.row, Shadow.subtle, !seller.active && styles.inactive]}>
                        <View style={[styles.avatar, { backgroundColor: theme.primaryLight }]}>
                          <ThemedText type="cardTitle" style={{ color: theme.primary }}>
                            {seller.name.trim().charAt(0).toUpperCase() || '?'}
                          </ThemedText>
                        </View>
                        <View style={styles.flex}>
                          <ThemedText type="default" numberOfLines={1}>
                            {seller.name}
                          </ThemedText>
                          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                            {isStore ? 'Tienda' : 'Consignación'} · {describeCommission(seller.commissionType, seller.commissionValue)}
                            {seller.city ? ` · ${seller.city}` : ''}
                          </ThemedText>
                        </View>
                        <View style={styles.metric}>
                          <ThemedText type="smallBold" style={{ color: isStore ? theme.purple : theme.primary }}>
                            {formatCOP(metric.amount)}
                          </ThemedText>
                          <ThemedText type="caption" themeColor="textSecondary">
                            {isStore ? 'comisión' : plural(metric.units, 'unidad', 'unidades')}
                          </ThemedText>
                        </View>
                        <ChevronRight color={theme.textSecondary} size={18} />
                      </ThemedView>
                    </View>
                  </Pressable>
                </Link>
              );
            })}
          </View>
          {visible.some((s) => s.inventoryMode !== 'store') ? (
            <ThemedText type="caption" themeColor="textSecondary">
              Consignación: lo que entregaría si se liquida hoy y las unidades que tiene. Tienda: comisión por pagar.
            </ThemedText>
          ) : null}

          <View style={styles.section}>
            <ThemedText type="sectionTitle">Historial de todos</ThemedText>
            <ThemedView type="backgroundElement" style={[styles.menuCard, Shadow.subtle]}>
              <MenuRow href="/more/sellers/deliveries" icon={PackagePlus} color={theme.info} title="Entregas" />
              <MenuRow href="/more/sellers/sales" icon={ShoppingBag} title="Ventas de consignación" divider />
              <MenuRow href="/more/sellers/returns" icon={Undo2} color={theme.warning} title="Devoluciones" divider />
              <MenuRow href="/more/sellers/losses" icon={PackageMinus} color={theme.error} title="Pérdidas" divider />
              <MenuRow href="/more/sellers/settlements" icon={ClipboardList} color={theme.purple} title="Liquidaciones" divider />
            </ThemedView>
          </View>
        </ScrollView>

        <ThemedView
          type="backgroundElement"
          style={[styles.bottomBar, { borderTopColor: theme.border, paddingBottom: Spacing.three + insets.bottom }]}>
          <Link href="/more/sellers/deliveries/new" asChild>
            <Pressable style={styles.flex}>
              <View style={[styles.button, { borderColor: theme.info, backgroundColor: withAlpha(theme.info, 0.08) }]}>
                <PackagePlus color={theme.info} size={18} />
                <ThemedText type="smallBold" style={{ color: theme.info }}>
                  Entregar mercancía
                </ThemedText>
              </View>
            </Pressable>
          </Link>
          <Link href="/more/sellers/new" asChild>
            <Pressable style={styles.flex}>
              <View style={[styles.button, { borderColor: theme.primary, backgroundColor: theme.primary }]}>
                <UserPlus color="#FFFFFF" size={18} />
                <ThemedText type="smallBold" style={styles.onPrimary}>
                  Nuevo vendedor
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
  center: { textAlign: 'center' },
  scrollContent: { padding: Layout.screenPadding, gap: Layout.cardGap, paddingBottom: Spacing.five },
  chips: { gap: Spacing.two },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  list: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radii.card },
  inactive: { opacity: 0.6 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  metric: { alignItems: 'flex-end', gap: 2 },
  section: { gap: Spacing.two },
  menuCard: { borderRadius: Radii.card, paddingHorizontal: Spacing.three },
  bottomBar: { flexDirection: 'row', gap: Spacing.two, paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.three, borderTopWidth: 1 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderRadius: Radii.buttonPrimary,
    paddingVertical: Spacing.three,
  },
  onPrimary: { color: '#FFFFFF' },
});
