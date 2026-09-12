import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { categoriesRepo } from '@/lib/data';
import { categorySchema, toSlug } from '@/lib/validations';

export default function NewCategoryScreen() {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(toSlug(value));
  }

  async function handleSubmit() {
    const parsed = categorySchema.safeParse({
      name,
      slug,
      description: description || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await categoriesRepo.create(parsed.data);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la categoría');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ThemedText type="small">Nombre</ThemedText>
        <TextInput
          value={name}
          onChangeText={handleNameChange}
          placeholder="Ej. Tecnología"
          placeholderTextColor={theme.textSecondary}
          style={inputStyle}
        />

        <ThemedText type="small">Slug</ThemedText>
        <TextInput
          value={slug}
          onChangeText={(v) => {
            setSlugTouched(true);
            setSlug(v);
          }}
          autoCapitalize="none"
          placeholder="tecnologia"
          placeholderTextColor={theme.textSecondary}
          style={inputStyle}
        />

        <ThemedText type="small">Descripción (opcional)</ThemedText>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Descripción"
          placeholderTextColor={theme.textSecondary}
          style={inputStyle}
          multiline
        />

        {error ? (
          <ThemedText themeColor="text" style={styles.error}>
            {error}
          </ThemedText>
        ) : null}

        <Pressable onPress={handleSubmit} disabled={saving}>
          <ThemedView type="backgroundSelected" style={styles.submitButton}>
            <ThemedText type="linkPrimary">{saving ? 'Guardando…' : 'Guardar categoría'}</ThemedText>
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
