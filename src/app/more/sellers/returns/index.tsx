import { useCallback, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { sellerReturnsRepo, sellersRepo, type SellerReturn } from '@/lib/data';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';

export default function SellerReturnsScreen() {
  const [returns, setReturns] = useState<SellerReturn[]>([]);
  const [sellerNames, setSellerNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([sellerReturnsRepo.list(), sellersRepo.list()]).then(([rows, sellers]) => {
        if (cancelled) return;
        setReturns(rows);
        setSellerNames(Object.fromEntries(sellers.map((s) => [s.id, s.name])));
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <FlatList
          data={returns}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            !loading ? (
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                Sin devoluciones todavía.
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => {
            const totalUnits = item.items.reduce((sum, i) => sum + i.quantity, 0);
            return (
              <ThemedView type="backgroundElement" style={styles.row}>
                <ThemedText type="default">{sellerNames[item.sellerId] ?? `Vendedor #${item.sellerId}`}</ThemedText>
                <ThemedText themeColor="textSecondary" type="small">
                  {totalUnits} unidad{totalUnits === 1 ? '' : 'es'} · {item.returnDate}
                </ThemedText>
              </ThemedView>
            );
          }}
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
  row: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.half,
  },
});
