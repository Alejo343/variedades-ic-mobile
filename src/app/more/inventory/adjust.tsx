import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { inventoryRepo, productsRepo, type Product } from '@/lib/data';
import { inventoryAdjustmentSchema } from '@/lib/validations';

export default function AdjustStockScreen() {
  const theme = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const [quantityDelta, setQuantityDelta] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    productsRepo.list().then((rows) => setProducts(rows.filter((p) => p.active)));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [products, search]);

  async function handleSubmit() {
    if (!selected) {
      setError('Selecciona un producto');
      return;
    }
    const parsed = inventoryAdjustmentSchema.safeParse({
      productId: selected.id,
      quantityDelta: Number(quantityDelta),
      reason,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await inventoryRepo.recordAdjustment(parsed.data);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el ajuste');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="small">Producto</ThemedText>
          {selected ? (
            <Pressable onPress={() => setSelected(null)}>
              <ThemedView type="backgroundSelected" style={styles.selectedProduct}>
                <ThemedText>{selected.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {selected.sku} · stock actual: {selected.stock}
                </ThemedText>
              </ThemedView>
            </Pressable>
          ) : (
            <>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar producto por nombre o SKU"
                placeholderTextColor={theme.textSecondary}
                style={inputStyle}
              />
              <ScrollView style={styles.productList} nestedScrollEnabled>
                {filtered.map((product) => (
                  <Pressable key={product.id} onPress={() => setSelected(product)}>
                    <ThemedView type="backgroundElement" style={styles.productRow}>
                      <ThemedText type="small">{product.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {product.sku} · stock: {product.stock}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          <ThemedText type="small" style={styles.label}>
            Cantidad (negativo para restar)
          </ThemedText>
          <TextInput
            value={quantityDelta}
            onChangeText={setQuantityDelta}
            keyboardType="default"
            placeholder="Ej. 5 o -3"
            placeholderTextColor={theme.textSecondary}
            style={inputStyle}
          />

          <ThemedText type="small">Motivo</ThemedText>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Ej. conteo físico, producto dañado"
            placeholderTextColor={theme.textSecondary}
            style={inputStyle}
          />

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <Pressable onPress={handleSubmit} disabled={saving}>
            <ThemedView type="backgroundSelected" style={styles.submitButton}>
              <ThemedText type="linkPrimary">{saving ? 'Guardando…' : 'Registrar ajuste'}</ThemedText>
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
  productList: { maxHeight: 240, marginBottom: Spacing.two },
  productRow: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.one,
  },
  selectedProduct: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.two,
    gap: Spacing.half,
  },
  error: { color: '#d9534f' },
  submitButton: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
