import { ReceiptText } from 'lucide-react-native';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatCOP } from '@/lib/format';

export type SaleListRow = {
  key: string;
  title: string;
  subtitle: string;
  amount: number;
  // Shown under the amount when set.
  commission?: number;
};

// The "Mis ventas" totals card a seller sees above their list.
export type SaleListSummary = { total: number; count: number; commission: number };

// Plain read-only sales list shared by the shop history (sell/history.tsx)
// and the consignment sales list (more/sellers/sales/index.tsx).
export function SaleList({
  rows,
  loading,
  emptyText,
  summary,
}: {
  rows: SaleListRow[];
  loading: boolean;
  emptyText: string;
  summary?: SaleListSummary;
}) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <FlatList
          data={rows}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            summary && rows.length > 0 ? (
              <ThemedView type="backgroundElement" style={[styles.summary, Shadow.subtle]}>
                <ThemedText type="secondary" themeColor="textSecondary">
                  Has vendido
                </ThemedText>
                <ThemedText type="bigNumber" adjustsFontSizeToFit numberOfLines={1}>
                  {formatCOP(summary.total)}
                </ThemedText>
                <ThemedText type="secondary" themeColor="textSecondary">
                  {summary.count} {summary.count === 1 ? 'venta' : 'ventas'} · {formatCOP(summary.commission)} de comisión
                </ThemedText>
              </ThemedView>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <ThemedView type="backgroundElement" style={[styles.empty, Shadow.subtle]}>
                <View style={[styles.icon, styles.emptyIcon, { backgroundColor: theme.primaryLight }]}>
                  <ReceiptText color={theme.primary} size={28} />
                </View>
                <ThemedText type="secondary" themeColor="textSecondary" style={styles.center}>
                  {emptyText}
                </ThemedText>
              </ThemedView>
            ) : null
          }
          renderItem={({ item }) => (
            <ThemedView type="backgroundElement" style={[styles.row, Shadow.subtle]}>
              <View style={[styles.icon, { backgroundColor: withAlpha(theme.success, 0.12) }]}>
                <ReceiptText color={theme.success} size={18} />
              </View>
              <View style={styles.flex}>
                <ThemedText type="small" numberOfLines={1}>
                  {item.title}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary" numberOfLines={2}>
                  {item.subtitle}
                </ThemedText>
              </View>
              <View style={styles.right}>
                <ThemedText type="smallBold">{formatCOP(item.amount)}</ThemedText>
                {item.commission !== undefined ? (
                  <ThemedText type="caption" style={{ color: theme.primary }}>
                    +{formatCOP(item.commission)} com.
                  </ThemedText>
                ) : null}
              </View>
            </ThemedView>
          )}
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
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 56, height: 56, borderRadius: 28 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radii.card },
  right: { alignItems: 'flex-end', gap: 2 },
});
