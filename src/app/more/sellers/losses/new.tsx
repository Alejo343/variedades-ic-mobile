import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { productsRepo, sellerLossesRepo, sellersRepo, type Seller } from '@/lib/data';
import { formatCOP } from '@/lib/format';
import { sellerLossSchema } from '@/lib/validations';

type LossType = 'perdida' | 'dano' | 'robo';
type InventoryOption = { productId: number; name: string; sku: string; available: number; defaultCost: number };
type CartItem = { productId: number; name: string; sku: string; available: number; quantity: string; unitCost: string };

const TYPE_OPTIONS: { value: LossType; label: string }[] = [
  { value: 'perdida', label: 'Pérdida' },
  { value: 'dano', label: 'Daño' },
  { value: 'robo', label: 'Robo' },
];

export default function NewSellerLossScreen() {
  const { sellerId: sellerIdParam } = useLocalSearchParams<{ sellerId: string }>();
  const sellerId = Number(sellerIdParam);
  const theme = useTheme();

  const [seller, setSeller] = useState<Seller | null>(null);
  const [type, setType] = useState<LossType>('perdida');
  const [options, setOptions] = useState<InventoryOption[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    sellersRepo.getById(sellerId).then(setSeller);
    Promise.all([sellersRepo.getInventory(sellerId), productsRepo.list()]).then(([lines, products]) => {
      const productById = Object.fromEntries(products.map((p) => [p.id, p]));
      setOptions(
        lines.map((line) => ({
          productId: line.productId,
          available: line.quantity,
          name: productById[line.productId]?.name ?? `Producto #${line.productId}`,
          sku: productById[line.productId]?.sku ?? '',
          defaultCost: productById[line.productId]?.purchasePrice ?? 0,
        })),
      );
    });
  }, [sellerId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return options.filter((o) => o.name.toLowerCase().includes(q) || o.sku.toLowerCase().includes(q));
  }, [options, search]);

  const totalCost = useMemo(
    () => cart.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0),
    [cart],
  );

  function addProduct(option: InventoryOption) {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === option.productId);
      if (existing) {
        return prev.map((item) => (item.productId === option.productId ? { ...item, quantity: String((Number(item.quantity) || 0) + 1) } : item));
      }
      return [
        ...prev,
        { productId: option.productId, name: option.name, sku: option.sku, available: option.available, quantity: '1', unitCost: String(option.defaultCost) },
      ];
    });
    setSearch('');
  }

  function updateItem(productId: number, field: 'quantity' | 'unitCost', value: string) {
    setCart((prev) => prev.map((item) => (item.productId === productId ? { ...item, [field]: value } : item)));
  }

  function removeItem(productId: number) {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }

  async function handleSubmit() {
    const parsed = sellerLossSchema.safeParse({
      sellerId,
      type,
      items: cart.map((item) => ({ productId: item.productId, quantity: Number(item.quantity), unitCost: Number(item.unitCost) })),
      notes: notes || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await sellerLossesRepo.create(parsed.data);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar la pérdida');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="small">Vendedor</ThemedText>
          <ThemedText type="default" style={styles.sellerName}>
            {seller?.name ?? `Vendedor #${sellerId}`}
          </ThemedText>

          <ThemedText type="small">Tipo</ThemedText>
          <ThemedView style={styles.typeRow}>
            {TYPE_OPTIONS.map((option) => (
              <Pressable key={option.value} style={styles.typeFlex} onPress={() => setType(option.value)}>
                <ThemedView type={type === option.value ? 'backgroundSelected' : 'backgroundElement'} style={styles.typeButton}>
                  <ThemedText type={type === option.value ? 'linkPrimary' : undefined}>{option.label}</ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ThemedView>

          <ThemedText type="small" style={styles.label}>
            Agregar producto (solo lo que este vendedor tiene disponible)
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
              {filtered.map((option) => (
                <Pressable key={option.productId} onPress={() => addProduct(option)}>
                  <ThemedView type="backgroundElement" style={styles.productRow}>
                    <ThemedText type="small">{option.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {option.sku} · disponible: {option.available}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
            </ThemedView>
          ) : null}

          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Productos perdidos
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
                <ThemedText type="small" themeColor="textSecondary">
                  Disponible: {item.available}
                </ThemedText>
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
              {formatCOP(totalCost)}
            </ThemedText>
          </ThemedView>

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <Pressable onPress={handleSubmit} disabled={saving || cart.length === 0}>
            <ThemedView type="backgroundSelected" style={styles.submitButton}>
              <ThemedText type="linkPrimary">{saving ? 'Registrando…' : 'Registrar pérdida'}</ThemedText>
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
  sellerName: { marginBottom: Spacing.two },
  label: { marginTop: Spacing.two },
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
