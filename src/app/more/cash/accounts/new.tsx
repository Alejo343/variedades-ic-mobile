import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { cashAccountsRepo } from '@/lib/data';
import { cashAccountSchema } from '@/lib/validations';

export default function NewCashAccountScreen() {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [type, setType] = useState<'efectivo' | 'banco'>('efectivo');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    const parsed = cashAccountSchema.safeParse({
      name,
      type,
      notes: notes || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await cashAccountsRepo.create(parsed.data);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la cuenta');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="small">Nombre</ThemedText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ej. Efectivo, Bancolombia, Nequi"
            placeholderTextColor={theme.textSecondary}
            style={inputStyle}
          />

          <ThemedText type="small">Tipo</ThemedText>
          <ThemedView style={styles.typeRow}>
            <Pressable style={styles.typeFlex} onPress={() => setType('efectivo')}>
              <ThemedView type={type === 'efectivo' ? 'backgroundSelected' : 'backgroundElement'} style={styles.typeButton}>
                <ThemedText type={type === 'efectivo' ? 'linkPrimary' : undefined}>Efectivo</ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable style={styles.typeFlex} onPress={() => setType('banco')}>
              <ThemedView type={type === 'banco' ? 'backgroundSelected' : 'backgroundElement'} style={styles.typeButton}>
                <ThemedText type={type === 'banco' ? 'linkPrimary' : undefined}>Banco</ThemedText>
              </ThemedView>
            </Pressable>
          </ThemedView>

          <ThemedText type="small">Notas (opcional)</ThemedText>
          <TextInput value={notes} onChangeText={setNotes} style={inputStyle} multiline />

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <Pressable onPress={handleSubmit} disabled={saving}>
            <ThemedView type="backgroundSelected" style={styles.submitButton}>
              <ThemedText type="linkPrimary">{saving ? 'Guardando…' : 'Guardar cuenta'}</ThemedText>
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
