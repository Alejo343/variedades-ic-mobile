import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { purchasePaymentsRepo } from '@/lib/data';
import { purchasePaymentSchema } from '@/lib/validations';

export default function NewPurchasePaymentScreen() {
  const { orderId: orderIdParam } = useLocalSearchParams<{ orderId: string }>();
  const orderId = Number(orderIdParam);
  const theme = useTheme();

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    const parsed = purchasePaymentSchema.safeParse({
      amount: Number(amount),
      method: method || undefined,
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

        <ThemedText type="small">Método (opcional)</ThemedText>
        <TextInput
          value={method}
          onChangeText={setMethod}
          placeholder="Ej. efectivo, transferencia"
          placeholderTextColor={theme.textSecondary}
          style={inputStyle}
        />

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
  error: { color: '#d9534f' },
  submitButton: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
