import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { cashRepo } from '@/lib/data';
import { cashMovementSchema } from '@/lib/validations';

export default function NewCashMovementScreen() {
  const theme = useTheme();
  const [type, setType] = useState<'ingreso' | 'gasto'>('gasto');
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    const parsed = cashMovementSchema.safeParse({
      type,
      amount: Number(amount),
      concept,
      notes: notes || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await cashRepo.recordMovement(parsed.data);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el movimiento');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="small">Tipo</ThemedText>
          <ThemedView style={styles.typeRow}>
            <Pressable style={styles.typeFlex} onPress={() => setType('ingreso')}>
              <ThemedView type={type === 'ingreso' ? 'backgroundSelected' : 'backgroundElement'} style={styles.typeButton}>
                <ThemedText type={type === 'ingreso' ? 'linkPrimary' : undefined}>Ingreso</ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable style={styles.typeFlex} onPress={() => setType('gasto')}>
              <ThemedView type={type === 'gasto' ? 'backgroundSelected' : 'backgroundElement'} style={styles.typeButton}>
                <ThemedText type={type === 'gasto' ? 'linkPrimary' : undefined}>Gasto</ThemedText>
              </ThemedView>
            </Pressable>
          </ThemedView>

          <ThemedText type="small">Monto</ThemedText>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" style={inputStyle} />

          <ThemedText type="small">Concepto</ThemedText>
          <TextInput
            value={concept}
            onChangeText={setConcept}
            placeholder="Ej. pago de arriendo, venta de mostrador"
            placeholderTextColor={theme.textSecondary}
            style={inputStyle}
          />

          <ThemedText type="small">Notas (opcional)</ThemedText>
          <TextInput value={notes} onChangeText={setNotes} style={inputStyle} multiline />

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <Pressable onPress={handleSubmit} disabled={saving}>
            <ThemedView type="backgroundSelected" style={styles.submitButton}>
              <ThemedText type="linkPrimary">{saving ? 'Guardando…' : 'Registrar movimiento'}</ThemedText>
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
