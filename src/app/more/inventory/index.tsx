import { Link } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { inventoryRepo, productsRepo, type InventoryMovement, type Product } from '@/lib/data';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';

export default function InventoryScreen() {
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [outOfStock, setOutOfStock] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [productNames, setProductNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([
        inventoryRepo.getLowStock(),
        inventoryRepo.getOutOfStock(),
        inventoryRepo.getRecentMovements(20),
        productsRepo.list(),
      ]).then(([low, out, recent, products]) => {
        if (cancelled) return;
        setLowStock(low);
        setOutOfStock(out);
        setMovements(recent);
        setProductNames(Object.fromEntries(products.map((p) => [p.id, p.name])));
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
          data={movements}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <ThemedView style={styles.header}>
              {outOfStock.length > 0 ? (
                <ThemedView type="backgroundElement" style={styles.alertBlock}>
                  <ThemedText type="smallBold">Agotados ({outOfStock.length})</ThemedText>
                  {outOfStock.map((p) => (
                    <ThemedText key={p.id} type="small" themeColor="textSecondary">
                      {p.name}
                    </ThemedText>
                  ))}
                </ThemedView>
              ) : null}

              {lowStock.length > 0 ? (
                <ThemedView type="backgroundElement" style={styles.alertBlock}>
                  <ThemedText type="smallBold">Stock bajo ({lowStock.length})</ThemedText>
                  {lowStock.map((p) => (
                    <ThemedText key={p.id} type="small" themeColor="textSecondary">
                      {p.name} — {p.stock}/{p.minStock}
                    </ThemedText>
                  ))}
                </ThemedView>
              ) : null}

              {!loading && lowStock.length === 0 && outOfStock.length === 0 ? (
                <ThemedText themeColor="textSecondary" type="small" style={styles.noAlerts}>
                  Sin alertas de stock.
                </ThemedText>
              ) : null}

              <ThemedText type="smallBold" style={styles.sectionTitle}>
                Movimientos recientes
              </ThemedText>
            </ThemedView>
          }
          ListEmptyComponent={
            !loading ? (
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                Sin movimientos todavía.
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => (
            <ThemedView type="backgroundElement" style={styles.row}>
              <ThemedText type="small">{productNames[item.productId] ?? `Producto #${item.productId}`}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.quantityDelta > 0 ? '+' : ''}
                {item.quantityDelta} · {item.reason ?? item.type}
              </ThemedText>
            </ThemedView>
          )}
        />

        <ThemedView style={styles.actions}>
          <Link href="/more/backup" asChild>
            <Pressable style={styles.actionFlex}>
              <ThemedView type="backgroundElement" style={styles.adjustButton}>
                <ThemedText type="link">Respaldo</ThemedText>
              </ThemedView>
            </Pressable>
          </Link>
          <Link href="/more/inventory/adjust" asChild>
            <Pressable style={styles.actionFlex}>
              <ThemedView type="backgroundSelected" style={styles.adjustButton}>
                <ThemedText type="linkPrimary">+ Ajustar stock</ThemedText>
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
  header: { gap: Spacing.three, marginBottom: Spacing.two },
  alertBlock: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.half },
  noAlerts: { paddingVertical: Spacing.two },
  sectionTitle: { marginTop: Spacing.two },
  empty: { textAlign: 'center', paddingVertical: Spacing.five },
  row: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.half },
  actions: { flexDirection: 'row', gap: Spacing.two },
  actionFlex: { flex: 1 },
  adjustButton: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
