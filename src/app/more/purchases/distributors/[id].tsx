import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { distributorsRepo } from '@/lib/data';
import { distributorSchema } from '@/lib/validations';

export default function EditDistributorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const distributorId = Number(id);
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      distributorsRepo.getById(distributorId).then((distributor) => {
        if (cancelled) return;
        if (distributor) {
          setName(distributor.name);
          setCity(distributor.city ?? '');
          setPhone(distributor.phone ?? '');
          setNotes(distributor.notes ?? '');
          setActive(distributor.active);
        }
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [distributorId]),
  );

  async function handleSubmit() {
    const parsed = distributorSchema.safeParse({
      name,
      city: city || undefined,
      phone: phone || undefined,
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
      await distributorsRepo.update(distributorId, parsed.data);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el distribuidor');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    setSaving(true);
    try {
      await distributorsRepo.deactivate(distributorId);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo desactivar el distribuidor');
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
        <ThemedText type="small">Nombre</ThemedText>
        <TextInput value={name} onChangeText={setName} style={inputStyle} />

        <ThemedText type="small">Ciudad (opcional)</ThemedText>
        <TextInput value={city} onChangeText={setCity} style={inputStyle} />

        <ThemedText type="small">Teléfono (opcional)</ThemedText>
        <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={inputStyle} />

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
              <ThemedText>Desactivar distribuidor</ThemedText>
            </ThemedView>
          </Pressable>
        ) : null}
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
