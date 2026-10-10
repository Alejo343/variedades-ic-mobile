import { router, useLocalSearchParams } from 'expo-router';
import { Banknote, Landmark } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateChoice } from '@/components/date-choice';
import { FormSection } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  cashAccountsRepo,
  commissionPaymentsRepo,
  sellersRepo,
  type CashAccountWithBalance,
  type CommissionPaymentPreview,
  type Seller,
} from '@/lib/data';
import { formatCOP, todayLocalDateString } from '@/lib/format';

// Pays a store seller every commission still unpaid up to a date — an expense
// from the chosen account (see commission-payments-repo.ts).
export default function NewCommissionPaymentScreen() {
  const { sellerId: sellerIdParam } = useLocalSearchParams<{ sellerId: string }>();
  const sellerId = Number(sellerIdParam);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [seller, setSeller] = useState<Seller | null>(null);
  const [accounts, setAccounts] = useState<CashAccountWithBalance[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [periodDate, setPeriodDate] = useState(todayLocalDateString());
  const [preview, setPreview] = useState<CommissionPaymentPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    sellersRepo.getById(sellerId).then(setSeller);
    cashAccountsRepo.listWithBalances().then((rows) => {
      const active = rows.filter((a) => a.active);
      setAccounts(active);
      setAccountId((current) => current ?? active[0]?.id ?? null);
    });
  }, [sellerId]);

  const isValidPeriodDate = /^\d{4}-\d{2}-\d{2}$/.test(periodDate);

  useEffect(() => {
    if (!isValidPeriodDate) return;
    let cancelled = false;
    commissionPaymentsRepo.preview(sellerId, periodDate).then((result) => {
      if (!cancelled) setPreview(result);
    });
    return () => {
      cancelled = true;
    };
  }, [sellerId, periodDate, isValidPeriodDate]);

  const amount = preview?.totalCommission ?? 0;
  const canPay = isValidPeriodDate && accountId !== null && amount > 0 && !saving;

  async function handleSubmit() {
    if (!canPay || accountId === null) return;
    setError(null);
    setSaving(true);
    try {
      await commissionPaymentsRepo.create({ sellerId, periodDate, accountId });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el pago');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={[]}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <ThemedText type="cardTitle">{seller?.name ?? 'Vendedor'}</ThemedText>

          <FormSection title="Pagar hasta">
            <DateChoice value={periodDate} onChange={setPeriodDate} />
            <ThemedText type="caption" themeColor="textSecondary">
              Cubre las comisiones de todas sus ventas hasta esta fecha que todavía no se hayan pagado.
            </ThemedText>
          </FormSection>

          {isValidPeriodDate && preview ? (
            <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
              <ThemedText type="secondary" themeColor="textSecondary">
                A pagar
              </ThemedText>
              <ThemedText type="bigNumber" style={{ color: theme.purple }} adjustsFontSizeToFit numberOfLines={1}>
                {formatCOP(amount)}
              </ThemedText>
              <ThemedText type="secondary" themeColor="textSecondary">
                {amount > 0
                  ? `${preview.saleCount} ${preview.saleCount === 1 ? 'venta' : 'ventas'} sin pagar`
                  : 'No hay comisiones pendientes hasta esa fecha.'}
              </ThemedText>
            </ThemedView>
          ) : null}

          <FormSection title="Sale de">
            <View style={styles.accountRow}>
              {accounts.map((account) => {
                const selected = accountId === account.id;
                const Icon = account.type === 'banco' ? Landmark : Banknote;
                return (
                  <Pressable key={account.id} style={styles.accountFlex} onPress={() => setAccountId(account.id)}>
                    <View
                      style={[
                        styles.accountButton,
                        selected
                          ? { backgroundColor: withAlpha(theme.purple, 0.1), borderColor: theme.purple }
                          : { backgroundColor: theme.background, borderColor: theme.border },
                      ]}>
                      <Icon color={selected ? theme.purple : theme.textSecondary} size={18} />
                      <View style={styles.flex}>
                        <ThemedText type={selected ? 'smallBold' : 'small'} numberOfLines={1} style={{ color: selected ? theme.purple : theme.text }}>
                          {account.name}
                        </ThemedText>
                        <ThemedText type="caption" themeColor="textSecondary">
                          {formatCOP(account.balance)}
                        </ThemedText>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </FormSection>

          {error ? (
            <View style={[styles.note, { backgroundColor: withAlpha(theme.error, 0.08) }]}>
              <ThemedText type="small" style={{ color: theme.error }}>
                {error}
              </ThemedText>
            </View>
          ) : null}
        </ScrollView>

        <ThemedView
          type="backgroundElement"
          style={[styles.bottomBar, { borderTopColor: theme.border, paddingBottom: Spacing.three + insets.bottom }]}>
          <Pressable onPress={handleSubmit} disabled={!canPay}>
            <View style={[styles.primaryButton, { backgroundColor: theme.purple }, !canPay && styles.disabled]}>
              <ThemedText type="cardTitle" style={styles.onPrimary}>
                {saving ? 'Pagando…' : amount > 0 ? `Pagar ${formatCOP(amount)}` : 'Pagar comisiones'}
              </ThemedText>
            </View>
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { padding: Layout.screenPadding, gap: Layout.cardGap, paddingBottom: Spacing.five },
  card: { borderRadius: Radii.card, padding: Spacing.four, gap: Spacing.one },
  accountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  accountFlex: { flexGrow: 1, flexBasis: '45%' },
  accountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderRadius: Radii.button,
    padding: Spacing.three,
  },
  note: { borderRadius: Spacing.three, padding: Spacing.three },
  bottomBar: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.three, borderTopWidth: 1 },
  primaryButton: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Radii.buttonPrimary },
  onPrimary: { color: '#FFFFFF' },
  disabled: { opacity: 0.5 },
});
