import { StyleSheet, View } from 'react-native';

import { FormField, FormInput, FormSection } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Category } from '@/lib/data';
import { getSkuPrefix } from '@/lib/domain/sku';
import { toSlug } from '@/lib/validations';

export type CategoryFormValues = { name: string; description: string; slug: string; slugTouched: boolean };

export const EMPTY_CATEGORY_FORM: CategoryFormValues = { name: '', description: '', slug: '', slugTouched: false };

// The category another one already uses this name or slug with (slug is
// unique in the database; a repeated name would just be confusing), or null.
export function findCategoryClash(values: CategoryFormValues, categories: Category[], selfId?: number): Category | null {
  const norm = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return (
    categories.find(
      (c) => c.id !== selfId && (c.slug === values.slug.trim() || (values.name.trim() !== '' && norm(c.name) === norm(values.name))),
    ) ?? null
  );
}

// Fields shared by "Nueva categoría" and "Editar categoría".
export function CategoryForm({
  values,
  onChange,
  clash,
}: {
  values: CategoryFormValues;
  onChange: (v: CategoryFormValues) => void;
  clash: Category | null;
}) {
  const theme = useTheme();
  const prefix = getSkuPrefix(values.name);

  return (
    <>
      <FormSection title="Categoría">
        <FormField label="Nombre">
          <FormInput
            value={values.name}
            onChangeText={(name) => onChange({ ...values, name, slug: values.slugTouched ? values.slug : toSlug(name) })}
            placeholder="Ej. Accesorios"
          />
        </FormField>
        {clash ? (
          <View style={[styles.notice, { backgroundColor: withAlpha(theme.warning, 0.1) }]}>
            <ThemedText type="small" style={{ color: theme.warning }}>
              Ya existe la categoría «{clash.name}»{clash.active ? '' : ' (desactivada)'} con ese nombre o slug.
            </ThemedText>
          </View>
        ) : null}
        <FormField label="Descripción (opcional)">
          <FormInput value={values.description} onChangeText={(description) => onChange({ ...values, description })} multiline />
        </FormField>
      </FormSection>

      <FormSection title="Identificación">
        <View style={[styles.skuRow, { backgroundColor: withAlpha(theme.info, 0.08) }]}>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.flex}>
            Los productos nuevos de esta categoría reciben un SKU que empieza por
          </ThemedText>
          <View style={[styles.skuChip, { backgroundColor: withAlpha(theme.info, 0.14) }]}>
            <ThemedText type="smallBold" style={{ color: theme.info }}>
              {prefix}-
            </ThemedText>
          </View>
        </View>
        <FormField label="Slug" hint="La dirección de la categoría en la página web. Se llena sola con el nombre.">
          <FormInput value={values.slug} onChangeText={(slug) => onChange({ ...values, slug, slugTouched: true })} autoCapitalize="none" />
        </FormField>
      </FormSection>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  notice: { borderRadius: Spacing.two, padding: Spacing.three },
  skuRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: Spacing.two, padding: Spacing.three },
  skuChip: { borderRadius: Radii.chip, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
});
