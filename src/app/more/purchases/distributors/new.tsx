import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormField, FormInput, FormRow, FormSection } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { distributorsRepo } from '@/lib/data';
import { distributorSchema } from '@/lib/validations';

export default function NewDistributorScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    const parsed = distributorSchema.safeParse({
      name: name.trim(),
      city: city.trim() || undefined,
      phone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await distributorsRepo.create(parsed.data);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el distribuidor');
    } finally {
      setSaving(false);
    }
  }

  const canSave = name.trim().length > 0 && !saving;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={[]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <FormSection title="Datos">
              <FormField label="Nombre">
                <FormInput value={name} onChangeText={setName} placeholder="Ej. Distribuidora El Sol" autoFocus />
              </FormField>
              <FormRow>
                <FormField label="Teléfono (opcional)" style={styles.flex}>
                  <FormInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                </FormField>
                <FormField label="Ciudad (opcional)" style={styles.flex}>
                  <FormInput value={city} onChangeText={setCity} />
                </FormField>
              </FormRow>
              <FormField label="Notas (opcional)">
                <FormInput value={notes} onChangeText={setNotes} multiline />
              </FormField>
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
                  {saving ? 'Guardando…' : 'Crear distribuidor'}
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
  scrollContent: { padding: Layout.screenPadding, gap: Layout.cardGap },
  errorBox: { borderRadius: Spacing.three, padding: Spacing.three },
  bottomBar: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.three, borderTopWidth: 1 },
  primaryButton: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Radii.buttonPrimary },
  onPrimary: { color: '#FFFFFF' },
  disabled: { opacity: 0.5 },
});
