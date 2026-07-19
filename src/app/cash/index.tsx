import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { cashRepo, type CashMovement } from '@/lib/data';
import { formatCOP } from '@/lib/format';

export default function CashScreen() {
  const [balance, setBalance] = useState(0);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      Promise.all([cashRepo.getBalance(), cashRepo.list()]).then(([currentBalance, rows]) => {
        if (cancelled) return;
        setBalance(currentBalance);
        setMovements(rows);
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
          data={movements}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <ThemedView type="backgroundElement" style={styles.balanceBlock}>
              <ThemedText themeColor="textSecondary" type="small">
                Saldo actual
              </ThemedText>
              <ThemedText type="linkPrimary" style={styles.balanceAmount}>
                {formatCOP(balance)}
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
              <ThemedText type="small">{item.concept}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.type === 'ingreso' ? '+' : '-'}
                {formatCOP(item.amount)} · {item.movementDate}
              </ThemedText>
            </ThemedView>
          )}
        />

        <Link href="/cash/new" asChild>
          <Pressable>
            <ThemedView type="backgroundSelected" style={styles.addButton}>
              <ThemedText type="linkPrimary">+ Registrar movimiento</ThemedText>
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
  balanceBlock: { padding: Spacing.four, borderRadius: Spacing.three, alignItems: 'center', marginBottom: Spacing.three, gap: Spacing.one },
  balanceAmount: { fontSize: 28 },
  empty: { textAlign: 'center', paddingVertical: Spacing.five },
  row: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.half },
  addButton: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
