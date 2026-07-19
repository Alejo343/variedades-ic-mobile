import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { directSalesRepo, productsRepo, type Product } from '@/lib/data';
import { formatCOP } from '@/lib/format';
import { directSaleSchema } from '@/lib/validations';

type CartItem = { productId: number; name: string; sku: string; quantity: string; unitPrice: string };

export default function NewDirectSaleScreen() {
  const theme = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    productsRepo.list().then((rows) => setProducts(rows.filter((p) => p.active)));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [products, search]);

  const total = useMemo(() => cart.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0), [cart]);

  function addProduct(product: Product) {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) => (item.productId === product.id ? { ...item, quantity: String((Number(item.quantity) || 0) + 1) } : item));
      }
      return [...prev, { productId: product.id, name: product.name, sku: product.sku, quantity: '1', unitPrice: String(product.price) }];
    });
    setSearch('');
  }

  function updateItem(productId: number, field: 'quantity' | 'unitPrice', value: string) {
    setCart((prev) => prev.map((item) => (item.productId === productId ? { ...item, [field]: value } : item)));
  }

  function removeItem(productId: number) {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }

  async function handleSubmit() {
    const parsed = directSaleSchema.safeParse({
      items: cart.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
      })),
      notes: notes || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await directSalesRepo.create(parsed.data);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar la venta');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="small">Agregar producto</ThemedText>
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
                      {product.sku} · {formatCOP(product.price)} · stock: {product.stock}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
            </ThemedView>
          ) : null}

          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Productos en la venta
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
                      Precio unitario
                    </ThemedText>
                    <TextInput
                      value={item.unitPrice}
                      onChangeText={(v) => updateItem(item.productId, 'unitPrice', v)}
                      keyboardType="numeric"
                      style={inputStyle}
                    />
                  </ThemedView>
                </ThemedView>
                <ThemedText type="small" themeColor="textSecondary">
                  Subtotal: {formatCOP((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
                </ThemedText>
              </ThemedView>
            ))
          )}

          <ThemedText type="small" style={styles.label}>
            Notas (opcional)
          </ThemedText>
          <TextInput value={notes} onChangeText={setNotes} style={inputStyle} multiline />

          <ThemedView type="backgroundElement" style={styles.totalBlock}>
            <ThemedText>Total</ThemedText>
            <ThemedText type="linkPrimary" style={styles.totalAmount}>
              {formatCOP(total)}
            </ThemedText>
          </ThemedView>

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <Pressable onPress={handleSubmit} disabled={saving || cart.length === 0}>
            <ThemedView type="backgroundSelected" style={styles.submitButton}>
              <ThemedText type="linkPrimary">{saving ? 'Cobrando…' : 'Cobrar'}</ThemedText>
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
