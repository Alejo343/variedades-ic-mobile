import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { distributorsRepo, purchaseOrdersRepo, type PurchaseOrder } from '@/lib/data';
import { formatCOP } from '@/lib/format';

const STATUS_LABELS: Record<PurchaseOrder['status'], string> = {
  pendiente: 'pendiente',
  en_viaje: 'en camino',
  recibido: 'recibido',
  cancelado: 'cancelado',
};

export default function PurchasesScreen() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [distributorNames, setDistributorNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      Promise.all([purchaseOrdersRepo.list(), distributorsRepo.list()]).then(([rows, distributors]) => {
        if (cancelled) return;
        setOrders(rows);
        setDistributorNames(Object.fromEntries(distributors.map((d) => [d.id, d.name])));
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
          data={orders}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            !loading ? (
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                Sin pedidos todavía.
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => (
            <Link href={`/more/purchases/${item.id}`} asChild>
              <Pressable>
                <ThemedView type="backgroundElement" style={styles.row}>
                  <ThemedText type="default">
                    {item.distributorId ? (distributorNames[item.distributorId] ?? `Distribuidor #${item.distributorId}`) : 'Sin distribuidor'}
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" type="small">
                    {formatCOP(item.totalCost)} · {item.purchaseType === 'credito' ? 'crédito' : 'contado'} · {STATUS_LABELS[item.status]}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </Link>
          )}
        />

        <ThemedView style={styles.actions}>
          <Link href="/more/purchases/distributors" asChild>
            <Pressable style={styles.actionFlex}>
              <ThemedView type="backgroundElement" style={styles.newButton}>
                <ThemedText type="link">Distribuidores</ThemedText>
              </ThemedView>
            </Pressable>
          </Link>
          <Link href="/more/purchases/new" asChild>
            <Pressable style={styles.actionFlex}>
              <ThemedView type="backgroundSelected" style={styles.newButton}>
                <ThemedText type="linkPrimary">+ Nuevo pedido</ThemedText>
              </ThemedView>
            </Pressable>
          </Link>
        </ThemedView>
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
  actions: { flexDirection: 'row', gap: Spacing.two },
  actionFlex: { flex: 1 },
  newButton: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
