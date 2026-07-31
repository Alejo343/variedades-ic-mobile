import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { cashAccountsRepo, cashRepo, type CashMovement } from '@/lib/data';
import { formatCOP } from '@/lib/format';

export default function CashScreen() {
  const [balance, setBalance] = useState(0);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [accountNames, setAccountNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      Promise.all([cashRepo.getBalance(), cashRepo.list(), cashAccountsRepo.list()]).then(([currentBalance, rows, accounts]) => {
        if (cancelled) return;
        setBalance(currentBalance);
        setMovements(rows);
        setAccountNames(Object.fromEntries(accounts.map((a) => [a.id, a.name])));
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
                {formatCOP(item.amount)} · {item.movementDate} · {accountNames[item.accountId] ?? `Cuenta #${item.accountId}`}
              </ThemedText>
            </ThemedView>
          )}
        />

        <ThemedView style={styles.actions}>
          <Link href="/more/reports" asChild>
            <Pressable style={styles.actionFlex}>
              <ThemedView type="backgroundElement" style={styles.addButton}>
                <ThemedText type="link">Ver reportes</ThemedText>
              </ThemedView>
            </Pressable>
          </Link>
          <Link href="/more/cash/accounts" asChild>
            <Pressable style={styles.actionFlex}>
              <ThemedView type="backgroundElement" style={styles.addButton}>
                <ThemedText type="link">Gestionar cuentas</ThemedText>
              </ThemedView>
            </Pressable>
          </Link>
        </ThemedView>
        <ThemedView style={styles.actions}>
          <Link href="/more/cash/new" asChild>
            <Pressable style={styles.actionFlex}>
              <ThemedView type="backgroundSelected" style={styles.addButton}>
                <ThemedText type="linkPrimary">+ Registrar movimiento</ThemedText>
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
  balanceBlock: { padding: Spacing.four, borderRadius: Spacing.three, alignItems: 'center', marginBottom: Spacing.three, gap: Spacing.one },
  balanceAmount: { fontSize: 28 },
  empty: { textAlign: 'center', paddingVertical: Spacing.five },
  row: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.half },
  actions: { flexDirection: 'row', gap: Spacing.two },
  actionFlex: { flex: 1 },
  addButton: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
