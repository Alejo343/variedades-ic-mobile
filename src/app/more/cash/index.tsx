import { Link, Stack } from 'expo-router';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  ChartColumn,
  ClipboardList,
  HandCoins,
  Landmark,
  Minus,
  Plus,
  Scale,
  Settings2,
  ShoppingCart,
  Truck,
  Wallet,
  type LucideProps,
} from 'lucide-react-native';
import { useCallback, useMemo, useState, type ComponentType } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormChip } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useTheme } from '@/hooks/use-theme';
import { cashAccountsRepo, cashRepo, type CashAccountWithBalance, type CashMovement } from '@/lib/data';
import { isBusinessCashMovement, isCashAdjustment, isCashTransfer } from '@/lib/domain/cash';
import { dayLabel, formatCOP, formatTime, localDateKey, todayLocalDateString } from '@/lib/format';

type Filter = 'all' | 'ingreso' | 'gasto' | 'transferencia' | 'ajuste';

function matchesFilter(m: CashMovement, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'transferencia') return isCashTransfer(m);
  if (filter === 'ajuste') return isCashAdjustment(m);
  // Ingresos / Gastos: real business movements only.
  return isBusinessCashMovement(m) && m.type === filter;
}

// Where a movement came from, for its icon. Manual ones show the direction.
function sourceIcon(movement: CashMovement): ComponentType<LucideProps> {
  if (isCashTransfer(movement)) return ArrowLeftRight;
  if (isCashAdjustment(movement)) return Scale;
  switch (movement.sourceType) {
    case 'direct_sale':
      return ShoppingCart;
    case 'settlement':
      return ClipboardList;
    case 'purchase_payment':
      return Truck;
    case 'commission_payment':
      return HandCoins;
    default:
      return movement.type === 'ingreso' ? ArrowDownLeft : ArrowUpRight;
  }
}

export default function CashScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [balance, setBalance] = useState(0);
  const [accounts, setAccounts] = useState<CashAccountWithBalance[]>([]);
  const [accountNames, setAccountNames] = useState<Record<number, string>>({});
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [accountFilter, setAccountFilter] = useState<number | null>(null);

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([cashRepo.getBalance(), cashRepo.list(), cashAccountsRepo.listWithBalances()]).then(([total, rows, withBalances]) => {
        if (cancelled) return;
        setBalance(total);
        setMovements(rows);
        // Inactive accounts with no money left aren't worth a card.
        setAccounts(withBalances.filter((a) => a.active || a.balance !== 0));
        // Names from every account: old movements may belong to a hidden one.
        setAccountNames(Object.fromEntries(withBalances.map((a) => [a.id, a.name])));
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const today = todayLocalDateString();
  const hasTransfers = movements.some(isCashTransfer);
  const hasAdjustments = movements.some(isCashAdjustment);

  const todayTotals = useMemo(() => {
    const totals = { income: 0, expense: 0 };
    for (const m of movements) {
      // Transfers and adjustments move balances but aren't money in/out.
      if (!isBusinessCashMovement(m) || localDateKey(m.movementDate) !== today) continue;
      if (m.type === 'ingreso') totals.income += m.amount;
      else totals.expense += m.amount;
    }
    return totals;
  }, [movements, today]);

  // Grouped by local day, newest first, each with its own net.
  const days = useMemo(() => {
    const visible = movements.filter(
      (m) => matchesFilter(m, filter) && (accountFilter === null || m.accountId === accountFilter),
    );
    const groups = new Map<string, CashMovement[]>();
    for (const m of [...visible].sort((a, b) => (a.movementDate < b.movementDate ? 1 : -1))) {
      const key = localDateKey(m.movementDate);
      groups.set(key, [...(groups.get(key) ?? []), m]);
    }
    return [...groups.entries()].map(([key, rows]) => ({
      key,
      rows,
      net: rows.reduce((sum, m) => sum + (m.type === 'ingreso' ? m.amount : -m.amount), 0),
    }));
  }, [movements, filter, accountFilter]);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/more/reports" asChild>
              <Pressable hitSlop={8} style={styles.headerAction}>
                <ChartColumn color={theme.primary} size={18} />
                <ThemedText type="smallBold" style={{ color: theme.primary }}>
                  Reportes
                </ThemedText>
              </Pressable>
            </Link>
          ),
        }}
      />
      <SafeAreaView style={styles.flex} edges={[]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
            <ThemedText type="secondary" themeColor="textSecondary">
              Saldo total
            </ThemedText>
            <ThemedText
              type="bigNumber"
              style={{ color: balance < 0 ? theme.error : theme.text }}
              adjustsFontSizeToFit
              numberOfLines={1}>
              {formatCOP(balance)}
            </ThemedText>
            <View style={styles.todayRow}>
              <ThemedText type="caption" themeColor="textSecondary">
                Hoy
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.primary }}>
                +{formatCOP(todayTotals.income)} entró
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.error }}>
                −{formatCOP(todayTotals.expense)} salió
              </ThemedText>
            </View>
          </ThemedView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accounts}>
            {accounts.map((account) => {
              const selected = accountFilter === account.id;
              const Icon = account.type === 'banco' ? Landmark : Banknote;
              return (
                <Pressable key={account.id} onPress={() => setAccountFilter(selected ? null : account.id)}>
                  <ThemedView
                    type="backgroundElement"
                    style={[styles.accountCard, Shadow.subtle, { borderColor: selected ? theme.primary : 'transparent' }]}>
                    <View style={[styles.iconDot, { backgroundColor: withAlpha(theme.primary, 0.12) }]}>
                      <Icon color={theme.primary} size={16} />
                    </View>
                    <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                      {account.name}
                      {!account.active ? ' · inactiva' : ''}
                    </ThemedText>
                    <ThemedText type="cardTitle" style={account.balance < 0 ? { color: theme.error } : undefined} numberOfLines={1}>
                      {formatCOP(account.balance)}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              );
            })}
            <Link href="/more/cash/accounts" asChild>
              <Pressable>
                <View style={[styles.accountCard, styles.manageCard, { borderColor: theme.border }]}>
                  <Settings2 color={theme.textSecondary} size={20} />
                  <ThemedText type="caption" themeColor="textSecondary">
                    Gestionar cuentas
                  </ThemedText>
                </View>
              </Pressable>
            </Link>
          </ScrollView>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText type="sectionTitle" style={styles.flex}>
                Movimientos
              </ThemedText>
              {accountFilter !== null ? (
                <Pressable onPress={() => setAccountFilter(null)} hitSlop={6}>
                  <ThemedText type="caption" style={{ color: theme.primary }}>
                    {accountNames[accountFilter] ?? 'Cuenta'} · quitar filtro
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <FormChip label="Todos" selected={filter === 'all'} onPress={() => setFilter('all')} />
              <FormChip label="Ingresos" selected={filter === 'ingreso'} onPress={() => setFilter('ingreso')} />
              <FormChip label="Gastos" selected={filter === 'gasto'} onPress={() => setFilter('gasto')} />
              {hasTransfers ? (
                <FormChip label="Transferencias" selected={filter === 'transferencia'} onPress={() => setFilter('transferencia')} />
              ) : null}
              {hasAdjustments ? <FormChip label="Ajustes" selected={filter === 'ajuste'} onPress={() => setFilter('ajuste')} /> : null}
            </ScrollView>

            {!loading && days.length === 0 ? (
              <View style={styles.empty}>
                <View style={[styles.emptyIcon, { backgroundColor: theme.primaryLight }]}>
                  <Wallet color={theme.primary} size={28} />
                </View>
                <ThemedText type="secondary" themeColor="textSecondary" style={styles.center}>
                  {movements.length === 0 ? 'Todavía no hay movimientos de caja.' : 'Ningún movimiento con este filtro.'}
                </ThemedText>
              </View>
            ) : null}

            {days.map((day) => (
              <View key={day.key} style={styles.dayGroup}>
                <View style={styles.dayHeader}>
                  <ThemedText type="smallBold" style={styles.flex}>
                    {dayLabel(day.key, today)}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: day.net < 0 ? theme.error : theme.primary }}>
                    {day.net > 0 ? '+' : day.net < 0 ? '−' : ''}
                    {formatCOP(Math.abs(day.net))}
                  </ThemedText>
                </View>
                <ThemedView type="backgroundElement" style={[styles.listCard, Shadow.subtle]}>
                  {day.rows.map((movement, i) => {
                    const income = movement.type === 'ingreso';
                    // Transfers/adjustments in a neutral color: not money in/out.
                    const color = !isBusinessCashMovement(movement) ? theme.info : income ? theme.primary : theme.error;
                    const Icon = sourceIcon(movement);
                    return (
                      <View key={movement.id} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                        <View style={[styles.iconDot, { backgroundColor: withAlpha(color, 0.12) }]}>
                          <Icon color={color} size={16} />
                        </View>
                        <View style={styles.flex}>
                          <ThemedText type="small" numberOfLines={1}>
                            {movement.concept}
                          </ThemedText>
                          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                            {accountNames[movement.accountId] ?? `Cuenta #${movement.accountId}`} · {formatTime(movement.movementDate)}
                          </ThemedText>
                        </View>
                        <ThemedText type="smallBold" style={{ color }}>
                          {income ? '+' : '−'}
                          {formatCOP(movement.amount)}
                        </ThemedText>
                      </View>
                    );
                  })}
                </ThemedView>
              </View>
            ))}
          </View>
        </ScrollView>

        <ThemedView
          type="backgroundElement"
          style={[styles.bottomBar, { borderTopColor: theme.border, paddingBottom: Spacing.three + insets.bottom }]}>
          <Link href="/more/cash/new?type=ingreso" asChild>
            <Pressable style={styles.flex}>
              <View style={[styles.actionButton, { borderColor: theme.primary, backgroundColor: theme.primaryLight }]}>
                <Plus color={theme.primary} size={18} />
                <ThemedText type="cardTitle" style={{ color: theme.primary }}>
                  Ingreso
                </ThemedText>
              </View>
            </Pressable>
          </Link>
          <Link href="/more/cash/new?type=gasto" asChild>
            <Pressable style={styles.flex}>
              <View style={[styles.actionButton, { borderColor: theme.error, backgroundColor: withAlpha(theme.error, 0.08) }]}>
                <Minus color={theme.error} size={18} />
                <ThemedText type="cardTitle" style={{ color: theme.error }}>
                  Gasto
                </ThemedText>
              </View>
            </Pressable>
          </Link>
          <Link href="/more/cash/transfer" asChild>
            <Pressable style={styles.flex}>
              <View style={[styles.actionButton, { borderColor: theme.info, backgroundColor: withAlpha(theme.info, 0.08) }]}>
                <ArrowLeftRight color={theme.info} size={18} />
                <ThemedText type="cardTitle" style={{ color: theme.info }}>
                  Transferir
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
  headerAction: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  scrollContent: { padding: Layout.screenPadding, gap: Layout.cardGap, paddingBottom: Spacing.five },
  card: { borderRadius: Radii.card, padding: Spacing.four, gap: Spacing.one },
  todayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  accounts: { gap: Spacing.two, paddingVertical: Spacing.one, paddingRight: Spacing.four },
  accountCard: { width: 148, borderRadius: Radii.card, borderWidth: 1.5, padding: Spacing.three, gap: Spacing.one },
  manageCard: { borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', width: 112 },
  iconDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  section: { gap: Spacing.two },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  chips: { flexDirection: 'row', gap: Spacing.two },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  dayGroup: { gap: Spacing.one, marginTop: Spacing.one },
  dayHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.one },
  listCard: { borderRadius: Radii.card, paddingHorizontal: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  bottomBar: { flexDirection: 'row', gap: Spacing.two, paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.three, borderTopWidth: 1 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderRadius: Radii.buttonPrimary,
    paddingVertical: Spacing.three,
  },
});
