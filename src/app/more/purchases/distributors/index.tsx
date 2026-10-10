import { Link } from 'expo-router';
import { ChevronRight, Factory, Plus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useTheme } from '@/hooks/use-theme';
import { distributorsRepo, purchaseOrdersRepo, purchasePaymentsRepo, type Distributor } from '@/lib/data';
import { formatCOP } from '@/lib/format';

type Row = Distributor & { orders: number; owed: number };

export default function DistributorsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([distributorsRepo.list(), purchaseOrdersRepo.list(), purchasePaymentsRepo.getAccountsPayableSummary()]).then(
        ([distributors, orders, payable]) => {
          if (cancelled) return;
          const owedBy = Object.fromEntries(payable.map((p) => [p.distributorId, p.pending]));
          setRows(
            distributors
              .map((d) => ({
                ...d,
                orders: orders.filter((o) => o.distributorId === d.id && o.status !== 'cancelado').length,
                owed: owedBy[d.id] ?? 0,
              }))
              .sort((a, b) => Number(b.active) - Number(a.active) || b.owed - a.owed || a.name.localeCompare(b.name)),
          );
          setLoading(false);
        },
      );
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={[]}>
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <View style={[styles.emptyIcon, { backgroundColor: theme.primaryLight }]}>
                  <Factory color={theme.primary} size={28} />
                </View>
                <ThemedText type="secondary" themeColor="textSecondary" style={styles.center}>
                  Todavía no hay distribuidores. Crea uno para asociarle los pedidos.
                </ThemedText>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Link href={`/more/purchases/distributors/${item.id}`} asChild>
              <Pressable>
                {/* Link asChild rejects style arrays on its direct child. */}
                <View>
                  <ThemedView type="backgroundElement" style={[styles.row, Shadow.subtle, !item.active && styles.dim]}>
                    <View style={[styles.iconDot, { backgroundColor: withAlpha(theme.primary, 0.12) }]}>
                      <Factory color={theme.primary} size={18} />
                    </View>
                    <View style={styles.flex}>
                      <ThemedText type="default" numberOfLines={1}>
                        {item.name}
                      </ThemedText>
                      <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                        {item.orders} {item.orders === 1 ? 'pedido' : 'pedidos'}
                        {item.city ? ` · ${item.city}` : ''}
                        {!item.active ? ' · inactivo' : ''}
                      </ThemedText>
                    </View>
                    {item.owed > 0 ? (
                      <View style={styles.right}>
                        <ThemedText type="smallBold" style={{ color: theme.error }}>
                          {formatCOP(item.owed)}
                        </ThemedText>
                        <ThemedText type="caption" themeColor="textSecondary">
                          por pagar
                        </ThemedText>
                      </View>
                    ) : null}
                    <ChevronRight color={theme.textSecondary} size={18} />
                  </ThemedView>
                </View>
              </Pressable>
            </Link>
          )}
        />

        <ThemedView
          type="backgroundElement"
          style={[styles.bottomBar, { borderTopColor: theme.border, paddingBottom: Spacing.three + insets.bottom }]}>
          <Link href="/more/purchases/distributors/new" asChild>
            <Pressable>
              <View style={[styles.primaryButton, { backgroundColor: theme.primary }]}>
                <Plus color="#FFFFFF" size={18} />
                <ThemedText type="cardTitle" style={styles.onPrimary}>
                  Nuevo distribuidor
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
  listContent: { padding: Layout.screenPadding, gap: Spacing.two },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.six },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radii.card },
  dim: { opacity: 0.6 },
  iconDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
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
