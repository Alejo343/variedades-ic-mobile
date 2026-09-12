import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { read, utils } from 'xlsx';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { distributorsRepo, productsRepo, purchaseOrdersRepo, type Distributor, type Product } from '@/lib/data';
import { formatCOP } from '@/lib/format';
import { parseImportSheet, resolveImportRows } from '@/lib/purchase-import';
import { purchaseOrderSchema } from '@/lib/validations';

type CartItem = { productId: number; name: string; sku: string; quantity: string; unitCost: string };

export default function NewPurchaseOrderScreen() {
  const theme = useTheme();
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [distributorId, setDistributorId] = useState<number | null>(null);
  const [purchaseType, setPurchaseType] = useState<'contado' | 'credito'>('contado');
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    distributorsRepo.list().then((rows) => setDistributors(rows.filter((d) => d.active)));
    productsRepo.list().then((rows) => setProducts(rows.filter((p) => p.active)));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [products, search]);

  const total = useMemo(() => cart.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0), [cart]);

  function addProduct(product: Product) {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) => (item.productId === product.id ? { ...item, quantity: String((Number(item.quantity) || 0) + 1) } : item));
      }
      return [...prev, { productId: product.id, name: product.name, sku: product.sku, quantity: '1', unitCost: String(product.purchasePrice) }];
    });
    setSearch('');
  }

  function updateItem(productId: number, field: 'quantity' | 'unitCost', value: string) {
    setCart((prev) => prev.map((item) => (item.productId === productId ? { ...item, [field]: value } : item)));
  }

  function removeItem(productId: number) {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }

  function mergeIntoCart(items: CartItem[]) {
    setCart((prev) => {
      const next = [...prev];
      for (const item of items) {
        const existingIndex = next.findIndex((c) => c.productId === item.productId);
        if (existingIndex >= 0) {
          next[existingIndex] = { ...next[existingIndex], quantity: String((Number(next[existingIndex].quantity) || 0) + Number(item.quantity)) };
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

      const resolved = resolveImportRows(rows, products);
      const newItems: CartItem[] = [];
      let createdCount = 0;

      for (const row of resolved) {
        if (row.kind === 'existing') {
          newItems.push({ productId: row.productId, name: row.name, sku: row.sku, quantity: String(row.quantity), unitCost: String(row.unitCost) });
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
          createdCount += 1;
          newItems.push({ productId: product.id, name: product.name, sku: product.sku, quantity: String(row.quantity), unitCost: String(row.unitCost) });
        }
      }

      mergeIntoCart(newItems);

      const summary = [`${resolved.length} producto(s) agregados al carrito.`];
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
      notes: notes || undefined,
      items: cart.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
      })),
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

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="small">Distribuidor (opcional)</ThemedText>
          <ThemedView style={styles.distributorRow}>
            <Pressable onPress={() => setDistributorId(null)}>
              <ThemedView type={distributorId === null ? 'backgroundSelected' : 'backgroundElement'} style={styles.chip}>
                <ThemedText type="small">Sin distribuidor</ThemedText>
              </ThemedView>
            </Pressable>
            {distributors.map((distributor) => (
              <Pressable key={distributor.id} onPress={() => setDistributorId(distributor.id)}>
                <ThemedView type={distributorId === distributor.id ? 'backgroundSelected' : 'backgroundElement'} style={styles.chip}>
                  <ThemedText type="small">{distributor.name}</ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ThemedView>

          <ThemedText type="small">Tipo de pago</ThemedText>
          <ThemedView style={styles.typeRow}>
            <Pressable style={styles.typeFlex} onPress={() => setPurchaseType('contado')}>
              <ThemedView type={purchaseType === 'contado' ? 'backgroundSelected' : 'backgroundElement'} style={styles.typeButton}>
                <ThemedText type={purchaseType === 'contado' ? 'linkPrimary' : undefined}>Contado</ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable style={styles.typeFlex} onPress={() => setPurchaseType('credito')}>
              <ThemedView type={purchaseType === 'credito' ? 'backgroundSelected' : 'backgroundElement'} style={styles.typeButton}>
                <ThemedText type={purchaseType === 'credito' ? 'linkPrimary' : undefined}>Crédito</ThemedText>
              </ThemedView>
            </Pressable>
          </ThemedView>

          <ThemedText type="small" style={styles.label}>
            Agregar producto
          </ThemedText>
          <Pressable onPress={handleImportExcel} disabled={importing}>
            <ThemedView type="backgroundElement" style={styles.importButton}>
              <ThemedText type="small" themeColor={importing ? 'textSecondary' : 'text'}>
                {importing ? 'Importando…' : 'Importar desde Excel (.xlsx)'}
              </ThemedText>
            </ThemedView>
          </Pressable>
          <ThemedText type="small" themeColor="textSecondary" style={styles.importHint}>
            Los productos que no existan en tu catálogo se crean automáticamente.
          </ThemedText>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar producto por nombre o SKU"
            placeholderTextColor={theme.textSecondary}
            style={inputStyle}
          />
          {filtered.length > 0 ? (
            <ThemedView style={styles.productList}>
              {filtered.map((product) => (
                <Pressable key={product.id} onPress={() => addProduct(product)}>
                  <ThemedView type="backgroundElement" style={styles.productRow}>
                    <ThemedText type="small">{product.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {product.sku} · costo: {formatCOP(product.purchasePrice)} · stock: {product.stock}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
            </ThemedView>
          ) : null}

          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Productos en el pedido
          </ThemedText>
          {cart.length === 0 ? (
            <ThemedText themeColor="textSecondary" type="small">
              Ningún producto agregado todavía.
            </ThemedText>
          ) : (
            cart.map((item) => (
              <ThemedView key={item.productId} type="backgroundElement" style={styles.cartRow}>
                <ThemedView style={styles.cartRowHeader}>
                  <ThemedText type="small" style={styles.cartName} numberOfLines={1}>
                    {item.name}
                  </ThemedText>
                  <Pressable onPress={() => removeItem(item.productId)}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Quitar
                    </ThemedText>
                  </Pressable>
                </ThemedView>
                <ThemedView style={styles.cartRowFields}>
                  <ThemedView style={styles.cartField}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Cantidad
                    </ThemedText>
                    <TextInput
                      value={item.quantity}
                      onChangeText={(v) => updateItem(item.productId, 'quantity', v)}
                      keyboardType="numeric"
                      style={inputStyle}
                    />
                  </ThemedView>
                  <ThemedView style={styles.cartField}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Costo unitario
                    </ThemedText>
                    <TextInput
                      value={item.unitCost}
                      onChangeText={(v) => updateItem(item.productId, 'unitCost', v)}
                      keyboardType="numeric"
                      style={inputStyle}
                    />
                  </ThemedView>
                </ThemedView>
                <ThemedText type="small" themeColor="textSecondary">
                  Subtotal: {formatCOP((Number(item.quantity) || 0) * (Number(item.unitCost) || 0))}
                </ThemedText>
              </ThemedView>
            ))
          )}

          <ThemedText type="small" style={styles.label}>
            Notas (opcional)
          </ThemedText>
          <TextInput value={notes} onChangeText={setNotes} style={inputStyle} multiline />

          <ThemedView type="backgroundElement" style={styles.totalBlock}>
            <ThemedText>Costo total</ThemedText>
            <ThemedText type="linkPrimary" style={styles.totalAmount}>
              {formatCOP(total)}
            </ThemedText>
          </ThemedView>

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <Pressable onPress={handleSubmit} disabled={saving || cart.length === 0}>
            <ThemedView type="backgroundSelected" style={styles.submitButton}>
              <ThemedText type="linkPrimary">{saving ? 'Creando…' : 'Crear pedido'}</ThemedText>
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
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  label: { marginTop: Spacing.two },
  importButton: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  importHint: { marginBottom: Spacing.two },
  distributorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginBottom: Spacing.two },
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
  },
  typeRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.two },
  typeFlex: { flex: 1 },
  typeButton: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  productList: { maxHeight: 200, marginBottom: Spacing.two },
  productRow: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.one,
  },
  sectionTitle: { marginTop: Spacing.two, marginBottom: Spacing.one },
  cartRow: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    marginBottom: Spacing.two,
    gap: Spacing.one,
  },
  cartRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cartName: { flex: 1, marginRight: Spacing.two },
  cartRowFields: { flexDirection: 'row', gap: Spacing.two },
  cartField: { flex: 1 },
  totalBlock: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalAmount: { fontSize: 20 },
  error: { color: '#d9534f' },
  submitButton: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
