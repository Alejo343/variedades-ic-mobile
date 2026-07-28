import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { sellerDeliveriesRepo, sellersRepo, type SellerDelivery } from '@/lib/data';
import { formatCOP } from '@/lib/format';

export default function SellerDeliveriesScreen() {
  const [deliveries, setDeliveries] = useState<SellerDelivery[]>([]);
  const [sellerNames, setSellerNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      Promise.all([sellerDeliveriesRepo.list(), sellersRepo.list()]).then(([rows, sellers]) => {
        if (cancelled) return;
        setDeliveries(rows);
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
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <FlatList
          data={deliveries}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            !loading ? (
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                Sin entregas todavía.
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => {
            const totalCost = item.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
            const totalUnits = item.items.reduce((sum, i) => sum + i.quantity, 0);
            return (
              <ThemedView type="backgroundElement" style={styles.row}>
                <ThemedText type="default">{sellerNames[item.sellerId] ?? `Vendedor #${item.sellerId}`}</ThemedText>
                <ThemedText themeColor="textSecondary" type="small">
                  {totalUnits} unidad{totalUnits === 1 ? '' : 'es'} · {formatCOP(totalCost)} · {item.deliveryDate}
                </ThemedText>
              </ThemedView>
            );
          }}
        />

        <Link href="/more/sellers/deliveries/new" asChild>
          <Pressable>
            <ThemedView type="backgroundSelected" style={styles.newButton}>
              <ThemedText type="linkPrimary">+ Nueva entrega</ThemedText>
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
  row: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.half,
  },
  newButton: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
