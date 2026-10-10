import { File } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { FileSpreadsheet, PackagePlus, Plus, Trash2, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOutLeft, LinearTransition } from 'react-native-reanimated';
import { read, utils } from 'xlsx';

import { FormChip, FormInput, FormSection } from '@/components/form';
import { NewProductForm } from '@/components/new-product-form';
import { CartRow, PosSearchBar, ProductCard, ProductGrid } from '@/components/pos';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { distributorsRepo, productsRepo, purchaseOrdersRepo, type Distributor, type Product } from '@/lib/data';
import { formatCOP } from '@/lib/format';
import { parseImportSheet, resolveImportRows } from '@/lib/purchase-import';
import { purchaseOrderSchema } from '@/lib/validations';

type CartItem = { productId: number; name: string; imageUri: string | null; quantity: number; unitCost: string };

const PAGE_SIZE = 9;
// The "Producto nuevo" tile takes the first cell, so the first page shows one
// product less: 1 + 8 = 9 cells fill three rows of three, and each "Ver más"
// adds 9 more, keeping the rows even.
const FIRST_PAGE = PAGE_SIZE - 1;
// A purchase brings stock in, so there's no real upper bound per line.
const NO_LIMIT = 99999;

export default function NewPurchaseOrderScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Opened from a distributor's screen with them preselected.
  const params = useLocalSearchParams<{ distributorId?: string }>();
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [distributorId, setDistributorId] = useState<number | null>(params.distributorId ? Number(params.distributorId) : null);
  const [purchaseType, setPurchaseType] = useState<'contado' | 'credito'>('contado');
  const [products, setProducts] = useState<Product[]>([]);
  // Inactive ones too: their names and slugs still count when creating a
  // product (slug is unique in the database, and a deactivated product with
  // the same name is still that product).
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(FIRST_PAGE);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  // "Producto nuevo" sheet: products ordered for the first time don't exist
  // yet, so they're created right here and go straight into the order.
  const [newProductName, setNewProductName] = useState<string | null>(null);

  useEffect(() => {
    distributorsRepo.list().then((rows) => setDistributors(rows.filter((d) => d.active)));
    productsRepo.list().then((rows) => {
      setAllProducts(rows);
      setProducts(rows.filter((p) => p.active).sort((a, b) => a.name.localeCompare(b.name)));
    });
  }, []);

  const catalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [products, search]);

  const total = cart.reduce((sum, item) => sum + item.quantity * (Number(item.unitCost) || 0), 0);
  const units = cart.reduce((sum, item) => sum + item.quantity, 0);

  function toggleProduct(product: Product) {
    setCart((prev) =>
      prev.some((item) => item.productId === product.id)
        ? prev.filter((item) => item.productId !== product.id)
        : [...prev, { productId: product.id, name: product.name, imageUri: product.primaryImageUri, quantity: 1, unitCost: String(product.purchasePrice) }],
    );
  }

  function addToCart(product: Product, quantity: number, unitCost: number) {
    setCart((prev) =>
      prev.some((item) => item.productId === product.id)
        ? prev.map((item) => (item.productId === product.id ? { ...item, quantity: item.quantity + quantity } : item))
        : [...prev, { productId: product.id, name: product.name, imageUri: product.primaryImageUri, quantity, unitCost: String(unitCost) }],
    );
  }

  function updateItem(productId: number, patch: Partial<CartItem>) {
    setCart((prev) => prev.map((item) => (item.productId === productId ? { ...item, ...patch } : item)));
  }

  function mergeIntoCart(items: CartItem[]) {
    setCart((prev) => {
      const next = [...prev];
      for (const item of items) {
        const existingIndex = next.findIndex((c) => c.productId === item.productId);
        if (existingIndex >= 0) {
          next[existingIndex] = { ...next[existingIndex], quantity: next[existingIndex].quantity + item.quantity };
        } else {
          next.push(item);
        }
      }
      return next;
    });
  }

  // Matches each row against the catalog by product name (the provider's own
  // código in column A never matches our auto-generated SKU, so name is the
  // only usable key — see resolveImportRows). Rows with no match create a new
  // product on the spot (price defaults to the imported unit cost since the
  // sheet has no sale price — editable later from the product's detail screen).
  async function handleImportExcel() {
    const picked = await File.pickFileAsync({
      mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
    });
    if (picked.canceled) return;

    setError(null);
    setImporting(true);
    try {
      const buffer = await picked.result.arrayBuffer();
      const workbook = read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const sheetRows = utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
      const { rows, skipped } = parseImportSheet(sheetRows);

      if (rows.length === 0) {
        setError('No se encontraron filas válidas en el archivo.');
        return;
      }

      const resolved = resolveImportRows(rows, allProducts);
      const newItems: CartItem[] = [];
      let createdCount = 0;

      for (const row of resolved) {
        if (row.kind === 'existing') {
          const product = allProducts.find((p) => p.id === row.productId);
          newItems.push({ productId: row.productId, name: row.name, imageUri: product?.primaryImageUri ?? null, quantity: row.quantity, unitCost: String(row.unitCost) });
        } else {
          const product = await productsRepo.create({
            name: row.name,
            slug: row.slug,
            price: row.unitCost,
            purchasePrice: row.unitCost,
            stock: 0,
            minStock: 0,
            active: true,
          });
          setProducts((prev) => [...prev, product]);
          setAllProducts((prev) => [...prev, product]);
          createdCount += 1;
          newItems.push({ productId: product.id, name: product.name, imageUri: null, quantity: row.quantity, unitCost: String(row.unitCost) });
        }
      }

      mergeIntoCart(newItems);

      const summary = [`${resolved.length} producto(s) agregados al pedido.`];
      if (createdCount > 0) summary.push(`${createdCount} producto(s) nuevo(s) creado(s) en el catálogo.`);
      if (skipped.length > 0) summary.push(`${skipped.length} fila(s) omitida(s) (revisa que tengan nombre, cantidad y valor).`);
      Alert.alert('Importación completa', summary.join('\n'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo importar el archivo');
    } finally {
      setImporting(false);
    }
  }

  async function handleSubmit() {
    const parsed = purchaseOrderSchema.safeParse({
      distributorId,
      purchaseType,
      notes: notes.trim() || undefined,
      items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity, unitCost: Number(item.unitCost) })),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await purchaseOrdersRepo.create(parsed.data);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el pedido');
    } finally {
      setSaving(false);
    }
  }

  const canSave = cart.length > 0 && !saving;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={[]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <FormSection title="Distribuidor">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <FormChip label="Sin distribuidor" selected={distributorId === null} onPress={() => setDistributorId(null)} />
                {distributors.map((d) => (
                  <FormChip key={d.id} label={d.name} selected={distributorId === d.id} onPress={() => setDistributorId(d.id)} />
                ))}
              </ScrollView>
              <View style={styles.chips}>
                <FormChip label="De contado" selected={purchaseType === 'contado'} onPress={() => setPurchaseType('contado')} />
                <FormChip label="A crédito" selected={purchaseType === 'credito'} onPress={() => setPurchaseType('credito')} />
              </View>
              <ThemedText type="caption" themeColor="textSecondary">
                {purchaseType === 'credito'
                  ? 'Queda como cuenta por pagar; registras los pagos desde el pedido.'
                  : 'Se paga al recibirlo; no queda deuda pendiente.'}
              </ThemedText>
            </FormSection>

            <Pressable onPress={handleImportExcel} disabled={importing}>
              <ThemedView type="backgroundElement" style={[styles.importCard, Shadow.subtle]}>
                <View style={[styles.iconDot, { backgroundColor: withAlpha(theme.primary, 0.12) }]}>
                  {importing ? <ActivityIndicator color={theme.primary} /> : <FileSpreadsheet color={theme.primary} size={20} />}
                </View>
                <View style={styles.flex}>
                  <ThemedText type="smallBold">{importing ? 'Importando…' : 'Importar desde Excel'}</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    Columnas: código, nombre, cantidad, valor unitario. Lo que no esté en el catálogo se crea.
                  </ThemedText>
                </View>
              </ThemedView>
            </Pressable>

            <View>
              <PosSearchBar
                value={search}
                onChangeText={(v) => {
                  setSearch(v);
                  setVisibleCount(FIRST_PAGE);
                }}
              />
              <ProductGrid>
                {(cardWidth) => [
                  <NewProductTile key="new" width={cardWidth} onPress={() => setNewProductName(search.trim())} />,
                  ...catalog.slice(0, visibleCount).map((product) => {
                    const line = cart.find((item) => item.productId === product.id);
                    return (
                      <ProductCard
                        key={product.id}
                        name={product.name}
                        price={product.purchasePrice}
                        imageUri={product.primaryImageUri}
                        caption={`Stock: ${product.stock}`}
                        captionTone={product.stock <= 0 ? 'error' : product.minStock > 0 && product.stock <= product.minStock ? 'warning' : 'normal'}
                        cardWidth={cardWidth}
                        selected={!!line}
                        quantity={line?.quantity}
                        onPress={() => toggleProduct(product)}
                      />
                    );
                  }),
                ]}
              </ProductGrid>
              {catalog.length === 0 && search.trim() ? (
                <Pressable onPress={() => setNewProductName(search.trim())}>
                  <View style={[styles.createHint, { borderColor: theme.primary, backgroundColor: theme.primaryLight }]}>
                    <Plus color={theme.primary} size={16} />
                    <ThemedText type="smallBold" style={{ color: theme.primary }} numberOfLines={1}>
                      No está en el catálogo: crear «{search.trim()}»
                    </ThemedText>
                  </View>
                </Pressable>
              ) : null}
              {visibleCount < catalog.length ? (
                <Pressable onPress={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                  <ThemedView type="backgroundElement" style={[styles.moreButton, Shadow.subtle]}>
                    <ThemedText type="link">Ver más productos</ThemedText>
                  </ThemedView>
                </Pressable>
              ) : null}
            </View>

            <ThemedView type="backgroundElement" style={[styles.cartCard, Shadow.subtle]}>
              <View style={styles.cartHeader}>
                <ThemedText type="smallBold">{cart.length === 0 ? 'Pedido' : `${units} ${units === 1 ? 'unidad' : 'unidades'}`}</ThemedText>
                {cart.length > 0 ? (
                  <Pressable onPress={() => setCart([])} hitSlop={6} style={styles.inline}>
                    <Trash2 color={theme.error} size={16} />
                    <ThemedText type="small" style={{ color: theme.error }}>
                      Vaciar
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
              {cart.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.cartEmpty}>
                  Toca productos o importa un Excel para armar el pedido.
                </ThemedText>
              ) : (
                cart.map((item, index) => (
                  <Animated.View key={item.productId} entering={FadeInDown.duration(200)} exiting={FadeOutLeft.duration(160)} layout={LinearTransition.delay(120)}>
                    {index > 0 ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
                    <CartRow
                      name={item.name}
                      imageUri={item.imageUri}
                      quantity={item.quantity}
                      max={NO_LIMIT}
                      lineTotal={item.quantity * (Number(item.unitCost) || 0)}
                      onIncrement={() => updateItem(item.productId, { quantity: item.quantity + 1 })}
                      onDecrement={() => updateItem(item.productId, { quantity: Math.max(1, item.quantity - 1) })}
                      onRemove={() => setCart((prev) => prev.filter((c) => c.productId !== item.productId))}
                      unitPrice={{ value: item.unitCost, label: 'Costo c/u $', onChange: (v) => updateItem(item.productId, { unitCost: v }) }}
                    />
                  </Animated.View>
                ))
              )}
            </ThemedView>

            <FormSection title="Notas">
              <FormInput value={notes} onChangeText={setNotes} placeholder="Opcional" multiline />
            </FormSection>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: withAlpha(theme.error, 0.08) }]}>
                <ThemedText type="small" style={{ color: theme.error }}>
                  {error}
                </ThemedText>
              </View>
            ) : null}
          </ScrollView>

          <ThemedView
            type="backgroundElement"
            style={[styles.bottomBar, { borderTopColor: theme.border, paddingBottom: Spacing.three + insets.bottom }]}>
            {cart.length > 0 ? (
              <View style={styles.totalRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  Costo total
                </ThemedText>
                <ThemedText type="cardTitle">{formatCOP(total)}</ThemedText>
              </View>
            ) : null}
            <Pressable onPress={handleSubmit} disabled={!canSave}>
              <View style={[styles.primaryButton, { backgroundColor: theme.primary }, !canSave && styles.disabled]}>
                <ThemedText type="cardTitle" style={styles.onPrimary}>
                  {saving ? 'Creando…' : 'Crear pedido'}
                </ThemedText>
              </View>
            </Pressable>
          </ThemedView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <NewProductSheet
        initialName={newProductName}
        onClose={() => setNewProductName(null)}
        onExisting={(product) => {
          addToCart(product, 1, product.purchasePrice);
          setNewProductName(null);
        }}
        onCreated={(product, quantity, unitCost) => {
          setProducts((prev) => [...prev, product].sort((a, b) => a.name.localeCompare(b.name)));
          setAllProducts((prev) => [...prev, product]);
          addToCart(product, quantity, unitCost);
          setSearch('');
          setNewProductName(null);
        }}
      />
    </ThemedView>
  );
}

function NewProductTile({ width, onPress }: { width: number; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={{ width }}>
      <View style={[styles.newTile, { borderColor: theme.primary, backgroundColor: theme.primaryLight }]}>
        <PackagePlus color={theme.primary} size={26} />
        <ThemedText type="smallBold" style={[styles.center, { color: theme.primary }]}>
          Producto nuevo
        </ThemedText>
        <ThemedText type="caption" style={[styles.center, { color: theme.primary }]}>
          Si aún no está en el catálogo
        </ThemedText>
      </View>
    </Pressable>
  );
}

// "Producto nuevo" from an order: the same create-product form as
// Productos → Nuevo producto, in 'order' mode (no initial stock, a quantity
// for this order instead), shown as a sheet over the order so nothing typed
// here is lost.
function NewProductSheet({
  initialName,
  onClose,
  onExisting,
  onCreated,
}: {
  // null = closed; '' or the search text = open, prefilled.
  initialName: string | null;
  onClose: () => void;
  onExisting: (product: Product) => void;
  onCreated: (product: Product, quantity: number, unitCost: number) => void;
}) {
  const theme = useTheme();
  return (
    <Modal
      visible={initialName !== null}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
      onRequestClose={onClose}>
      <ThemedView style={styles.flex}>
        <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
          <View style={styles.flex}>
            <ThemedText type="sectionTitle">Producto nuevo</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              Se crea en el catálogo y se agrega a este pedido.
            </ThemedText>
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
            <X color={theme.text} size={20} />
          </Pressable>
        </View>
        {initialName !== null ? (
          <NewProductForm
            key={initialName}
            mode="order"
            initialName={initialName}
            submitLabel="Crear y agregar al pedido"
            onCreated={(product, order) => onCreated(product, order?.quantity ?? 1, order?.unitCost ?? product.purchasePrice)}
            onExisting={onExisting}
            existingLabel={() => 'Agregar ese al pedido'}
          />
        ) : null}
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  scrollContent: { padding: Layout.screenPadding, gap: Layout.cardGap, paddingBottom: Spacing.five },
  chips: { flexDirection: 'row', gap: Spacing.two },
  importCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderRadius: Radii.card, padding: Spacing.three },
  iconDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  newTile: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: Radii.card,
    padding: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    minHeight: 168,
  },
  createHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderWidth: 1.5,
    borderRadius: Radii.button,
    padding: Spacing.three,
    marginTop: Spacing.three,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  moreButton: { borderRadius: Radii.button, padding: Spacing.three, alignItems: 'center', marginTop: Spacing.three },
  cartCard: { borderRadius: Radii.card, paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.two },
  cartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: Spacing.two },
  cartEmpty: { paddingBottom: Spacing.two },
  inline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  divider: { height: 1 },
  errorBox: { borderRadius: Spacing.three, padding: Spacing.three },
  bottomBar: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.three, borderTopWidth: 1, gap: Spacing.two },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  primaryButton: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Radii.buttonPrimary },
  onPrimary: { color: '#FFFFFF' },
  disabled: { opacity: 0.5 },
});
