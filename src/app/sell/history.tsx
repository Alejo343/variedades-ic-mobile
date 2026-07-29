import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { cashAccountsRepo, directSalesRepo, type DirectSale } from '@/lib/data';
import { formatCOP } from '@/lib/format';

export default function SalesHistoryScreen() {
  const [sales, setSales] = useState<DirectSale[]>([]);
  const [accountNames, setAccountNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      Promise.all([directSalesRepo.list(), cashAccountsRepo.list()]).then(([rows, accounts]) => {
        if (!cancelled) {
          setSales(rows);
          setAccountNames(Object.fromEntries(accounts.map((a) => [a.id, a.name])));
          setLoading(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <FlatList
          data={sales}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            !loading ? (
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                Sin ventas todavía.
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => (
            <ThemedView type="backgroundElement" style={styles.row}>
              <ThemedText type="small">
                Venta #{item.id} · {item.items.length} {item.items.length === 1 ? 'producto' : 'productos'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatCOP(item.totalAmount)} · {item.saleDate} · {accountNames[item.accountId] ?? `Cuenta #${item.accountId}`}
              </ThemedText>
            </ThemedView>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  listContent: { gap: Spacing.two },
  empty: { textAlign: 'center', paddingVertical: Spacing.five },
  row: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.half },
});
