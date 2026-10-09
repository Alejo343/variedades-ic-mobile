import { Link, Stack } from 'expo-router';
import { ChevronRight, ClipboardList } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useMySeller } from '@/hooks/use-my-seller';
import { useTheme } from '@/hooks/use-theme';
import { sellersRepo, settlementsRepo, type Settlement } from '@/lib/data';
import { formatCOP } from '@/lib/format';

export default function SettlementsScreen() {
  const theme = useTheme();
  const { isSeller } = useMySeller();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [sellerNames, setSellerNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([settlementsRepo.list(), sellersRepo.list()]).then(([rows, sellers]) => {
        if (cancelled) return;
        setSettlements(rows);
        setSellerNames(Object.fromEntries(sellers.map((s) => [s.id, s.name])));
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const pending = settlements.filter((s) => s.status !== 'liquidada');
  const delivered = settlements.filter((s) => s.status === 'liquidada').reduce((sum, s) => sum + s.amountDue, 0);

  return (
    <ThemedView style={styles.container}>
      {isSeller ? <Stack.Screen options={{ title: 'Mis liquidaciones' }} /> : null}
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <FlatList
          data={settlements}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            isSeller && settlements.length > 0 ? (
              <ThemedView type="backgroundElement" style={[styles.summary, Shadow.subtle]}>
                <ThemedText type="secondary" themeColor="textSecondary">
                  Entregado en total
                </ThemedText>
                <ThemedText type="bigNumber" adjustsFontSizeToFit numberOfLines={1}>
                  {formatCOP(delivered)}
                </ThemedText>
                <ThemedText type="secondary" themeColor="textSecondary">
                  {pending.length > 0
                    ? `${pending.length} ${pending.length === 1 ? 'liquidación pendiente' : 'liquidaciones pendientes'} de cerrar`
                    : 'Todas tus liquidaciones están cerradas'}
                </ThemedText>
              </ThemedView>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <ThemedView type="backgroundElement" style={[styles.empty, Shadow.subtle]}>
                <View style={[styles.emptyIcon, { backgroundColor: withAlpha(theme.purple, 0.12) }]}>
                  <ClipboardList color={theme.purple} size={28} />
                </View>
                <ThemedText type="secondary" themeColor="textSecondary" style={styles.center}>
                  {isSeller
                    ? 'Todavía no tienes liquidaciones. Aparecen cuando el dueño te liquida.'
                    : 'Sin liquidaciones todavía.'}
                </ThemedText>
              </ThemedView>
            ) : null
          }
          renderItem={({ item }) => {
            const settled = item.status === 'liquidada';
            const statusColor = settled ? theme.primary : theme.warning;
            return (
              <Link href={`/more/sellers/settlements/${item.id}`} asChild>
                <Pressable>
                  {/* Link asChild rejects style arrays on its direct child. */}
                  <View>
                    <ThemedView type="backgroundElement" style={[styles.row, Shadow.subtle]}>
                      <View style={styles.flex}>
                        <ThemedText type="default">
                          {isSeller ? `Hasta el ${item.periodDate}` : (sellerNames[item.sellerId] ?? `Vendedor #${item.sellerId}`)}
                        </ThemedText>
                        <ThemedText type="caption" themeColor="textSecondary">
                          {isSeller ? `Ventas ${formatCOP(item.totalSales)}` : `Hasta el ${item.periodDate}`}
                        </ThemedText>
                      </View>
                      <View style={styles.right}>
                        <ThemedText type="smallBold">{formatCOP(item.amountDue)}</ThemedText>
                        <View style={[styles.chip, { backgroundColor: withAlpha(statusColor, 0.12) }]}>
                          <ThemedText type="caption" style={{ color: statusColor }}>
                            {settled ? 'Liquidada' : 'Pendiente'}
                          </ThemedText>
                        </View>
                      </View>
                      <ChevronRight color={theme.textSecondary} size={18} />
                    </ThemedView>
                  </View>
                </Pressable>
              </Link>
            );
          }}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  listContent: { padding: Layout.screenPadding, gap: Spacing.two, paddingBottom: Spacing.six },
  flex: { flex: 1, gap: 2 },
  center: { textAlign: 'center' },
  summary: { borderRadius: Radii.card, padding: Spacing.four, gap: Spacing.one, marginBottom: Spacing.two },
  empty: { borderRadius: Radii.card, padding: Spacing.five, alignItems: 'center', gap: Spacing.two },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radii.card },
  right: { alignItems: 'flex-end', gap: Spacing.one },
  chip: { borderRadius: Radii.chip, paddingHorizontal: Spacing.two, paddingVertical: 2 },
});
