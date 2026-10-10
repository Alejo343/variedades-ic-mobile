import { Link, router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Package, Power } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryForm, findCategoryClash, type CategoryFormValues } from '@/components/category-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Spacing, withAlpha } from '@/constants/theme';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useTheme } from '@/hooks/use-theme';
import { categoriesRepo, productsRepo, type Category } from '@/lib/data';
import { categorySchema } from '@/lib/validations';

export default function EditCategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const categoryId = Number(id);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [values, setValues] = useState<CategoryFormValues | null>(null);
  const [saved, setSaved] = useState<CategoryFormValues | null>(null);
  const [active, setActive] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [productCount, setProductCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit form: plain useFocusEffect on purpose, not useDataFocusEffect — a
  // background sync must not overwrite what the user is typing. The slug
  // counts as typed so renaming doesn't silently change the web address.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([categoriesRepo.getById(categoryId), categoriesRepo.list()]).then(([category, rows]) => {
        if (cancelled || !category) return;
        const loaded = { name: category.name, description: category.description ?? '', slug: category.slug, slugTouched: true };
        setValues(loaded);
        setSaved(loaded);
        setActive(category.active);
        setCategories(rows);
      });
      return () => {
        cancelled = true;
      };
    }, [categoryId]),
  );

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      productsRepo.list().then((products) => {
        if (!cancelled) setProductCount(products.filter((p) => p.active && p.categoryId === categoryId).length);
      });
      return () => {
        cancelled = true;
      };
    }, [categoryId]),
  );

  if (!values) {
    return (
      <ThemedView style={[styles.container, styles.padded]}>
        <ThemedText themeColor="textSecondary">Cargando…</ThemedText>
      </ThemedView>
    );
  }

  const clash = findCategoryClash(values, categories, categoryId);
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  const canSave = dirty && values.name.trim().length > 0 && values.slug.trim().length > 0 && !clash && !saving;

  async function handleSubmit() {
    if (!values) return;
    const parsed = categorySchema.safeParse({
      name: values.name.trim(),
      slug: values.slug.trim(),
      description: values.description.trim() || undefined,
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

  async function handleSetActive(next: boolean) {
    setSaving(true);
    setError(null);
    try {
      if (next) await categoriesRepo.update(categoryId, { active: true });
      else await categoriesRepo.deactivate(categoryId);
      setActive(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el estado de la categoría');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: saved?.name || 'Categoría' }} />
      <SafeAreaView style={styles.flex} edges={[]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Link href={`/more/products?categoryId=${categoryId}`} asChild>
              <Pressable>
                <View style={[styles.productsLink, { borderColor: theme.border }]}>
                  <View style={[styles.iconDot, { backgroundColor: withAlpha(theme.primary, 0.12) }]}>
                    <Package color={theme.primary} size={18} />
                  </View>
                  <ThemedText type="default" style={styles.flex}>
                    {productCount} {productCount === 1 ? 'producto activo' : 'productos activos'}
                  </ThemedText>
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>
                    Ver
                  </ThemedText>
                </View>
              </Pressable>
            </Link>

            <CategoryForm values={values} onChange={setValues} clash={clash} />
            {values.name !== saved?.name ? (
              <ThemedText type="caption" themeColor="textSecondary">
                Cambiar el nombre no cambia el SKU de los productos que ya existen.
              </ThemedText>
            ) : null}

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: withAlpha(theme.error, 0.08) }]}>
                <ThemedText type="small" style={{ color: theme.error }}>
                  {error}
                </ThemedText>
              </View>
            ) : null}

            <Pressable onPress={() => handleSetActive(!active)} disabled={saving}>
              <View style={[styles.stateButton, { borderColor: withAlpha(active ? theme.error : theme.primary, 0.4) }]}>
                <Power color={active ? theme.error : theme.primary} size={18} />
                <ThemedText type="default" style={{ color: active ? theme.error : theme.primary }}>
                  {active ? 'Desactivar categoría' : 'Reactivar categoría'}
                </ThemedText>
              </View>
            </Pressable>
            <ThemedText type="caption" themeColor="textSecondary" style={styles.center}>
              {active
                ? 'Una categoría desactivada no aparece para elegir en productos ni en Vender. Sus productos no cambian.'
                : 'Está desactivada: no aparece para elegir.'}
            </ThemedText>
          </ScrollView>

          <ThemedView
            type="backgroundElement"
            style={[styles.bottomBar, { borderTopColor: theme.border, paddingBottom: Spacing.three + insets.bottom }]}>
            <Pressable onPress={handleSubmit} disabled={!canSave}>
              <View style={[styles.primaryButton, { backgroundColor: theme.primary }, !canSave && styles.disabled]}>
                <ThemedText type="cardTitle" style={styles.onPrimary}>
                  {saving ? 'Guardando…' : dirty ? 'Guardar cambios' : 'Sin cambios'}
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
  padded: { padding: Layout.screenPadding },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  scrollContent: { padding: Layout.screenPadding, gap: Layout.cardGap, paddingBottom: Spacing.five },
  productsLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1.5, borderRadius: Radii.card, padding: Spacing.three },
  iconDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  errorBox: { borderRadius: Spacing.three, padding: Spacing.three },
  stateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderRadius: Radii.buttonPrimary,
    paddingVertical: Spacing.three,
  },
  bottomBar: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.three, borderTopWidth: 1 },
  primaryButton: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Radii.buttonPrimary },
  onPrimary: { color: '#FFFFFF' },
  disabled: { opacity: 0.5 },
});
