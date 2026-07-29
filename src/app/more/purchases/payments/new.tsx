import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { cashAccountsRepo, purchasePaymentsRepo, type CashAccount } from '@/lib/data';
import { purchasePaymentSchema } from '@/lib/validations';

export default function NewPurchasePaymentScreen() {
  const { orderId: orderIdParam } = useLocalSearchParams<{ orderId: string }>();
  const orderId = Number(orderIdParam);
  const theme = useTheme();

  const [amount, setAmount] = useState('');
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    cashAccountsRepo.list().then((rows) => {
      const active = rows.filter((a) => a.active);
      setAccounts(active);
      setAccountId((current) => current ?? active[0]?.id ?? null);
    });
  }, []);

  async function handleSubmit() {
    const parsed = purchasePaymentSchema.safeParse({
      amount: Number(amount),
      accountId,
      notes: notes || undefined,
    });
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

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ThemedText type="small">Monto</ThemedText>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" style={inputStyle} />

        <ThemedText type="small">Cuenta</ThemedText>
        <ThemedView style={styles.typeRow}>
          {accounts.map((account) => (
            <Pressable key={account.id} style={styles.typeFlex} onPress={() => setAccountId(account.id)}>
              <ThemedView type={accountId === account.id ? 'backgroundSelected' : 'backgroundElement'} style={styles.typeButton}>
                <ThemedText type={accountId === account.id ? 'linkPrimary' : undefined}>{account.name}</ThemedText>
              </ThemedView>
            </Pressable>
          ))}
        </ThemedView>

        <ThemedText type="small">Notas (opcional)</ThemedText>
        <TextInput value={notes} onChangeText={setNotes} style={inputStyle} multiline />

        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

        <Pressable onPress={handleSubmit} disabled={saving}>
          <ThemedView type="backgroundSelected" style={styles.submitButton}>
            <ThemedText type="linkPrimary">{saving ? 'Registrando…' : 'Registrar pago'}</ThemedText>
          </ThemedView>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.two },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  typeRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.two },
  typeFlex: { flex: 1 },
  typeButton: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  error: { color: '#d9534f' },
  submitButton: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
