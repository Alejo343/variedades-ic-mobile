import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormChip, FormField, FormInput, FormRow, FormSection } from '@/components/form';
import { ProductImageGallery } from '@/components/product-image-gallery';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { categoriesRepo, productsRepo, type Category, type Product } from '@/lib/data';
import type { ImageDraft } from '@/lib/domain/product-images';
import { formatCOP } from '@/lib/format';
import { planNewProduct } from '@/lib/purchase-import';
import { productSchema, toSlug } from '@/lib/validations';

// The one "create a product" form in the app, in two modes:
// - 'catalog' (Productos → Nuevo producto): initial stock is editable and is
//   recorded as a "Stock inicial" adjustment (products-repo create).
// - 'order' (Compras → Nuevo pedido → Producto nuevo): no initial stock — it
//   arrives when the order is received, so it would count twice — and instead
//   a quantity for the order. The cost is required (it's the order line's
//   cost); the sale price may stay empty and then equals the cost, same as
//   the Excel import.
// In both, a name that already exists (planNewProduct: no accents, case or
// extra spaces; inactive products included) blocks a duplicate and offers
// that product instead.
type Props = {
  mode: 'catalog' | 'order';
  initialName?: string;
  submitLabel: string;
  onCreated: (product: Product, order: { quantity: number; unitCost: number } | null) => void;
  // A product with that name (or that supplier code) already exists:
  // catalog → go edit it; order → add it to the order.
  onExisting: (product: Product) => void;
  existingLabel: (product: Product) => string;
};

// Only digits: "8.500" (thousands separator) or "8500" → 8500.
function parsePesos(text: string): number | null {
  const digits = text.trim().replace(/\./g, '');
  return /^\d+$/.test(digits) ? Number(digits) : null;
}

export function NewProductForm({ mode, initialName = '', submitLabel, onCreated, onExisting, existingLabel }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isOrder = mode === 'order';

  const [categories, setCategories] = useState<Category[]>([]);
  // Every product, inactive ones too: their names and slugs still count.
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [name, setName] = useState(initialName);
  // null = follow the name; set once the slug is typed by hand.
  const [slugOverride, setSlugOverride] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [distributorCode, setDistributorCode] = useState('');
  const [stock, setStock] = useState('');
  const [orderQuantity, setOrderQuantity] = useState('1');
  const [minStock, setMinStock] = useState('');
  const [warrantyMonths, setWarrantyMonths] = useState('');
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    categoriesRepo.list().then((rows) => setCategories(rows.filter((c) => c.active)));
    productsRepo.list().then(setAllProducts);
  }, []);

  const plan = planNewProduct(name, allProducts);
  const duplicate = !plan.ok && plan.reason === 'duplicate' ? (allProducts.find((p) => p.id === plan.existingId) ?? null) : null;
  const slug = slugOverride ?? (plan.ok ? plan.slug : toSlug(name));

  const cost = parsePesos(purchasePrice);
  const typedPrice = price.trim() ? parsePesos(price) : null;
  // In an order the sale price may be left empty: it then equals the cost.
  const salePrice = isOrder && !price.trim() ? cost : typedPrice;
  const quantity = Math.floor(Number(orderQuantity) || 0);
  const canSave =
    plan.ok &&
    salePrice !== null &&
    (!isOrder || (cost !== null && quantity >= 1)) &&
    (purchasePrice.trim() === '' || cost !== null) &&
    !saving;

  async function handleSubmit() {
    if (!plan.ok || salePrice === null) return;
    const parsed = productSchema.safeParse({
      name: plan.name,
      slug,
      description: description.trim() || undefined,
      price: salePrice,
      purchasePrice: cost ?? 0,
      categoryId,
      distributorCode: distributorCode.trim() || undefined,
      stock: isOrder ? 0 : Number(stock) || 0,
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
      const product = await productsRepo.create(parsed.data, images);
      onCreated(product, isOrder ? { quantity, unitCost: cost ?? 0 } : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el producto');
    } finally {
      setSaving(false);
    }
  }

  const gain = (salePrice ?? 0) - (cost ?? 0);
  const showMargin = (salePrice ?? 0) > 0 && (cost ?? 0) > 0;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <FormSection title="Información">
          <FormField label="Nombre">
            <FormInput value={name} onChangeText={setName} placeholder="Ej. Audífonos Bluetooth" autoFocus={isOrder} />
          </FormField>
          {duplicate ? (
            <View style={[styles.notice, { backgroundColor: withAlpha(theme.warning, 0.1) }]}>
              <ThemedText type="small" style={{ color: theme.warning }}>
                Ya existe «{duplicate.name}» en el catálogo{duplicate.active ? '' : ' (desactivado)'}.
              </ThemedText>
              <Pressable onPress={() => onExisting(duplicate)}>
                <ThemedText type="smallBold" style={{ color: theme.primary }}>
                  {existingLabel(duplicate)}
                </ThemedText>
              </Pressable>
            </View>
          ) : null}
          <FormField label="Categoría">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <FormChip label="General" selected={categoryId === null} onPress={() => setCategoryId(null)} />
              {categories.map((category) => (
                <FormChip key={category.id} label={category.name} selected={categoryId === category.id} onPress={() => setCategoryId(category.id)} />
              ))}
            </ScrollView>
          </FormField>
          <FormField label="Descripción (opcional)">
            <FormInput value={description} onChangeText={setDescription} multiline />
          </FormField>
        </FormSection>

        <FormSection title="Precios">
          <FormRow>
            <FormField label={isOrder ? 'Costo c/u' : 'Precio de compra'} style={styles.flex}>
              <FormInput prefix="$" value={purchasePrice} onChangeText={setPurchasePrice} keyboardType="numeric" placeholder="0" />
            </FormField>
            <FormField label={isOrder ? 'Precio de venta (opcional)' : 'Precio de venta'} style={styles.flex}>
              <FormInput
                prefix="$"
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                placeholder={isOrder && purchasePrice ? purchasePrice : '0'}
              />
            </FormField>
          </FormRow>
          {isOrder ? (
            <ThemedText type="caption" themeColor="textSecondary">
              Si dejas vacío el precio de venta, queda igual al costo. Lo cambias después en el producto.
            </ThemedText>
          ) : null}
          {showMargin ? (
            <View style={[styles.notice, { backgroundColor: withAlpha(gain < 0 ? theme.error : theme.primary, 0.08) }]}>
              <ThemedText type="small" style={{ color: gain < 0 ? theme.error : theme.primary }}>
                {gain < 0 ? 'Pierdes' : 'Ganas'} {formatCOP(Math.abs(gain))} por unidad ({Math.round((gain / (salePrice ?? 1)) * 100)}% del precio)
              </ThemedText>
            </View>
          ) : null}
        </FormSection>

        <FormSection title="Inventario">
          {isOrder ? (
            <FormField label="Cantidad para este pedido" hint="El stock sube cuando marques el pedido como recibido.">
              <FormInput value={orderQuantity} onChangeText={setOrderQuantity} keyboardType="numeric" />
            </FormField>
          ) : (
            <FormField label="Stock inicial" hint={'Se registra como un ajuste de inventario "Stock inicial". Después se cambia desde Ajustar stock.'}>
              <FormInput value={stock} onChangeText={setStock} keyboardType="numeric" placeholder="0" />
            </FormField>
          )}
          <FormRow>
            <FormField label="Stock mínimo" style={styles.flex}>
              <FormInput value={minStock} onChangeText={setMinStock} keyboardType="numeric" placeholder="0" />
            </FormField>
            <FormField label="Garantía (meses)" style={styles.flex}>
              <FormInput value={warrantyMonths} onChangeText={setWarrantyMonths} keyboardType="numeric" placeholder="Sin garantía" />
            </FormField>
          </FormRow>
        </FormSection>

        <FormSection title="Fotos">
          <ProductImageGallery images={images} onChange={setImages} onError={setError} />
        </FormSection>

        <FormSection title="Identificación">
          <FormField label="Código del proveedor (opcional)" hint="El código con que lo identifica el distribuidor. No se puede repetir.">
            <FormInput value={distributorCode} onChangeText={setDistributorCode} placeholder="Ej. PROV-100" autoCapitalize="none" />
          </FormField>
          <FormField label="Slug" hint="La dirección del producto en la página web. Se llena sola con el nombre.">
            <FormInput value={slug} onChangeText={setSlugOverride} autoCapitalize="none" />
          </FormField>
        </FormSection>

        {error ? (
          <View style={[styles.notice, { backgroundColor: withAlpha(theme.error, 0.08) }]}>
            <ThemedText type="small" style={{ color: theme.error }}>
              {error}
            </ThemedText>
            {conflict ? (
              <Pressable onPress={() => onExisting(conflict)}>
                <ThemedText type="smallBold" style={{ color: theme.primary }}>
                  {existingLabel(conflict)}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <ThemedView type="backgroundElement" style={[styles.saveBar, { borderTopColor: theme.border, paddingBottom: Spacing.three + insets.bottom }]}>
        <Pressable onPress={handleSubmit} disabled={!canSave}>
          <View style={[styles.saveButton, { backgroundColor: theme.primary }, !canSave && styles.disabled]}>
            <ThemedText type="cardTitle" style={styles.onPrimary}>
              {saving ? 'Guardando…' : submitLabel}
            </ThemedText>
          </View>
        </Pressable>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { padding: Layout.screenPadding, gap: Layout.cardGap, paddingBottom: Spacing.five },
  chips: { gap: Spacing.two },
  notice: { borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.one },
  saveBar: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.three, borderTopWidth: 1 },
  saveButton: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Radii.buttonPrimary },
  onPrimary: { color: '#FFFFFF' },
  disabled: { opacity: 0.5 },
});
