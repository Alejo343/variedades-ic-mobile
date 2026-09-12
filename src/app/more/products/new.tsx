import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { categoriesRepo, productsRepo, type Category, type Product } from '@/lib/data';
import { pickAndPersistProductImage } from '@/lib/images';
import { productSchema, toSlug } from '@/lib/validations';

export default function NewProductScreen() {
  const theme = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [distributorCode, setDistributorCode] = useState('');
  const [stock, setStock] = useState('0');
  const [minStock, setMinStock] = useState('0');
  const [warrantyMonths, setWarrantyMonths] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
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
      distributorCode: distributorCode.trim() || undefined,
      stock: Number(stock) || 0,
      minStock: Number(minStock) || 0,
      warrantyMonths: warrantyMonths ? Number(warrantyMonths) : null,
      imageUri,
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
      await productsRepo.create(parsed.data);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el producto');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
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

          <ThemedText type="small">Nombre</ThemedText>
          <TextInput
            value={name}
            onChangeText={handleNameChange}
            placeholder="Ej. Audífonos Bluetooth"
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
            style={inputStyle}
          />

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

          <ThemedText type="small">Stock inicial</ThemedText>
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
              <ThemedText type="linkPrimary">{saving ? 'Guardando…' : 'Guardar producto'}</ThemedText>
            </ThemedView>
          </Pressable>
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
    marginBottom: Spacing.three,
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: Spacing.three,
    alignSelf: 'center',
    marginBottom: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
