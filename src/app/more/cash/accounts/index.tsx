import { Link } from 'expo-router';
import { Banknote, ChevronRight, Landmark, Plus, Wallet } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useTheme } from '@/hooks/use-theme';
import { cashAccountsRepo, type CashAccountWithBalance } from '@/lib/data';
import { formatCOP } from '@/lib/format';

export default function CashAccountsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [accounts, setAccounts] = useState<CashAccountWithBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      cashAccountsRepo.listWithBalances().then((rows) => {
        if (cancelled) return;
        // Active first, then by name.
        setAccounts([...rows].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)));
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const total = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={[]}>
        <FlatList
          data={accounts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            accounts.length > 0 ? (
              <ThemedText type="secondary" themeColor="textSecondary" style={styles.header}>
                {accounts.length} {accounts.length === 1 ? 'cuenta' : 'cuentas'} · {formatCOP(total)} en total
              </ThemedText>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <View style={[styles.emptyIcon, { backgroundColor: theme.primaryLight }]}>
                  <Wallet color={theme.primary} size={28} />
                </View>
                <ThemedText type="secondary" themeColor="textSecondary" style={styles.center}>
                  Todavía no hay cuentas. Crea una para registrar ventas y movimientos.
                </ThemedText>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const Icon = item.type === 'banco' ? Landmark : Banknote;
            const tint = item.active ? theme.primary : theme.textSecondary;
            return (
              <Link href={`/more/cash/accounts/${item.id}`} asChild>
                <Pressable>
                  {/* Link asChild rejects style arrays on its direct child. */}
                  <View>
                    <ThemedView type="backgroundElement" style={[styles.row, Shadow.subtle, !item.active && styles.inactive]}>
                      <View style={[styles.iconDot, { backgroundColor: withAlpha(tint, 0.12) }]}>
                        <Icon color={tint} size={20} />
                      </View>
                      <View style={styles.flex}>
                        <ThemedText type="default" numberOfLines={1}>
                          {item.name}
                        </ThemedText>
                        <ThemedText type="caption" themeColor="textSecondary">
                          {item.type === 'banco' ? 'Banco' : 'Efectivo'}
                          {!item.active ? ' · inactiva' : ''}
                        </ThemedText>
                      </View>
                      <ThemedText type="cardTitle" style={item.balance < 0 ? { color: theme.error } : undefined}>
                        {formatCOP(item.balance)}
                      </ThemedText>
                      <ChevronRight color={theme.textSecondary} size={18} />
                    </ThemedView>
                  </View>
                </Pressable>
              </Link>
            );
          }}
        />

        <ThemedView
          type="backgroundElement"
          style={[styles.bottomBar, { borderTopColor: theme.border, paddingBottom: Spacing.three + insets.bottom }]}>
          <Link href="/more/cash/accounts/new" asChild>
            <Pressable>
              <View style={[styles.primaryButton, { backgroundColor: theme.primary }]}>
                <Plus color="#FFFFFF" size={18} />
                <ThemedText type="cardTitle" style={styles.onPrimary}>
                  Nueva cuenta
                </ThemedText>
              </View>
            </Pressable>
          </Link>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  listContent: { padding: Layout.screenPadding, gap: Spacing.two },
  header: { marginBottom: Spacing.one },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.six },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radii.card },
  inactive: { opacity: 0.6 },
  iconDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bottomBar: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.three, borderTopWidth: 1 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Radii.buttonPrimary,
  },
  onPrimary: { color: '#FFFFFF' },
});
