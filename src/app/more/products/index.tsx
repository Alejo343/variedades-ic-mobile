import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { productsRepo, type Product } from '@/lib/data';
import { formatCOP, stockLabel } from '@/lib/format';
import { resolveImageUri } from '@/lib/sync/image-url';
import { pendingUuidsForType } from '@/lib/sync/outbox';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [pendingUuids, setPendingUuids] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([productsRepo.list(), pendingUuidsForType('upsertProduct')]).then(([rows, pending]) => {
        if (!cancelled) {
          setProducts(rows);
          setPendingUuids(pending);
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
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <FlatList
          data={products}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            !loading ? (
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                Sin productos todavía.
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => (
            <Link href={{ pathname: '/more/products/[id]', params: { id: String(item.id) } }} asChild>
              <Pressable>
                <ThemedView type="backgroundElement" style={styles.row}>
                  {item.primaryImageUri ? (
                    <Image source={{ uri: resolveImageUri(item.primaryImageUri) }} style={styles.thumb} />
                  ) : (
                    <ThemedView type="backgroundSelected" style={styles.thumb} />
                  )}
                  <ThemedView style={styles.rowInfo}>
                    <ThemedText numberOfLines={1}>
                      {item.name}
                      {!item.active ? ' · inactivo' : ''}
                    </ThemedText>
                    <ThemedText themeColor="textSecondary" type="small">
                      {item.sku}
                      {pendingUuids.has(item.uuid) ? ' (pendiente)' : ''} · {formatCOP(item.price)}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Stock: {item.stock}
                      {stockLabel(item.stock, item.minStock)}
                    </ThemedText>
                  </ThemedView>
                </ThemedView>
              </Pressable>
            </Link>
          )}
        />

        <ThemedView style={styles.actions}>
          <Link href="/more/products/categories" asChild>
            <Pressable style={styles.actionFlex}>
              <ThemedView type="backgroundElement" style={styles.actionInner}>
                <ThemedText type="link">Categorías</ThemedText>
              </ThemedView>
            </Pressable>
          </Link>
          <Link href="/more/products/new" asChild>
            <Pressable style={styles.actionFlex}>
              <ThemedView type="backgroundSelected" style={styles.actionInner}>
                <ThemedText type="linkPrimary">+ Nuevo producto</ThemedText>
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
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
  },
  thumb: { width: 48, height: 48, borderRadius: Spacing.two },
  rowInfo: { flex: 1, gap: Spacing.half },
  actions: { flexDirection: 'row', gap: Spacing.two },
  actionFlex: { flex: 1 },
  actionInner: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
