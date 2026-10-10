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
import { cashAccountsRepo, purchasePaymentsRepo, type CashAccountWithBalance, type PurchaseOrderBalance } from '@/lib/data';
import { formatCOP } from '@/lib/format';
import { purchasePaymentSchema } from '@/lib/validations';

// A payment toward a crédito purchase: an expense from the chosen account,
// never more than what's still owed (purchase-payments-repo.ts).
export default function NewPurchasePaymentScreen() {
  const { orderId: orderIdParam } = useLocalSearchParams<{ orderId: string }>();
  const orderId = Number(orderIdParam);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [balance, setBalance] = useState<PurchaseOrderBalance | null>(null);
  const [amount, setAmount] = useState('');
  const [accounts, setAccounts] = useState<CashAccountWithBalance[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    purchasePaymentsRepo.getBalance(orderId).then(setBalance);
    cashAccountsRepo.listWithBalances().then((rows) => {
      const active = rows.filter((a) => a.active);
      setAccounts(active);
      setAccountId((current) => current ?? active[0]?.id ?? null);
    });
  }, [orderId]);

  const value = Number(amount) || 0;
  const pending = balance?.pending ?? 0;
  const tooMuch = balance !== null && value > pending;
  const canSave = value > 0 && !tooMuch && accountId !== null && !saving;

  async function handleSubmit() {
    const parsed = purchasePaymentSchema.safeParse({ amount: value, accountId, notes: notes.trim() || undefined });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await purchasePaymentsRepo.create(orderId, parsed.data);
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
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
              <ThemedText type="secondary" themeColor="textSecondary">
                Falta por pagar: {formatCOP(pending)}
              </ThemedText>
              <View style={styles.amountRow}>
                <ThemedText type="bigNumber" style={{ color: tooMuch ? theme.error : theme.text }}>
                  $
                </ThemedText>
                <TextInput
                  value={amount}
                  onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={withAlpha(theme.textSecondary, 0.5)}
                  autoFocus
                  style={[styles.amountInput, { color: tooMuch ? theme.error : theme.text }]}
                />
              </View>
              {tooMuch ? (
                <ThemedText type="caption" style={{ color: theme.error }}>
                  Es más de lo que se debe.
                </ThemedText>
              ) : null}
              {pending > 0 ? (
                <View style={styles.chips}>
                  <FormChip label="Pagar todo" selected={value === pending} onPress={() => setAmount(String(pending))} />
                  {pending >= 2 ? (
                    <FormChip label="La mitad" selected={value === Math.round(pending / 2)} onPress={() => setAmount(String(Math.round(pending / 2)))} />
                  ) : null}
                </View>
              ) : null}
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
                            ? { backgroundColor: theme.primaryLight, borderColor: theme.primary }
                            : { backgroundColor: theme.background, borderColor: theme.border },
                        ]}>
                        <Icon color={selected ? theme.primary : theme.textSecondary} size={18} />
                        <View style={styles.flex}>
                          <ThemedText type={selected ? 'smallBold' : 'small'} numberOfLines={1} style={{ color: selected ? theme.primary : theme.text }}>
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

            <FormSection title="Notas">
              <FormInput value={notes} onChangeText={setNotes} placeholder="Opcional" multiline />
            </FormSection>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: withAlpha(theme.error, 0.08) }]}>
                <ThemedText type="small" style={{ color: theme.error }}>
                  {error}
                </ThemedText>
              </View>
            ) : null}
          </ScrollView>

          <ThemedView
            type="backgroundElement"
            style={[styles.bottomBar, { borderTopColor: theme.border, paddingBottom: Spacing.three + insets.bottom }]}>
            <Pressable onPress={handleSubmit} disabled={!canSave}>
              <View style={[styles.primaryButton, { backgroundColor: theme.primary }, !canSave && styles.disabled]}>
                <ThemedText type="cardTitle" style={styles.onPrimary}>
                  {saving ? 'Registrando…' : value > 0 ? `Pagar ${formatCOP(value)}` : 'Registrar pago'}
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
  card: { borderRadius: Radii.card, padding: Spacing.four, gap: Spacing.two },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  amountInput: { flex: 1, fontSize: 42, fontFamily: Fonts.inter.bold, paddingVertical: 0 },
  chips: { flexDirection: 'row', gap: Spacing.two },
  accountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  accountFlex: { flexGrow: 1, flexBasis: '45%' },
  accountButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1.5, borderRadius: Radii.button, padding: Spacing.three },
  errorBox: { borderRadius: Spacing.three, padding: Spacing.three },
  bottomBar: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.three, borderTopWidth: 1 },
  primaryButton: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Radii.buttonPrimary },
  onPrimary: { color: '#FFFFFF' },
  disabled: { opacity: 0.5 },
});
