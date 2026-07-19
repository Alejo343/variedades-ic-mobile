import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { directSalesRepo, type DirectSale } from '@/lib/data';
import { formatCOP } from '@/lib/format';

export default function DirectSalesScreen() {
  const [sales, setSales] = useState<DirectSale[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      directSalesRepo.list().then((rows) => {
        if (!cancelled) {
          setSales(rows);
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
                {formatCOP(item.totalAmount)} · {item.saleDate}
              </ThemedText>
            </ThemedView>
          )}
        />

        <Link href="/direct-sales/new" asChild>
          <Pressable>
            <ThemedView type="backgroundSelected" style={styles.addButton}>
              <ThemedText type="linkPrimary">+ Nueva venta</ThemedText>
            </ThemedView>
          </Pressable>
        </Link>
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
  addButton: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
