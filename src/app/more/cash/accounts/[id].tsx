import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { cashAccountsRepo } from '@/lib/data';
import { formatCOP } from '@/lib/format';
import { cashAccountSchema } from '@/lib/validations';

export default function EditCashAccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accountId = Number(id);
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [type, setType] = useState<'efectivo' | 'banco'>('efectivo');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      Promise.all([cashAccountsRepo.getById(accountId), cashAccountsRepo.listWithBalances()]).then(([account, withBalances]) => {
        if (cancelled) return;
        if (account) {
          setName(account.name);
          setType(account.type);
          setNotes(account.notes ?? '');
          setActive(account.active);
        }
        setBalance(withBalances.find((a) => a.id === accountId)?.balance ?? 0);
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [accountId]),
  );

  async function handleSubmit() {
    const parsed = cashAccountSchema.safeParse({
      name,
      type,
      notes: notes || undefined,
      active,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await cashAccountsRepo.update(accountId, parsed.data);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la cuenta');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    setSaving(true);
    try {
      await cashAccountsRepo.deactivate(accountId);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo desactivar la cuenta');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText themeColor="textSecondary">Cargando…</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedView type="backgroundElement" style={styles.balanceBlock}>
            <ThemedText themeColor="textSecondary" type="small">
              Saldo actual
            </ThemedText>
            <ThemedText type="linkPrimary" style={styles.balanceAmount}>
              {formatCOP(balance)}
            </ThemedText>
          </ThemedView>

          <ThemedText type="small">Nombre</ThemedText>
          <TextInput value={name} onChangeText={setName} style={inputStyle} />

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
              <ThemedText type="linkPrimary">{saving ? 'Guardando…' : 'Guardar cambios'}</ThemedText>
            </ThemedView>
          </Pressable>

          {active ? (
            <Pressable onPress={handleDeactivate} disabled={saving}>
              <ThemedView type="backgroundElement" style={styles.submitButton}>
                <ThemedText>Desactivar cuenta</ThemedText>
              </ThemedView>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { padding: Spacing.four, gap: Spacing.two },
  balanceBlock: { padding: Spacing.four, borderRadius: Spacing.three, alignItems: 'center', marginBottom: Spacing.two, gap: Spacing.one },
  balanceAmount: { fontSize: 24 },
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
