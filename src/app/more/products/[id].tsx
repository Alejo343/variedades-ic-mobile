import { Link, router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Boxes, PackageX, Power, TrendingDown, TrendingUp, TriangleAlert, type LucideProps } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState, type ComponentType } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormChip, FormField, FormInput, FormRow, FormSection } from '@/components/form';
import { ProductImageGallery } from '@/components/product-image-gallery';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { categoriesRepo, productsRepo, type Category, type Product } from '@/lib/data';
import type { ImageDraft } from '@/lib/domain/product-images';
import { formatCOP } from '@/lib/format';
import { pendingUuidsForType } from '@/lib/sync/outbox';
import { productSchema } from '@/lib/validations';

// Every editable value of the form, as typed — compared against the loaded
// snapshot to know whether there's anything to save.
type FormValues = {
  name: string;
  slug: string;
  description: string;
  categoryId: number | null;
  price: string;
  purchasePrice: string;
  distributorCode: string;
  minStock: string;
  warrantyMonths: string;
  images: ImageDraft[];
};

function valuesFrom(product: Product & { images: { url: string; isPrimary: boolean }[] }): FormValues {
  return {
    name: product.name,
    slug: product.slug,
    description: product.description ?? '',
    categoryId: product.categoryId,
    price: String(product.price),
    purchasePrice: String(product.purchasePrice),
    distributorCode: product.distributorCode ?? '',
    minStock: String(product.minStock),
    warrantyMonths: product.warrantyMonths != null ? String(product.warrantyMonths) : '',
    images: product.images.map(({ url, isPrimary }) => ({ url, isPrimary })),
  };
}

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const productId = Number(id);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sku, setSku] = useState('');
  const [skuPending, setSkuPending] = useState(false);
  const [active, setActive] = useState(true);
  // Read-only here: stock only changes through a movement (Ajustar stock).
  const [stock, setStock] = useState(0);
  const [values, setValues] = useState<FormValues | null>(null);
  const [saved, setSaved] = useState<FormValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const formLoaded = useRef(false);

  // Plain useFocusEffect on purpose, not useDataFocusEffect — a background
  // sync must not overwrite what the user is typing. The form is filled only
  // the first time; coming back (e.g. from Ajustar stock) refreshes just the
  // read-only parts, so unsaved edits survive the trip.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      categoriesRepo.list().then((rows) => {
        if (!cancelled) setCategories(rows.filter((c) => c.active));
      });
      Promise.all([productsRepo.getById(productId), pendingUuidsForType('upsertProduct')]).then(([product, pending]) => {
        if (cancelled) return;
        if (product) {
          setSku(product.sku);
          setSkuPending(pending.has(product.uuid));
          setActive(product.active);
          setStock(product.stock);
          if (!formLoaded.current) {
            const loaded = valuesFrom(product);
            setValues(loaded);
            setSaved(loaded);
            formLoaded.current = true;
          }
        }
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [productId]),
  );

  const savedUrls = useMemo(() => new Set((saved?.images ?? []).map((image) => image.url)), [saved]);
  const dirty = values !== null && saved !== null && JSON.stringify(values) !== JSON.stringify(saved);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSubmit() {
    if (!values) return;
    const parsed = productSchema.safeParse({
      name: values.name,
      slug: values.slug,
      description: values.description || undefined,
      price: Number(values.price),
      purchasePrice: values.purchasePrice ? Number(values.purchasePrice) : 0,
      categoryId: values.categoryId,
      distributorCode: values.distributorCode.trim() || undefined,
      minStock: Number(values.minStock) || 0,
      warrantyMonths: values.warrantyMonths ? Number(values.warrantyMonths) : null,
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
      // productSchema defaults stock to 0; update() ignores it anyway.
      await productsRepo.update(productId, parsed.data, values.images);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el producto');
    } finally {
      setSaving(false);
    }
  }

  async function handleSetActive(next: boolean) {
    setSaving(true);
    setError(null);
    try {
      if (next) {
        await productsRepo.update(productId, { active: true });
        setActive(true);
      } else {
        await productsRepo.deactivate(productId);
        router.back();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el estado del producto');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !values) {
    return (
      <ThemedView style={[styles.container, styles.padded]}>
        <ThemedText themeColor="textSecondary">{loading ? 'Cargando…' : 'Producto no encontrado'}</ThemedText>
      </ThemedView>
    );
  }

  const minStock = Number(saved?.minStock) || 0;
  const stockState = stock <= 0 ? 'out' : minStock > 0 && stock <= minStock ? 'low' : 'ok';
  const stockColor = stockState === 'out' ? theme.error : stockState === 'low' ? theme.warning : theme.info;
  const StockIcon = stockState === 'out' ? PackageX : stockState === 'low' ? TriangleAlert : Boxes;

  const price = Number(values.price) || 0;
  const cost = Number(values.purchasePrice) || 0;
  const gain = price - cost;
  const marginPct = price > 0 && cost > 0 ? Math.round((gain / price) * 100) : null;
  const marginColor = gain < 0 ? theme.error : theme.primary;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: saved?.name || 'Producto' }} />
      <SafeAreaView style={styles.flex} edges={[]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.badges}>
              <Badge label={`SKU ${sku}`} color={theme.textSecondary} />
              {skuPending ? <Badge label="Pendiente de sincronizar" color={theme.warning} /> : null}
              <Badge label={active ? 'Activo' : 'Inactivo'} color={active ? theme.primary : theme.error} />
            </View>

            <View style={styles.tiles}>
              <ThemedView type="backgroundElement" style={[styles.tile, Shadow.subtle]}>
                <TileHeader icon={StockIcon} color={stockColor} label="Stock" />
                <ThemedText type="cardTitle" style={stockState !== 'ok' ? { color: stockColor } : undefined}>
                  {stock} {stock === 1 ? 'unidad' : 'unidades'}
                </ThemedText>
                <Link href={`/more/inventory/adjust?productId=${productId}`} asChild>
                  <Pressable hitSlop={6}>
                    <ThemedText type="smallBold" style={{ color: theme.primary }}>
                      Ajustar stock
                    </ThemedText>
                  </Pressable>
                </Link>
              </ThemedView>
              <ThemedView type="backgroundElement" style={[styles.tile, Shadow.subtle]}>
                <TileHeader icon={gain < 0 ? TrendingDown : TrendingUp} color={marginColor} label="Ganancia por unidad" />
                <ThemedText type="cardTitle" style={{ color: cost > 0 ? marginColor : theme.textSecondary }}>
                  {cost > 0 ? formatCOP(gain) : '—'}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {marginPct !== null ? `${marginPct}% del precio` : 'Falta el precio de compra'}
                </ThemedText>
              </ThemedView>
            </View>

            <FormSection title="Fotos">
              <ProductImageGallery images={values.images} onChange={(images) => set('images', images)} onError={setError} savedUrls={savedUrls} />
            </FormSection>

            <FormSection title="Información">
              <FormField label="Nombre">
                <FormInput value={values.name} onChangeText={(v) => set('name', v)} />
              </FormField>
              <FormField label="Categoría">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  <FormChip label="General" selected={values.categoryId === null} onPress={() => set('categoryId', null)} />
                  {categories.map((category) => (
                    <FormChip
                      key={category.id}
                      label={category.name}
                      selected={values.categoryId === category.id}
                      onPress={() => set('categoryId', category.id)}
                    />
                  ))}
                </ScrollView>
              </FormField>
              <FormField label="Descripción (opcional)">
                <FormInput value={values.description} onChangeText={(v) => set('description', v)} multiline />
              </FormField>
            </FormSection>

            <FormSection title="Precios">
              <FormRow>
                <FormField label="Precio de venta" style={styles.flex}>
                  <FormInput prefix="$" value={values.price} onChangeText={(v) => set('price', v)} keyboardType="numeric" />
                </FormField>
                <FormField label="Precio de compra" style={styles.flex}>
                  <FormInput
                    prefix="$"
                    value={values.purchasePrice}
                    onChangeText={(v) => set('purchasePrice', v)}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </FormField>
              </FormRow>
            </FormSection>

            <FormSection title="Inventario">
              <FormRow>
                <FormField label="Stock mínimo" style={styles.flex}>
                  <FormInput value={values.minStock} onChangeText={(v) => set('minStock', v)} keyboardType="numeric" />
                </FormField>
                <FormField label="Garantía (meses)" style={styles.flex}>
                  <FormInput
                    value={values.warrantyMonths}
                    onChangeText={(v) => set('warrantyMonths', v)}
                    keyboardType="numeric"
                    placeholder="Sin garantía"
                  />
                </FormField>
              </FormRow>
              <ThemedText type="caption" themeColor="textSecondary">
                Con el stock en el mínimo o menos, el producto aparece como &quot;stock bajo&quot; en las alertas. El stock se cambia con
                &quot;Ajustar stock&quot;, arriba.
              </ThemedText>
            </FormSection>

            <FormSection title="Identificación">
              <FormField label="Código del proveedor (opcional)" hint="El código con que lo identifica el distribuidor. No se puede repetir.">
                <FormInput
                  value={values.distributorCode}
                  onChangeText={(v) => set('distributorCode', v)}
                  placeholder="Ej. PROV-100"
                  autoCapitalize="none"
                />
              </FormField>
              <FormField label="Slug" hint="La dirección del producto en la página web.">
                <FormInput value={values.slug} onChangeText={(v) => set('slug', v)} autoCapitalize="none" />
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

            <Pressable onPress={() => handleSetActive(!active)} disabled={saving}>
              <View style={[styles.stateButton, { borderColor: withAlpha(active ? theme.error : theme.primary, 0.4) }]}>
                <Power color={active ? theme.error : theme.primary} size={18} />
                <ThemedText type="default" style={{ color: active ? theme.error : theme.primary }}>
                  {active ? 'Desactivar producto' : 'Reactivar producto'}
                </ThemedText>
              </View>
            </Pressable>
            <ThemedText type="caption" themeColor="textSecondary" style={styles.center}>
              {active
                ? 'Un producto desactivado deja de aparecer en Vender. Su historial se conserva.'
                : 'Está desactivado: no aparece en Vender.'}
            </ThemedText>
          </ScrollView>

          <ThemedView
            type="backgroundElement"
            style={[styles.saveBar, { borderTopColor: theme.border, paddingBottom: Spacing.three + insets.bottom }]}>
            <Pressable onPress={handleSubmit} disabled={saving || !dirty}>
              <View style={[styles.saveButton, { backgroundColor: theme.primary }, (saving || !dirty) && styles.disabled]}>
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

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: withAlpha(color, 0.12) }]}>
      <ThemedText type="caption" style={{ color }}>
        {label}
      </ThemedText>
    </View>
  );
}

function TileHeader({ icon: Icon, color, label }: { icon: ComponentType<LucideProps>; color: string; label: string }) {
  return (
    <View style={styles.tileHeader}>
      <View style={[styles.tileIcon, { backgroundColor: withAlpha(color, 0.12) }]}>
        <Icon color={color} size={16} />
      </View>
      <ThemedText type="caption" themeColor="textSecondary" style={styles.flex}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  padded: { padding: Layout.screenPadding },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  scrollContent: { padding: Layout.screenPadding, gap: Layout.cardGap, paddingBottom: Spacing.five },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  badge: { borderRadius: Radii.chip, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  tiles: { flexDirection: 'row', gap: Layout.cardGap },
  tile: { flex: 1, borderRadius: Radii.card, padding: Spacing.three, gap: Spacing.one },
  tileHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.one },
  tileIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  chips: { gap: Spacing.two },
  errorBox: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  stateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderRadius: Radii.buttonPrimary,
    paddingVertical: Spacing.three,
  },
  saveBar: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.three, borderTopWidth: 1 },
  saveButton: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Radii.buttonPrimary },
  onPrimary: { color: '#FFFFFF' },
  disabled: { opacity: 0.5 },
});
