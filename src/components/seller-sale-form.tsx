import { PackageOpen, Trash2 } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOutLeft, LinearTransition } from 'react-native-reanimated';

import { AnimatedTotal, CartRow, PosSearchBar, ProductCard, ProductGrid } from '@/components/pos';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useMySeller } from '@/hooks/use-my-seller';
import { useTheme } from '@/hooks/use-theme';
import { calculateCommission, type CommissionConfig } from '@/lib/domain/commission';
import { productsRepo, sellersRepo, sellerSalesRepo, type Seller } from '@/lib/data';
import { formatCOP } from '@/lib/format';
import { triggerSaleSuccessOverlay } from '@/lib/success-overlay';
import { sellerSaleSchema } from '@/lib/validations';

type InventoryOption = {
  productId: number;
  name: string;
  sku: string;
  imageUri: string | null;
  available: number;
  defaultPrice: number;
};
type CartItem = {
  productId: number;
  name: string;
  imageUri: string | null;
  available: number;
  quantity: number;
  unitPrice: string;
};

const PAGE_SIZE = 6;

// Shared by the owner's "register a sale for this seller" modal and the
// seller's own Vender tab — `onSaved` is what differs (close the modal vs.
// reset the form for the next sale). Same look as the shop POS
// (sell/index.tsx), but the catalog is only what this seller holds and the
// unit price stays editable, as it always was for consignment sales.
export function SellerSaleForm({ sellerId, onSaved }: { sellerId: number; onSaved: () => void }) {
  const theme = useTheme();
  const { isSeller } = useMySeller();

  const [seller, setSeller] = useState<Seller | null>(null);
  const [options, setOptions] = useState<InventoryOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submitButtonRef = useRef<View>(null);

  // Reloads on focus: the Vender tab stays mounted, so a sync that changed the
  // seller's inventory while another tab was open must show up on return.
  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      sellersRepo.getById(sellerId).then((found) => {
        if (!cancelled) setSeller(found);
      });
      Promise.all([sellersRepo.getInventory(sellerId), productsRepo.list()]).then(([lines, products]) => {
        if (cancelled) return;
        const productById = Object.fromEntries(products.map((p) => [p.id, p]));
        setOptions(
          lines.map((line) => ({
            productId: line.productId,
            available: line.quantity,
            name: productById[line.productId]?.name ?? `Producto #${line.productId}`,
            sku: productById[line.productId]?.sku ?? '',
            imageUri: productById[line.productId]?.primaryImageUri ?? null,
            defaultPrice: productById[line.productId]?.price ?? 0,
          })),
        );
        setLoaded(true);
      });
      return () => {
        cancelled = true;
      };
    }, [sellerId]),
  );

  const catalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q) || o.sku.toLowerCase().includes(q));
  }, [options, search]);
  const visibleCatalog = catalog.slice(0, visibleCount);
  const unitsHeld = options.reduce((sum, o) => sum + o.available, 0);

  const total = useMemo(() => cart.reduce((sum, item) => sum + item.quantity * (Number(item.unitPrice) || 0), 0), [cart]);
  const totalQuantity = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const estimatedCommission = useMemo(() => {
    if (!seller) return 0;
    const config: CommissionConfig = {
      type: seller.commissionType,
      value: seller.commissionValue,
    };
    return calculateCommission(config, total, totalQuantity);
  }, [seller, total, totalQuantity]);

  function toggleProduct(option: InventoryOption) {
    setCart((prev) => {
      if (prev.some((item) => item.productId === option.productId)) {
        return prev.filter((item) => item.productId !== option.productId);
      }
      return [
        ...prev,
        {
          productId: option.productId,
          name: option.name,
          imageUri: option.imageUri,
          available: option.available,
          quantity: 1,
          unitPrice: String(option.defaultPrice),
        },
      ];
    });
  }

  function changeQuantity(productId: number, delta: number) {
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity: Math.min(item.available, Math.max(1, item.quantity + delta)),
            }
          : item,
      ),
    );
  }

  function changePrice(productId: number, value: string) {
    setCart((prev) => prev.map((item) => (item.productId === productId ? { ...item, unitPrice: value } : item)));
  }

  function removeItem(productId: number) {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }

  function measureSubmitOrigin(): Promise<{ x: number; y: number } | null> {
    return new Promise((resolve) => {
      const node = submitButtonRef.current;
      if (!node) {
        resolve(null);
        return;
      }
      node.measureInWindow((bx, by, bw, bh) => resolve({ x: bx + bw / 2, y: by + bh / 2 }));
    });
  }

  async function handleSubmit() {
    const parsed = sellerSaleSchema.safeParse({
      sellerId,
      items: cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
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
      await sellerSalesRepo.create(parsed.data);
      const origin = await measureSubmitOrigin();
      if (origin) triggerSaleSuccessOverlay(origin);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar la venta');
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <ThemedText type="cardTitle">{isSeller ? 'Tu mercancía' : (seller?.name ?? `Vendedor #${sellerId}`)}</ThemedText>
            <ThemedText type="secondary" themeColor="textSecondary">
              {loaded
                ? `${options.length} ${options.length === 1 ? 'producto' : 'productos'} · ${unitsHeld} ${unitsHeld === 1 ? 'unidad' : 'unidades'} ${isSeller ? 'contigo' : 'en su poder'}`
                : 'Cargando…'}
            </ThemedText>
          </View>

          {loaded && options.length === 0 ? (
            <ThemedView type="backgroundElement" style={[styles.emptyCard, Shadow.subtle]}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.primaryLight }]}>
                <PackageOpen color={theme.primary} size={28} />
              </View>
              <ThemedText type="cardTitle" style={styles.centerText}>
                {isSeller ? 'No tienes mercancía todavía' : 'Este vendedor no tiene mercancía'}
              </ThemedText>
              <ThemedText type="secondary" themeColor="textSecondary" style={styles.centerText}>
                Los productos aparecen aquí cuando se registra una entrega.
              </ThemedText>
            </ThemedView>
          ) : null}

          {options.length > 0 ? (
            <>
              <PosSearchBar
                value={search}
                onChangeText={(v) => {
                  setSearch(v);
                  setVisibleCount(PAGE_SIZE);
                }}
              />

              <ProductGrid>
                {(cardWidth) =>
                  visibleCatalog.map((option) => (
                    <ProductCard
                      key={option.productId}
                      name={option.name}
                      price={option.defaultPrice}
                      imageUri={option.imageUri}
                      caption={`${isSeller ? 'Tienes' : 'Tiene'} ${option.available}`}
                      cardWidth={cardWidth}
                      selected={cart.some((item) => item.productId === option.productId)}
                      quantity={cart.find((item) => item.productId === option.productId)?.quantity}
                      onPress={() => toggleProduct(option)}
                    />
                  ))
                }
              </ProductGrid>

              {catalog.length === 0 ? (
                <ThemedText themeColor="textSecondary" type="small" style={styles.centerText}>
                  Sin productos que coincidan.
                </ThemedText>
              ) : null}

              {visibleCount < catalog.length ? (
                <Pressable onPress={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                  <ThemedView type="backgroundElement" style={[styles.moreButton, Shadow.subtle]}>
                    <ThemedText type="link">Ver más productos</ThemedText>
                  </ThemedView>
                </Pressable>
              ) : null}

              <ThemedView type="backgroundElement" style={[styles.card, styles.cartCard, Shadow.subtle]}>
                <View style={styles.cartHeader}>
                  <ThemedText type="smallBold">Carrito</ThemedText>
                  {cart.length > 0 ? (
                    <Pressable onPress={() => setCart([])} style={styles.clearButton}>
                      <Trash2 color={theme.error} size={16} />
                      <ThemedText type="small" style={{ color: theme.error }}>
                        Vaciar
                      </ThemedText>
                    </Pressable>
                  ) : null}
                </View>
                <View style={[styles.cartHeaderDivider, { backgroundColor: theme.border }]} />

                {cart.length === 0 ? (
                  <ThemedText themeColor="textSecondary" type="small">
                    Toca un producto para agregarlo.
                  </ThemedText>
                ) : (
                  cart.map((item, index) => (
                    <Animated.View
                      key={item.productId}
                      entering={FadeInDown.duration(220)}
                      exiting={FadeOutLeft.duration(180)}
                      layout={LinearTransition.delay(140)}>
                      <CartRow
                        name={item.name}
                        imageUri={item.imageUri}
                        quantity={item.quantity}
                        max={item.available}
                        lineTotal={item.quantity * (Number(item.unitPrice) || 0)}
                        onIncrement={() => changeQuantity(item.productId, 1)}
                        onDecrement={() => changeQuantity(item.productId, -1)}
                        onRemove={() => removeItem(item.productId)}
                        unitPrice={{
                          value: item.unitPrice,
                          onChange: (v) => changePrice(item.productId, v),
                        }}
                      />
                      {index < cart.length - 1 ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
                    </Animated.View>
                  ))
                )}
              </ThemedView>

              <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
                <ThemedText type="smallBold">Notas (opcional)</ThemedText>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Ej. cliente, forma de pago…"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  style={[styles.notesInput, { color: theme.text, borderColor: theme.border }]}
                />
              </ThemedView>

              <ThemedView type="backgroundElement" style={[styles.card, styles.checkoutCard, Shadow.subtle]}>
                <View style={styles.totalRow}>
                  <ThemedText type="cardTitle">Total</ThemedText>
                  <AnimatedTotal value={total} color={theme.primary} />
                </View>
                <View style={[styles.commissionRow, { backgroundColor: withAlpha(theme.primary, 0.08) }]}>
                  <ThemedText type="small" style={{ color: theme.primary }}>
                    {isSeller ? 'Tu comisión por esta venta' : 'Comisión estimada'}
                  </ThemedText>
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>
                    {formatCOP(estimatedCommission)}
                  </ThemedText>
                </View>

                {error ? <ThemedText style={{ color: theme.error }}>{error}</ThemedText> : null}

                <Pressable ref={submitButtonRef} onPress={handleSubmit} disabled={saving || cart.length === 0}>
                  <View
                    style={[
                      styles.submitButton,
                      { backgroundColor: theme.primary },
                      (saving || cart.length === 0) && styles.submitButtonDisabled,
                    ]}>
                    <ThemedText type="sectionTitle" style={styles.submitLabel}>
                      {saving ? 'Registrando…' : 'Registrar venta'}
                    </ThemedText>
                  </View>
                </Pressable>
              </ThemedView>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: {
    padding: Layout.screenPadding,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  header: { gap: Spacing.half },
  centerText: { textAlign: 'center' },
  emptyCard: {
    borderRadius: Radii.card,
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  moreButton: {
    borderRadius: Radii.button,
    padding: Spacing.three,
    alignItems: 'center',
  },
  card: { borderRadius: Radii.card, padding: Spacing.three, gap: Spacing.two },
  cartCard: { paddingBottom: Spacing.two, gap: 0 },
  cartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  cartHeaderDivider: {
    height: 1,
    marginHorizontal: -Spacing.three,
    marginBottom: Spacing.one,
  },
  clearButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  divider: { height: 1 },
  notesInput: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    minHeight: 72,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  checkoutCard: { gap: Spacing.three },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  submitButton: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
    borderRadius: Radii.buttonPrimary,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitLabel: { color: '#FFFFFF' },
});
