import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormChip, FormField, FormInput, FormRow, FormSection } from '@/components/form';
import { ProductImageGallery } from '@/components/product-image-gallery';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { categoriesRepo, productsRepo, type Category, type Product } from '@/lib/data';
import type { ImageDraft } from '@/lib/domain/product-images';
import { formatCOP } from '@/lib/format';
import { productSchema, toSlug } from '@/lib/validations';

// Same sections and look as the edit screen (products/[id].tsx). The one
// difference: here the stock is editable, because an initial stock is
// recorded as a real "Stock inicial" adjustment movement (products-repo
// create), which is what the server syncs.
export default function NewProductScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [distributorCode, setDistributorCode] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [warrantyMonths, setWarrantyMonths] = useState('');
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    categoriesRepo.list().then((rows) => setCategories(rows.filter((c) => c.active)));
  }, []);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(toSlug(value));
  }

  async function handleSubmit() {
    const parsed = productSchema.safeParse({
      name,
      slug,
      description: description || undefined,
      price: Number(price),
      purchasePrice: purchasePrice ? Number(purchasePrice) : 0,
      categoryId,
      distributorCode: distributorCode.trim() || undefined,
      stock: Number(stock) || 0,
      minStock: Number(minStock) || 0,
      warrantyMonths: warrantyMonths ? Number(warrantyMonths) : null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setError(null);
    setConflict(null);
    setSaving(true);
    try {
      if (parsed.data.distributorCode) {
        const existing = await productsRepo.findByDistributorCode(parsed.data.distributorCode);
        if (existing) {
          setError(`Ya existe un producto con este código de proveedor: ${existing.name}`);
          setConflict(existing);
          return;
        }
      }
      await productsRepo.create(parsed.data, images);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el producto');
    } finally {
      setSaving(false);
    }
  }

  const salePrice = Number(price) || 0;
  const cost = Number(purchasePrice) || 0;
  const gain = salePrice - cost;
  const canSave = name.trim().length > 0 && price.trim().length > 0 && !saving;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={[]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <FormSection title="Fotos">
              <ProductImageGallery images={images} onChange={setImages} onError={setError} />
            </FormSection>

            <FormSection title="Información">
              <FormField label="Nombre">
                <FormInput value={name} onChangeText={handleNameChange} placeholder="Ej. Audífonos Bluetooth" />
              </FormField>
              <FormField label="Categoría">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  <FormChip label="General" selected={categoryId === null} onPress={() => setCategoryId(null)} />
                  {categories.map((category) => (
                    <FormChip
                      key={category.id}
                      label={category.name}
                      selected={categoryId === category.id}
                      onPress={() => setCategoryId(category.id)}
                    />
                  ))}
                </ScrollView>
              </FormField>
              <FormField label="Descripción (opcional)">
                <FormInput value={description} onChangeText={setDescription} multiline />
              </FormField>
            </FormSection>

            <FormSection title="Precios">
              <FormRow>
                <FormField label="Precio de venta" style={styles.flex}>
                  <FormInput prefix="$" value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="0" />
                </FormField>
                <FormField label="Precio de compra" style={styles.flex}>
                  <FormInput prefix="$" value={purchasePrice} onChangeText={setPurchasePrice} keyboardType="numeric" placeholder="0" />
                </FormField>
              </FormRow>
              {salePrice > 0 && cost > 0 ? (
                <View style={[styles.marginBox, { backgroundColor: withAlpha(gain < 0 ? theme.error : theme.primary, 0.08) }]}>
                  <ThemedText type="small" style={{ color: gain < 0 ? theme.error : theme.primary }}>
                    {gain < 0 ? 'Pierdes' : 'Ganas'} {formatCOP(Math.abs(gain))} por unidad ({Math.round((gain / salePrice) * 100)}% del precio)
                  </ThemedText>
                </View>
              ) : null}
            </FormSection>

            <FormSection title="Inventario">
              <FormField label="Stock inicial" hint={'Se registra como un ajuste de inventario "Stock inicial". Después se cambia desde Ajustar stock.'}>
                <FormInput value={stock} onChangeText={setStock} keyboardType="numeric" placeholder="0" />
              </FormField>
              <FormRow>
                <FormField label="Stock mínimo" style={styles.flex}>
                  <FormInput value={minStock} onChangeText={setMinStock} keyboardType="numeric" placeholder="0" />
                </FormField>
                <FormField label="Garantía (meses)" style={styles.flex}>
                  <FormInput value={warrantyMonths} onChangeText={setWarrantyMonths} keyboardType="numeric" placeholder="Sin garantía" />
                </FormField>
              </FormRow>
            </FormSection>

            <FormSection title="Identificación">
              <FormField label="Código del proveedor (opcional)" hint="El código con que lo identifica el distribuidor. No se puede repetir.">
                <FormInput value={distributorCode} onChangeText={setDistributorCode} placeholder="Ej. PROV-100" autoCapitalize="none" />
              </FormField>
              <FormField label="Slug" hint="La dirección del producto en la página web. Se llena sola con el nombre.">
                <FormInput
                  value={slug}
                  onChangeText={(v) => {
                    setSlugTouched(true);
                    setSlug(v);
                  }}
                  autoCapitalize="none"
                />
              </FormField>
            </FormSection>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: withAlpha(theme.error, 0.08) }]}>
                <ThemedText type="small" style={{ color: theme.error }}>
                  {error}
                </ThemedText>
                {conflict ? (
                  <Pressable onPress={() => router.push(`/more/products/${conflict.id}`)}>
                    <ThemedText type="smallBold" style={{ color: theme.primary }}>
                      Ir a editar {conflict.name}
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </ScrollView>

          <ThemedView
            type="backgroundElement"
            style={[styles.saveBar, { borderTopColor: theme.border, paddingBottom: Spacing.three + insets.bottom }]}>
            <Pressable onPress={handleSubmit} disabled={!canSave}>
              <View style={[styles.saveButton, { backgroundColor: theme.primary }, !canSave && styles.disabled]}>
                <ThemedText type="cardTitle" style={styles.onPrimary}>
                  {saving ? 'Guardando…' : 'Crear producto'}
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
  scrollContent: { padding: Layout.screenPadding, gap: Layout.cardGap, paddingBottom: Spacing.five },
  chips: { gap: Spacing.two },
  marginBox: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  errorBox: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  saveBar: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.three, borderTopWidth: 1 },
  saveButton: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Radii.buttonPrimary },
  onPrimary: { color: '#FFFFFF' },
  disabled: { opacity: 0.5 },
});
