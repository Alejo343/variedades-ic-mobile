import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductImageGallery } from '@/components/product-image-gallery';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { categoriesRepo, productsRepo, type Category, type Product } from '@/lib/data';
import type { ImageDraft } from '@/lib/domain/product-images';
import { pendingUuidsForType } from '@/lib/sync/outbox';
import { productSchema } from '@/lib/validations';

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const productId = Number(id);
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [sku, setSku] = useState('');
  const [skuPending, setSkuPending] = useState(false);
  const [active, setActive] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [distributorCode, setDistributorCode] = useState('');
  const [stock, setStock] = useState('0');
  const [minStock, setMinStock] = useState('0');
  const [warrantyMonths, setWarrantyMonths] = useState('');
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [savedImages, setSavedImages] = useState<ImageDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit form: plain useFocusEffect on purpose, not useDataFocusEffect — a
  // background sync must not overwrite what the user is typing.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      categoriesRepo.list().then((rows) => {
        if (!cancelled) setCategories(rows.filter((c) => c.active));
      });
      Promise.all([productsRepo.getById(productId), pendingUuidsForType('upsertProduct')]).then(([product, pending]) => {
        if (cancelled) return;
        if (product) {
          setSku(product.sku);
          setSkuPending(pending.has(product.uuid));
          setActive(product.active);
          setCategoryId(product.categoryId);
          setName(product.name);
          setSlug(product.slug);
          setDescription(product.description ?? '');
          setPrice(String(product.price));
          setPurchasePrice(String(product.purchasePrice));
          setDistributorCode(product.distributorCode ?? '');
          setStock(String(product.stock));
          setMinStock(String(product.minStock));
          setWarrantyMonths(product.warrantyMonths != null ? String(product.warrantyMonths) : '');
          const loaded = product.images.map(({ url, isPrimary }) => ({ url, isPrimary }));
          setImages(loaded);
          setSavedImages(loaded);
        }
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [productId]),
  );

  const savedUrls = useMemo(() => new Set(savedImages.map((image) => image.url)), [savedImages]);

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
      active,
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
        if (existing && existing.id !== productId) {
          setError(`Ya existe un producto con este código de proveedor: ${existing.name}`);
          setConflict(existing);
          return;
        }
      }
      await productsRepo.update(productId, parsed.data, images);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el producto');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    setSaving(true);
    try {
      await productsRepo.deactivate(productId);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo desactivar el producto');
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
          <ProductImageGallery images={images} onChange={setImages} onError={setError} savedUrls={savedUrls} />

          <ThemedText themeColor="textSecondary" type="small" style={styles.skuText}>
            SKU: {sku}
            {skuPending ? ' (pendiente de confirmar al sincronizar)' : ''}
          </ThemedText>

          <ThemedText type="small">Nombre</ThemedText>
          <TextInput value={name} onChangeText={setName} style={inputStyle} />

          <ThemedText type="small">Slug</ThemedText>
          <TextInput value={slug} onChangeText={setSlug} autoCapitalize="none" style={inputStyle} />

          <ThemedText type="small">Categoría</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            <Pressable onPress={() => setCategoryId(null)}>
              <ThemedView type={categoryId === null ? 'backgroundSelected' : 'backgroundElement'} style={styles.chip}>
                <ThemedText type="small">General</ThemedText>
              </ThemedView>
            </Pressable>
            {categories.map((category) => (
              <Pressable key={category.id} onPress={() => setCategoryId(category.id)}>
                <ThemedView
                  type={categoryId === category.id ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.chip}>
                  <ThemedText type="small">{category.name}</ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ScrollView>

          <ThemedText type="small">Descripción (opcional)</ThemedText>
          <TextInput value={description} onChangeText={setDescription} style={inputStyle} multiline />

          <ThemedText type="small">Código del proveedor (opcional)</ThemedText>
          <TextInput
            value={distributorCode}
            onChangeText={setDistributorCode}
            placeholder="Ej. PROV-100"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            style={inputStyle}
          />

          <ThemedText type="small">Precio de venta</ThemedText>
          <TextInput value={price} onChangeText={setPrice} keyboardType="numeric" style={inputStyle} />

          <ThemedText type="small">Precio de compra (opcional)</ThemedText>
          <TextInput value={purchasePrice} onChangeText={setPurchasePrice} keyboardType="numeric" style={inputStyle} />

          <ThemedText type="small">Stock</ThemedText>
          <TextInput value={stock} onChangeText={setStock} keyboardType="numeric" style={inputStyle} />

          <ThemedText type="small">Stock mínimo</ThemedText>
          <TextInput value={minStock} onChangeText={setMinStock} keyboardType="numeric" style={inputStyle} />

          <ThemedText type="small">Garantía en meses (opcional)</ThemedText>
          <TextInput value={warrantyMonths} onChangeText={setWarrantyMonths} keyboardType="numeric" style={inputStyle} />

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
          {conflict ? (
            <Pressable onPress={() => router.push(`/more/products/${conflict.id}`)}>
              <ThemedText type="linkPrimary" style={styles.conflictLink}>
                Ir a editar {conflict.name}
              </ThemedText>
            </Pressable>
          ) : null}

          <Pressable onPress={handleSubmit} disabled={saving}>
            <ThemedView type="backgroundSelected" style={styles.submitButton}>
              <ThemedText type="linkPrimary">{saving ? 'Guardando…' : 'Guardar cambios'}</ThemedText>
            </ThemedView>
          </Pressable>

          {active ? (
            <Pressable onPress={handleDeactivate} disabled={saving}>
              <ThemedView type="backgroundElement" style={styles.submitButton}>
                <ThemedText>Desactivar producto</ThemedText>
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
  skuText: { textAlign: 'center', marginBottom: Spacing.three },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  chipRow: { marginBottom: Spacing.two },
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
    marginRight: Spacing.two,
  },
  error: { color: '#d9534f' },
  conflictLink: { marginBottom: Spacing.two },
  submitButton: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
