import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { categoriesRepo } from '@/lib/data';
import { categorySchema } from '@/lib/validations';

export default function EditCategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const categoryId = Number(id);
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      categoriesRepo.getById(categoryId).then((category) => {
        if (cancelled) return;
        if (category) {
          setName(category.name);
          setSlug(category.slug);
          setDescription(category.description ?? '');
          setActive(category.active);
        }
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [categoryId]),
  );

  async function handleSubmit() {
    const parsed = categorySchema.safeParse({
      name,
      slug,
      description: description || undefined,
      active,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await categoriesRepo.update(categoryId, parsed.data);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la categoría');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    setSaving(true);
    try {
      await categoriesRepo.deactivate(categoryId);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo desactivar la categoría');
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

        <ThemedText type="small">Slug</ThemedText>
        <TextInput value={slug} onChangeText={setSlug} autoCapitalize="none" style={inputStyle} />

        <ThemedText type="small">Descripción (opcional)</ThemedText>
        <TextInput value={description} onChangeText={setDescription} style={inputStyle} multiline />

        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

        <Pressable onPress={handleSubmit} disabled={saving}>
          <ThemedView type="backgroundSelected" style={styles.submitButton}>
            <ThemedText type="linkPrimary">{saving ? 'Guardando…' : 'Guardar cambios'}</ThemedText>
          </ThemedView>
        </Pressable>

        {active ? (
          <Pressable onPress={handleDeactivate} disabled={saving}>
            <ThemedView type="backgroundElement" style={styles.submitButton}>
              <ThemedText>Desactivar categoría</ThemedText>
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
