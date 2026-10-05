import { Link } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { cashAccountsRepo, type CashAccountWithBalance } from '@/lib/data';
import { formatCOP } from '@/lib/format';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';

export default function CashAccountsScreen() {
  const [accounts, setAccounts] = useState<CashAccountWithBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      cashAccountsRepo.listWithBalances().then((rows) => {
        if (!cancelled) {
          setAccounts(rows);
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
          data={accounts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            !loading ? (
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                Sin cuentas todavía.
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => (
            <Link href={`/more/cash/accounts/${item.id}`} asChild>
              <Pressable>
                <ThemedView type="backgroundElement" style={styles.row}>
                  <ThemedText type="default">{item.name}</ThemedText>
                  <ThemedText themeColor="textSecondary" type="small">
                    {formatCOP(item.balance)} · {item.type === 'efectivo' ? 'efectivo' : 'banco'}
                    {!item.active ? ' · inactiva' : ''}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </Link>
          )}
        />

        <Link href="/more/cash/accounts/new" asChild>
          <Pressable>
            <ThemedView type="backgroundSelected" style={styles.newButton}>
              <ThemedText type="linkPrimary">+ Nueva cuenta</ThemedText>
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
