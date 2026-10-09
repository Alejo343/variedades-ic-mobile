import { router, useLocalSearchParams } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormChip, FormField, FormInput, FormSection } from '@/components/form';
import { PosSearchBar, ProductThumb } from '@/components/pos';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { inventoryRepo, productsRepo, type Product } from '@/lib/data';
import { inventoryAdjustmentSchema } from '@/lib/validations';

const QUICK_REASONS = ['Conteo físico', 'Producto dañado', 'Corrección de error'];

export default function AdjustStockScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Opened from a product's edit screen ("Ajustar stock") with that product
  // already chosen; from Inventario, without it.
  const { productId } = useLocalSearchParams<{ productId?: string }>();

  useEffect(() => {
    productsRepo.list().then((rows) => {
      const active = rows.filter((p) => p.active).sort((a, b) => a.name.localeCompare(b.name));
      setProducts(active);
      if (productId) setSelected(active.find((p) => p.id === Number(productId)) ?? null);
    });
  }, [productId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [products, search]);

  const amount = Math.max(0, Math.floor(Number(quantity) || 0));
  const quantityDelta = direction * amount;
  const resulting = selected ? selected.stock + quantityDelta : null;
  // A subtraction past zero is rejected by the repo anyway (applyMovement).
  // Adding is always allowed, even to a negative stock (left by an offline
  // sale) that stays negative — that's exactly how it gets corrected.
  const notEnough = direction === -1 && resulting !== null && resulting < 0;
  const canSave = selected !== null && amount > 0 && !notEnough && reason.trim().length > 0 && !saving;

  async function handleSubmit() {
    if (!selected) {
      setError('Selecciona un producto');
      return;
    }
    const parsed = inventoryAdjustmentSchema.safeParse({
      productId: selected.id,
      quantityDelta,
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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={[]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <FormSection title="Producto">
              {selected ? (
                <View style={styles.selectedRow}>
                  <ProductThumb uri={selected.primaryImageUri} style={styles.thumbLarge} iconSize={22} />
                  <View style={styles.flex}>
                    <ThemedText type="default" numberOfLines={2}>
                      {selected.name}
                    </ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {selected.sku} · stock actual: {selected.stock}
                    </ThemedText>
                  </View>
                  <Pressable onPress={() => setSelected(null)} hitSlop={8}>
                    <ThemedText type="smallBold" style={{ color: theme.primary }}>
                      Cambiar
                    </ThemedText>
                  </Pressable>
                </View>
              ) : (
                <>
                  <PosSearchBar value={search} onChangeText={setSearch} />
                  <ScrollView style={styles.pickList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {filtered.map((product, i) => (
                      <Pressable key={product.id} onPress={() => setSelected(product)}>
                        <View style={[styles.pickRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                          <ProductThumb uri={product.primaryImageUri} style={styles.thumb} iconSize={16} />
                          <View style={styles.flex}>
                            <ThemedText type="small" numberOfLines={1}>
                              {product.name}
                            </ThemedText>
                            <ThemedText type="caption" themeColor="textSecondary">
                              {product.sku}
                            </ThemedText>
                          </View>
                          <ThemedText type="smallBold">{product.stock}</ThemedText>
                        </View>
                      </Pressable>
                    ))}
                    {filtered.length === 0 ? (
                      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                        Ningún producto coincide.
                      </ThemedText>
                    ) : null}
                  </ScrollView>
                </>
              )}
            </FormSection>

            <FormSection title="Ajuste">
              <View style={styles.segmented}>
                <DirectionButton icon={Plus} label="Sumar" selected={direction === 1} color={theme.primary} onPress={() => setDirection(1)} />
                <DirectionButton icon={Minus} label="Restar" selected={direction === -1} color={theme.error} onPress={() => setDirection(-1)} />
              </View>
              <FormField label="Cantidad">
                <FormInput value={quantity} onChangeText={setQuantity} keyboardType="numeric" placeholder="0" />
              </FormField>
              {resulting !== null && amount > 0 ? (
                <View style={[styles.preview, { backgroundColor: withAlpha(notEnough ? theme.error : theme.primary, 0.08) }]}>
                  <ThemedText type="small" style={{ color: notEnough ? theme.error : theme.primary }}>
                    {notEnough
                      ? `No alcanza: hay ${selected!.stock} y quieres restar ${amount}`
                      : `El stock pasa de ${selected!.stock} a ${resulting}`}
                  </ThemedText>
                </View>
              ) : null}
            </FormSection>

            <FormSection title="Motivo">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
                {QUICK_REASONS.map((r) => (
                  <FormChip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
                ))}
              </ScrollView>
              <FormInput value={reason} onChangeText={setReason} placeholder="O escribe el motivo" />
            </FormSection>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: withAlpha(theme.error, 0.08) }]}>
                <ThemedText type="small" style={{ color: theme.error }}>
                  {error}
                </ThemedText>
              </View>
            ) : null}
          </ScrollView>

          <ThemedView type="backgroundElement" style={[styles.bottomBar, { borderTopColor: theme.border, paddingBottom: Spacing.three + insets.bottom }]}>
            <Pressable onPress={handleSubmit} disabled={!canSave}>
              <View style={[styles.primaryButton, { backgroundColor: theme.primary }, !canSave && styles.disabled]}>
                <ThemedText type="cardTitle" style={styles.onPrimary}>
                  {saving ? 'Guardando…' : amount > 0 ? `Registrar ${direction > 0 ? '+' : '−'}${amount}` : 'Registrar ajuste'}
                </ThemedText>
              </View>
            </Pressable>
          </ThemedView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function DirectionButton({
  icon: Icon,
  label,
  selected,
  color,
  onPress,
}: {
  icon: typeof Plus;
  label: string;
  selected: boolean;
  color: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable style={styles.flex} onPress={onPress}>
      <View
        style={[
          styles.directionButton,
          selected ? { backgroundColor: withAlpha(color, 0.12), borderColor: color } : { backgroundColor: theme.background, borderColor: theme.border },
        ]}>
        <Icon color={selected ? color : theme.textSecondary} size={18} />
        <ThemedText type={selected ? 'smallBold' : 'small'} style={{ color: selected ? color : theme.text }}>
          {label}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { textAlign: 'center', paddingVertical: Spacing.three },
  scrollContent: { padding: Layout.screenPadding, gap: Layout.cardGap, paddingBottom: Spacing.five },
  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  thumbLarge: { width: 56, height: 56, borderRadius: Spacing.two },
  thumb: { width: 40, height: 40, borderRadius: Spacing.two },
  pickList: { maxHeight: 280 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  segmented: { flexDirection: 'row', gap: Spacing.two },
  directionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderRadius: Radii.button,
    paddingVertical: Spacing.three,
  },
  preview: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  chips: { gap: Spacing.two },
  errorBox: { borderRadius: Spacing.three, padding: Spacing.three },
  bottomBar: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.three, borderTopWidth: 1 },
  primaryButton: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Radii.buttonPrimary },
  onPrimary: { color: '#FFFFFF' },
  disabled: { opacity: 0.5 },
});
