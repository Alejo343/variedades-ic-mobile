import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { cashAccountsRepo, commissionPaymentsRepo, sellersRepo, type CashAccount, type CommissionPaymentPreview, type Seller } from '@/lib/data';
import { formatCOP, todayLocalDateString } from '@/lib/format';

// Pays a store seller every commission still unpaid up to a date — an expense
// from the chosen account (see commission-payments-repo.ts).
export default function NewCommissionPaymentScreen() {
  const { sellerId: sellerIdParam } = useLocalSearchParams<{ sellerId: string }>();
  const sellerId = Number(sellerIdParam);
  const theme = useTheme();

  const [seller, setSeller] = useState<Seller | null>(null);
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [periodDate, setPeriodDate] = useState(todayLocalDateString());
  const [preview, setPreview] = useState<CommissionPaymentPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    sellersRepo.getById(sellerId).then(setSeller);
    cashAccountsRepo.list().then((rows) => {
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

  const canPay = isValidPeriodDate && accountId !== null && (preview?.totalCommission ?? 0) > 0;

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

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="small">Vendedor</ThemedText>
          <ThemedText type="default" style={styles.sellerName}>
            {seller?.name ?? `Vendedor #${sellerId}`}
          </ThemedText>

          <ThemedText type="small">Pagar hasta (YYYY-MM-DD)</ThemedText>
          <TextInput
            value={periodDate}
            onChangeText={setPeriodDate}
            placeholder="2026-10-07"
            placeholderTextColor={theme.textSecondary}
            style={inputStyle}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Incluye las comisiones de todas sus ventas hasta esta fecha que todavía no se hayan pagado.
          </ThemedText>

          <ThemedText type="small" style={styles.label}>
            Pagar desde
          </ThemedText>
          <ThemedView style={styles.accountRow}>
            {accounts.map((account) => (
              <Pressable key={account.id} style={styles.accountFlex} onPress={() => setAccountId(account.id)}>
                <ThemedView type={accountId === account.id ? 'backgroundSelected' : 'backgroundElement'} style={styles.accountButton}>
                  <ThemedText type={accountId === account.id ? 'linkPrimary' : undefined}>{account.name}</ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ThemedView>

          {isValidPeriodDate && preview ? (
            <ThemedView type="backgroundElement" style={styles.previewBlock}>
              <ThemedView style={styles.previewRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  Ventas incluidas
                </ThemedText>
                <ThemedText type="small">{preview.saleCount}</ThemedText>
              </ThemedView>
              <ThemedView style={styles.previewRow}>
                <ThemedText type="smallBold">A pagar</ThemedText>
                <ThemedText type="linkPrimary">{formatCOP(preview.totalCommission)}</ThemedText>
              </ThemedView>
            </ThemedView>
          ) : (
            <ThemedText themeColor="textSecondary" type="small" style={styles.previewBlock}>
              Escribe una fecha válida para ver lo pendiente.
            </ThemedText>
          )}

          {isValidPeriodDate && preview && preview.totalCommission <= 0 ? (
            <ThemedText themeColor="textSecondary" type="small">
              No hay comisiones pendientes hasta esa fecha.
            </ThemedText>
          ) : null}

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <Pressable onPress={handleSubmit} disabled={saving || !canPay}>
            <ThemedView type="backgroundSelected" style={[styles.submitButton, !canPay && styles.disabled]}>
              <ThemedText type="linkPrimary">{saving ? 'Pagando…' : 'Pagar comisiones'}</ThemedText>
            </ThemedView>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { padding: Spacing.four, gap: Spacing.two },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  sellerName: { marginBottom: Spacing.two },
  label: { marginTop: Spacing.two },
  accountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  accountFlex: { flexGrow: 1, flexBasis: '45%' },
  accountButton: { padding: Spacing.three, borderRadius: Spacing.three, alignItems: 'center' },
  previewBlock: {
    marginTop: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between' },
  error: { color: '#d9534f' },
  submitButton: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  disabled: { opacity: 0.5 },
});
