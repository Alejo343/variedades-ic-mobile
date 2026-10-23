import { router, useLocalSearchParams } from 'expo-router';
import { Banknote, Landmark } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormChip, FormInput, FormSection } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { cashAccountsRepo, salaryPaymentsRepo, sellersRepo, type CashAccountWithBalance, type Seller } from '@/lib/data';
import { formatSalaryPeriod, SALARY_PERIOD_LABEL } from '@/lib/domain/salary';
import { formatCOP, todayLocalDateString } from '@/lib/format';
import { salarySummary, type SalarySummary } from '@/lib/salary-summary';

// Pays one period of a salaried store seller's salary — an expense from the
// chosen account (see salary-payments-repo.ts). The amount starts at the
// configured salary and can be changed (advance, absence, bonus).
export default function NewSalaryPaymentScreen() {
  const { sellerId: sellerIdParam } = useLocalSearchParams<{ sellerId: string }>();
  const sellerId = Number(sellerIdParam);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [seller, setSeller] = useState<Seller | null>(null);
  const [summary, setSummary] = useState<SalarySummary | null>(null);
  const [accounts, setAccounts] = useState<CashAccountWithBalance[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [periodStart, setPeriodStart] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([sellersRepo.getById(sellerId), salaryPaymentsRepo.listForSeller(sellerId)]).then(([found, payments]) => {
      setSeller(found);
      const next = found ? salarySummary(found, payments, todayLocalDateString()) : null;
      setSummary(next);
      // The oldest unpaid period first: salaries are paid in order.
      setPeriodStart(next?.unpaid[0]?.start ?? null);
      setAmount(next ? String(next.amount) : '');
    });
    cashAccountsRepo.listWithBalances().then((rows) => {
      const active = rows.filter((a) => a.active);
      setAccounts(active);
      setAccountId((current) => current ?? active[0]?.id ?? null);
    });
  }, [sellerId]);

  const value = Number(amount) || 0;
  const canPay = summary !== null && periodStart !== null && accountId !== null && value > 0 && !saving;

  async function handleSubmit() {
    if (!canPay || !summary || periodStart === null || accountId === null) return;
    setError(null);
    setSaving(true);
    try {
      await salaryPaymentsRepo.create({
        sellerId,
        period: summary.period,
        periodStart,
        amount: value,
        accountId,
        notes: notes.trim() || undefined,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el pago');
      // Re-enabled only on failure: a state update on a screen that
      // router.back() is closing crashes Android (see CLAUDE.md).
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={[]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View>
              <ThemedText type="cardTitle">{seller?.name ?? 'Vendedor'}</ThemedText>
              {summary ? (
                <ThemedText type="secondary" themeColor="textSecondary">
                  Sueldo {SALARY_PERIOD_LABEL[summary.period]} de {formatCOP(summary.amount)}
                </ThemedText>
              ) : null}
            </View>

            {seller && !summary ? (
              <ThemedText type="secondary" themeColor="textSecondary">
                Este vendedor no tiene sueldo fijo. Configúralo en Editar.
              </ThemedText>
            ) : null}

            {summary && summary.unpaid.length === 0 ? (
              <ThemedText type="secondary" themeColor="textSecondary">
                Está al día: no hay períodos sin pagar.
              </ThemedText>
            ) : null}

            {summary && summary.unpaid.length > 0 ? (
              <>
                <FormSection title="Período">
                  <View style={styles.chips}>
                    {summary.unpaid.map((p) => (
                      <FormChip
                        key={p.start}
                        label={`${formatSalaryPeriod(p.start, summary.period)}${p.ended ? '' : ' · en curso'}`}
                        selected={periodStart === p.start}
                        onPress={() => setPeriodStart(p.start)}
                      />
                    ))}
                  </View>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {summary.owed.length > 0
                      ? `${summary.owed.length === 1 ? '1 período terminado' : `${summary.owed.length} períodos terminados`} sin pagar.`
                      : 'No debe períodos terminados; puedes pagar el que está en curso.'}
                  </ThemedText>
                </FormSection>

                <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
                  <ThemedText type="secondary" themeColor="textSecondary">
                    A pagar
                  </ThemedText>
                  <View style={styles.amountRow}>
                    <ThemedText type="bigNumber" style={{ color: theme.purple }}>
                      $
                    </ThemedText>
                    <TextInput
                      value={amount}
                      onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={withAlpha(theme.purple, 0.35)}
                      style={[styles.amountInput, { color: theme.purple }]}
                    />
                  </View>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {value > 0 ? formatCOP(value) : ' '}
                    {value > 0 && value !== summary.amount ? ` · distinto al sueldo (${formatCOP(summary.amount)})` : ''}
                  </ThemedText>
                </ThemedView>

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
                              <ThemedText
                                type={selected ? 'smallBold' : 'small'}
                                numberOfLines={1}
                                style={{ color: selected ? theme.purple : theme.text }}>
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

                <FormSection title="Nota">
                  <FormInput value={notes} onChangeText={setNotes} placeholder="Opcional (adelanto, descuento, bono…)" />
                </FormSection>
              </>
            ) : null}

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
              <View style={[styles.primaryButton, { backgroundColor: theme.purple }, !canPay && styles.disabled]} collapsable={false}>
                <ThemedText type="cardTitle" style={styles.onPrimary}>
                  {saving ? 'Pagando…' : value > 0 ? `Pagar ${formatCOP(value)}` : 'Pagar sueldo'}
                </ThemedText>
              </View>
            </Pressable>
          </ThemedView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { padding: Layout.screenPadding, gap: Layout.cardGap, paddingBottom: Spacing.five },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  card: { borderRadius: Radii.card, padding: Spacing.four, gap: Spacing.one },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  amountInput: { flex: 1, fontSize: 42, fontFamily: Fonts.inter.bold, paddingVertical: 0 },
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
