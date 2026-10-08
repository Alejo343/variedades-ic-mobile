import { useCallback, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useMySeller } from '@/hooks/use-my-seller';
import { cashAccountsRepo, directSalesRepo, sellersRepo, type DirectSale } from '@/lib/data';
import { formatCOP } from '@/lib/format';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';

export default function SalesHistoryScreen() {
  const [sales, setSales] = useState<DirectSale[]>([]);
  const [accountNames, setAccountNames] = useState<Record<number, string>>({});
  const [sellerNames, setSellerNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  // A store seller only ever sees their own sales ("Mis ventas").
  const { isSeller, seller } = useMySeller();
  const onlySellerId = isSeller ? (seller?.id ?? -1) : null;

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([directSalesRepo.list(), cashAccountsRepo.list(), sellersRepo.list()]).then(([rows, accounts, sellers]) => {
        if (!cancelled) {
          setSales(onlySellerId === null ? rows : rows.filter((s) => s.sellerId === onlySellerId));
          setAccountNames(Object.fromEntries(accounts.map((a) => [a.id, a.name])));
          setSellerNames(Object.fromEntries(sellers.map((s) => [s.id, s.name])));
          setLoading(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [onlySellerId]),
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
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
              {item.sellerId !== null && (
                <ThemedText type="small" themeColor="textSecondary">
                  {isSeller ? '' : `Vendió ${sellerNames[item.sellerId] ?? 'un vendedor'} · `}Comisión {formatCOP(item.commissionAmount)}
                </ThemedText>
              )}
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
