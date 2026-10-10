import { PackageOpen, Trash2 } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOutLeft, LinearTransition } from 'react-native-reanimated';

import { FormInput, FormSection } from '@/components/form';
import { CartRow, PosSearchBar, ProductCard, ProductGrid } from '@/components/pos';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatCOP } from '@/lib/format';

export type StockOption = {
  productId: number;
  name: string;
  sku: string;
  imageUri: string | null;
  // Most that can move (principal stock for a delivery, what the seller holds
  // for a return or loss).
  available: number;
  // Shown under the card name, e.g. the sale price or the cost.
  price: number;
  // Prefills the line's cost when `withCost` (purchasePrice).
  defaultCost: number;
};

export type StockCartLine = { productId: number; quantity: number; unitCost: number };

const PAGE_SIZE = 9;

type Props = {
  // Picker or summary above the catalog (who, what kind) — owned by the screen.
  header: ReactNode;
  options: StockOption[] | null;
  // "Tiene 4", "Stock: 12"...
  availableLabel: (available: number) => string;
  emptyTitle: string;
  emptyText: string;
  // Editable cost per line (deliveries, losses); returns move no money.
  withCost?: boolean;
  // Total line under the cart, e.g. "Costo total". Only with `withCost`.
  totalLabel?: string;
  submitLabel: string;
  // Disabled while false even with a cart (e.g. no seller chosen yet).
  ready?: boolean;
  tint?: string;
  onSubmit: (lines: StockCartLine[], notes: string) => Promise<void>;
};

// Catalog grid + cart + notes + fixed submit, shared by the owner's delivery,
// return and loss screens — same look as the POS (components/pos.tsx).
export function StockCartForm({
  header,
  options,
  availableLabel,
  emptyTitle,
  emptyText,
  withCost = false,
  totalLabel = 'Total',
  submitLabel,
  ready = true,
  tint,
  onSubmit,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const color = tint ?? theme.primary;
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [cart, setCart] = useState<(StockOption & { quantity: number; unitCost: string })[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const catalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = options ?? [];
    if (!q) return list;
    return list.filter((o) => o.name.toLowerCase().includes(q) || o.sku.toLowerCase().includes(q));
  }, [options, search]);

  const units = cart.reduce((sum, line) => sum + line.quantity, 0);
  const total = cart.reduce((sum, line) => sum + line.quantity * (Number(line.unitCost) || 0), 0);
  const canSubmit = ready && cart.length > 0 && !saving;

  function toggle(option: StockOption) {
    setCart((prev) =>
      prev.some((l) => l.productId === option.productId)
        ? prev.filter((l) => l.productId !== option.productId)
        : [...prev, { ...option, quantity: 1, unitCost: String(option.defaultCost) }],
    );
  }

  function changeQuantity(productId: number, delta: number) {
    setCart((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, quantity: Math.min(l.available, Math.max(1, l.quantity + delta)) } : l)),
    );
  }

  async function handleSubmit() {
    setError(null);
    setSaving(true);
    try {
      await onSubmit(
        cart.map((l) => ({ productId: l.productId, quantity: l.quantity, unitCost: Number(l.unitCost) || 0 })),
        notes.trim(),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={[]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {header}

            {options !== null && options.length === 0 ? (
              <ThemedView type="backgroundElement" style={[styles.emptyCard, Shadow.subtle]}>
                <View style={[styles.emptyIcon, { backgroundColor: withAlpha(color, 0.12) }]}>
                  <PackageOpen color={color} size={28} />
                </View>
                <ThemedText type="cardTitle" style={styles.center}>
                  {emptyTitle}
                </ThemedText>
                <ThemedText type="secondary" themeColor="textSecondary" style={styles.center}>
                  {emptyText}
                </ThemedText>
              </ThemedView>
            ) : null}

            {options && options.length > 0 ? (
              <>
                <View>
                  <PosSearchBar
                    value={search}
                    onChangeText={(v) => {
                      setSearch(v);
                      setVisibleCount(PAGE_SIZE);
                    }}
                  />
                  <ProductGrid>
                    {(cardWidth) =>
                      catalog.slice(0, visibleCount).map((option) => {
                        const line = cart.find((l) => l.productId === option.productId);
                        return (
                          <ProductCard
                            key={option.productId}
                            name={option.name}
                            price={option.price}
                            imageUri={option.imageUri}
                            caption={option.available <= 0 ? 'Sin unidades' : availableLabel(option.available)}
                            captionTone={option.available <= 0 ? 'error' : 'normal'}
                            cardWidth={cardWidth}
                            selected={!!line}
                            quantity={line?.quantity}
                            disabled={option.available <= 0 && !line}
                            onPress={() => toggle(option)}
                          />
                        );
                      })
                    }
                  </ProductGrid>
                  {catalog.length === 0 ? (
                    <ThemedText type="small" themeColor="textSecondary" style={[styles.center, styles.noMatch]}>
                      Ningún producto coincide.
                    </ThemedText>
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
                    <ThemedText type="smallBold">
                      {cart.length === 0 ? 'Productos' : `${units} ${units === 1 ? 'unidad' : 'unidades'}`}
                    </ThemedText>
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
                      Toca un producto para agregarlo.
                    </ThemedText>
                  ) : (
                    cart.map((line, index) => (
                      <Animated.View
                        key={line.productId}
                        entering={FadeInDown.duration(200)}
                        exiting={FadeOutLeft.duration(160)}
                        layout={LinearTransition.delay(120)}>
                        {index > 0 ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
                        <CartRow
                          name={line.name}
                          imageUri={line.imageUri}
                          quantity={line.quantity}
                          max={line.available}
                          lineTotal={withCost ? line.quantity * (Number(line.unitCost) || 0) : undefined}
                          onIncrement={() => changeQuantity(line.productId, 1)}
                          onDecrement={() => changeQuantity(line.productId, -1)}
                          onRemove={() => setCart((prev) => prev.filter((l) => l.productId !== line.productId))}
                          unitPrice={
                            withCost
                              ? {
                                  value: line.unitCost,
                                  label: 'Costo c/u $',
                                  onChange: (v) =>
                                    setCart((prev) => prev.map((l) => (l.productId === line.productId ? { ...l, unitCost: v } : l))),
                                }
                              : undefined
                          }
                        />
                      </Animated.View>
                    ))
                  )}
                </ThemedView>

                <FormSection title="Notas">
                  <FormInput value={notes} onChangeText={setNotes} placeholder="Opcional" multiline />
                </FormSection>
              </>
            ) : null}

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
            {withCost && cart.length > 0 ? (
              <View style={styles.totalRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  {totalLabel}
                </ThemedText>
                <ThemedText type="cardTitle">{formatCOP(total)}</ThemedText>
              </View>
            ) : null}
            <Pressable onPress={handleSubmit} disabled={!canSubmit}>
              <View style={[styles.primaryButton, { backgroundColor: color }, !canSubmit && styles.disabled]}>
                <ThemedText type="cardTitle" style={styles.onPrimary}>
                  {saving ? 'Guardando…' : submitLabel}
                </ThemedText>
              </View>
            </Pressable>
          </ThemedView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  scrollContent: { padding: Layout.screenPadding, gap: Layout.cardGap, paddingBottom: Spacing.five },
  emptyCard: { borderRadius: Radii.card, padding: Spacing.five, alignItems: 'center', gap: Spacing.two },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  noMatch: { paddingVertical: Spacing.three },
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
