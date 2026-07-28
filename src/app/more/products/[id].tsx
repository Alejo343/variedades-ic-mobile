import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { categoriesRepo, productsRepo, type Category } from '@/lib/data';
import { pickAndPersistProductImage } from '@/lib/images';
import { productSchema } from '@/lib/validations';

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const productId = Number(id);
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [sku, setSku] = useState('');
  const [active, setActive] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [stock, setStock] = useState('0');
  const [minStock, setMinStock] = useState('0');
  const [warrantyMonths, setWarrantyMonths] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      categoriesRepo.list().then((rows) => {
        if (!cancelled) setCategories(rows.filter((c) => c.active));
      });
      productsRepo.getById(productId).then((product) => {
        if (cancelled) return;
        if (product) {
          setSku(product.sku);
          setActive(product.active);
          setCategoryId(product.categoryId);
          setName(product.name);
          setSlug(product.slug);
          setDescription(product.description ?? '');
          setPrice(String(product.price));
          setPurchasePrice(String(product.purchasePrice));
          setStock(String(product.stock));
          setMinStock(String(product.minStock));
          setWarrantyMonths(product.warrantyMonths != null ? String(product.warrantyMonths) : '');
          setImageUri(product.imageUri);
        }
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [productId]),
  );

  async function handlePickImage() {
    try {
      const uri = await pickAndPersistProductImage();
      if (uri) setImageUri(uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo seleccionar la imagen');
    }
  }

  async function handleSubmit() {
    const parsed = productSchema.safeParse({
      name,
      slug,
      description: description || undefined,
      price: Number(price),
      purchasePrice: purchasePrice ? Number(purchasePrice) : 0,
      categoryId,
      stock: Number(stock) || 0,
      minStock: Number(minStock) || 0,
      warrantyMonths: warrantyMonths ? Number(warrantyMonths) : null,
      active,
      imageUri,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await productsRepo.update(productId, parsed.data);
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
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Pressable onPress={handlePickImage}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.image} />
            ) : (
              <ThemedView type="backgroundElement" style={styles.imagePlaceholder}>
                <ThemedText themeColor="textSecondary" type="small">
                  Toca para agregar foto
                </ThemedText>
              </ThemedView>
            )}
          </Pressable>

          <ThemedText themeColor="textSecondary" type="small" style={styles.skuText}>
            SKU: {sku}
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
  image: {
    width: 120,
    height: 120,
    borderRadius: Spacing.three,
    alignSelf: 'center',
    marginBottom: Spacing.two,
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: Spacing.three,
    alignSelf: 'center',
    marginBottom: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  submitButton: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
