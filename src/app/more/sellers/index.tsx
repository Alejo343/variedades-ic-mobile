import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { sellersRepo, type Seller } from '@/lib/data';

function formatCommission(seller: Seller): string {
  if (seller.commissionType === 'percentage') {
    return `${(seller.commissionValue / 100).toFixed(2)}% por venta`;
  }
  return `$${seller.commissionValue} por unidad`;
}

export default function SellersScreen() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      sellersRepo.list().then((rows) => {
        if (!cancelled) {
          setSellers(rows);
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
          data={sellers}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            !loading ? (
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                Sin vendedores todavía.
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => (
            <Link href={`/more/sellers/${item.id}`} asChild>
              <Pressable>
                <ThemedView type="backgroundElement" style={styles.row}>
                  <ThemedText type="default">{item.name}</ThemedText>
                  <ThemedText themeColor="textSecondary" type="small">
                    {formatCommission(item)}
                    {item.city ? ` · ${item.city}` : ''}
                    {!item.active ? ' · inactivo' : ''}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </Link>
          )}
        />

        <ThemedView style={styles.actions}>
          <Link href="/more/sellers/deliveries" asChild>
            <Pressable style={styles.actionFlex}>
              <ThemedView type="backgroundElement" style={styles.newButton}>
                <ThemedText type="link">Entregas</ThemedText>
              </ThemedView>
            </Pressable>
          </Link>
          <Link href="/more/sellers/sales" asChild>
            <Pressable style={styles.actionFlex}>
              <ThemedView type="backgroundElement" style={styles.newButton}>
                <ThemedText type="link">Ventas</ThemedText>
              </ThemedView>
            </Pressable>
          </Link>
        </ThemedView>

        <ThemedView style={styles.actions}>
          <Link href="/more/sellers/returns" asChild>
            <Pressable style={styles.actionFlex}>
              <ThemedView type="backgroundElement" style={styles.newButton}>
                <ThemedText type="link">Devoluciones</ThemedText>
              </ThemedView>
            </Pressable>
          </Link>
          <Link href="/more/sellers/losses" asChild>
            <Pressable style={styles.actionFlex}>
              <ThemedView type="backgroundElement" style={styles.newButton}>
                <ThemedText type="link">Pérdidas</ThemedText>
              </ThemedView>
            </Pressable>
          </Link>
        </ThemedView>

        <Link href="/more/sellers/settlements" asChild>
          <Pressable>
            <ThemedView type="backgroundElement" style={styles.newButton}>
              <ThemedText type="link">Liquidaciones</ThemedText>
            </ThemedView>
          </Pressable>
        </Link>

        <Link href="/more/sellers/new" asChild>
          <Pressable>
            <ThemedView type="backgroundSelected" style={styles.newButton}>
              <ThemedText type="linkPrimary">+ Nuevo vendedor</ThemedText>
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
  actions: { flexDirection: 'row', gap: Spacing.two },
  actionFlex: { flex: 1 },
  newButton: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
