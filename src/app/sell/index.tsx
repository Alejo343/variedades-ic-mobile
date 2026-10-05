import { Image } from 'expo-image';
import { Minus, Package, Plus, Search, Tag, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutLeft, LinearTransition, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { SellerSaleForm } from '@/components/seller-sale-form';
import { useMySeller } from '@/hooks/use-my-seller';
import { useTheme } from '@/hooks/use-theme';
import { cashAccountsRepo, categoriesRepo, directSalesRepo, productsRepo, type CashAccount, type Category, type Product } from '@/lib/data';
import { formatCOP } from '@/lib/format';
import { resolveImageUri } from '@/lib/sync/image-url';
import { triggerSaleSuccessOverlay } from '@/lib/success-overlay';
import { directSaleSchema } from '@/lib/validations';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';

type CartItem = {
  productId: number;
  name: string;
  sku: string;
  imageUri: string | null;
  stock: number;
  quantity: string;
  unitPrice: string;
};

const PAGE_SIZE = 6;
const GRID_COLUMNS = 3;

// There's no discount column on direct_sale_items — instead of adding one, the
// discount is folded into each line's unitPrice (proportional to its share of
// the subtotal) so the sale recorded in cash_movements matches what was
// actually charged. Rounding remainder goes to the line with the biggest
// subtotal, to keep every unitPrice >= 0.
function applyDiscount(cart: CartItem[], subtotal: number, grandTotal: number) {
  const items = cart.map((item) => ({ productId: item.productId, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice) }));
  if (subtotal === 0 || grandTotal === subtotal) return items;

  const ratio = grandTotal / subtotal;
  const adjusted = items.map((item) => ({ ...item, unitPrice: Math.max(0, Math.round(item.unitPrice * ratio)) }));

  const computedTotal = adjusted.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const remainder = grandTotal - computedTotal;
  if (remainder !== 0) {
    const largestIndex = adjusted.reduce(
      (best, item, index) => (item.quantity * item.unitPrice > adjusted[best].quantity * adjusted[best].unitPrice ? index : best),
      0,
    );
    const target = adjusted[largestIndex];
    target.unitPrice = Math.max(0, target.unitPrice + Math.round(remainder / target.quantity));
  }

  return adjusted;
}

type ProductCardProps = {
  product: Product;
  selected: boolean;
  cardWidth: number;
  onPress: () => void;
};

// Quick scale bounce on tap gives immediate tactile feedback before the
// slower `backgroundSelected` color swap lands.
function ProductCard({ product, selected, cardWidth, onPress }: ProductCardProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const [pressCount, setPressCount] = useState(0);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useEffect(() => {
    if (pressCount === 0) return;
    // react-hooks/immutability false-positives on shared-value mutation here (same
    // pattern as AnimatedTotal below passes lint fine without the extra local state).
    // eslint-disable-next-line react-hooks/immutability
    scale.value = withSequence(withTiming(0.92, { duration: 80 }), withTiming(1, { duration: 120 }));
  }, [pressCount, scale]);

  function handlePress() {
    setPressCount((c) => c + 1);
    onPress();
  }

  return (
    <Pressable onPress={handlePress} style={{ width: cardWidth }}>
      <Animated.View style={animatedStyle}>
        <ThemedView type={selected ? 'backgroundSelected' : 'backgroundElement'} style={[styles.productCard, Shadow.subtle]}>
          {product.primaryImageUri ? (
            <Image source={{ uri: resolveImageUri(product.primaryImageUri) }} style={styles.productImage} />
          ) : (
            <View style={[styles.productImage, styles.productImagePlaceholder, { backgroundColor: theme.primaryLight }]}>
              <Package color={theme.primary} size={22} />
            </View>
          )}
          <ThemedText type="small" numberOfLines={2} style={styles.productName}>
            {product.name}
          </ThemedText>
          <ThemedText type="smallBold">{formatCOP(product.price)}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Stock: {product.stock}
          </ThemedText>
        </ThemedView>
      </Animated.View>
    </Pressable>
  );
}

type CartRowProps = {
  item: CartItem;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
};

// Quantity punches on change so +/- taps register visually, not just numerically.
function CartRow({ item, onIncrement, onDecrement, onRemove }: CartRowProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    // eslint-disable-next-line react-hooks/immutability -- see ProductCard note above
    scale.value = withSequence(withTiming(1.25, { duration: 90 }), withTiming(1, { duration: 120 }));
  }, [item.quantity, scale]);

  return (
    <View style={styles.cartRow}>
      {item.imageUri ? (
        <Image source={{ uri: resolveImageUri(item.imageUri) }} style={styles.cartThumb} />
      ) : (
        <View style={[styles.cartThumb, styles.productImagePlaceholder, { backgroundColor: theme.primaryLight }]}>
          <Package color={theme.primary} size={26} />
        </View>
      )}

      <View style={styles.cartInfo}>
        <ThemedText type="default" numberOfLines={2}>
          {item.name}
        </ThemedText>

        <View style={styles.quantityStepper}>
          <Pressable
            onPress={onDecrement}
            disabled={Number(item.quantity) <= 1}
            style={[styles.stepperButton, { borderColor: theme.primary }, Number(item.quantity) <= 1 && styles.stepperButtonDisabled]}>
            <Minus color={theme.primary} size={16} />
          </Pressable>
          <Animated.View style={animatedStyle}>
            <ThemedText type="smallBold" style={[styles.stepperValue, { color: theme.primary }]}>
              {item.quantity}
            </ThemedText>
          </Animated.View>
          <Pressable
            onPress={onIncrement}
            disabled={Number(item.quantity) >= item.stock}
            style={[
              styles.stepperButton,
              { borderColor: theme.primary },
              Number(item.quantity) >= item.stock && styles.stepperButtonDisabled,
            ]}>
            <Plus color={theme.primary} size={16} />
          </Pressable>
        </View>
        {Number(item.quantity) >= item.stock ? (
          <ThemedText type="caption" themeColor="textSecondary">
            Stock máximo alcanzado
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.cartRight}>
        <ThemedText type="cardTitle">{formatCOP((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}</ThemedText>
        <Pressable onPress={onRemove} style={styles.removeButton}>
          <Trash2 color={theme.error} size={22} />
        </Pressable>
      </View>
    </View>
  );
}

// Small "punch" every time the total actually changes, so the number reads
// as freshly updated rather than a silent re-render.
function AnimatedTotal({ value, color }: { value: number; color: string }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSequence(withTiming(1.08, { duration: 100 }), withTiming(1, { duration: 140 }));
  }, [value, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animatedStyle}>
      <ThemedText type="sectionTitle" style={{ color }}>
        {formatCOP(value)}
      </ThemedText>
    </Animated.View>
  );
}

// The owner keeps the direct-sale POS below; a seller's Vender tab is a
// consignment sale against their own inventory (same form the owner uses
// from the seller detail). Split in two components so the POS's many hooks
// never run conditionally.
export default function SellScreen() {
  const { isSeller } = useMySeller();
  return isSeller ? <SellerSellScreen /> : <OwnerSellScreen />;
}

function SellerSellScreen() {
  const { seller, loading } = useMySeller();
  // Bumping the key remounts the form: empties the cart and reloads the
  // inventory after each saved sale, without leaving the tab.
  const [formKey, setFormKey] = useState(0);

  if (!seller) {
    return (
      <ThemedView style={{ flex: 1, padding: Spacing.four }}>
        <SafeAreaView edges={[]}>
          <ThemedText themeColor="textSecondary">
            {loading ? 'Cargando…' : 'Tu inventario aparecerá después de la primera sincronización (Más → Configuración → Sincronizar ahora).'}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }
  return <SellerSaleForm key={formKey} sellerId={seller.id} onSaved={() => setFormKey((k) => k + 1)} />;
}

function OwnerSellScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [showDiscount, setShowDiscount] = useState(false);
  const [discount, setDiscount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The "Cobrar" button's own position is where the Mercado Libre-style
  // success circle (rendered globally, see SaleSuccessOverlay) grows from.
  const checkoutButtonRef = useRef<View>(null);

  function measureCheckoutOrigin(): Promise<{ x: number; y: number } | null> {
    return new Promise((resolve) => {
      const buttonNode = checkoutButtonRef.current;
      if (!buttonNode) {
        resolve(null);
        return;
      }
      buttonNode.measureInWindow((bx, by, bw, bh) => {
        resolve({ x: bx + bw / 2, y: by + bh / 2 });
      });
    });
  }

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      productsRepo.list().then((rows) => {
        if (!cancelled) setProducts(rows.filter((p) => p.active));
      });
      categoriesRepo.list().then((rows) => {
        if (!cancelled) setCategories(rows.filter((c) => c.active));
      });
      cashAccountsRepo.list().then((rows) => {
        if (!cancelled) {
          const active = rows.filter((a) => a.active);
          setAccounts(active);
          setAccountId((current) => current ?? active[0]?.id ?? null);
        }
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const catalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryId !== null && p.categoryId !== categoryId) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    });
  }, [products, search, categoryId]);

  const visibleCatalog = catalog.slice(0, visibleCount);
  const cardWidth = (width - Layout.screenPadding * 2 - Layout.cardGap * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  function selectCategory(id: number | null) {
    setCategoryId(id);
    setVisibleCount(PAGE_SIZE);
  }

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0), [cart]);
  const discountAmount = Math.min(subtotal, Math.max(0, Number(discount) || 0));
  const grandTotal = subtotal - discountAmount;

  function toggleDiscount() {
    setShowDiscount((prev) => {
      const next = !prev;
      if (!next) setDiscount('');
      return next;
    });
  }

  function toggleProduct(product: Product) {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.filter((item) => item.productId !== product.id);
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          imageUri: product.primaryImageUri,
          stock: product.stock,
          quantity: '1',
          unitPrice: String(product.price),
        },
      ];
    });
  }

  function changeQuantity(productId: number, delta: number) {
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const next = Math.min(item.stock, Math.max(1, (Number(item.quantity) || 0) + delta));
        return { ...item, quantity: String(next) };
      }),
    );
  }

  function removeItem(productId: number) {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }

  function clearCart() {
    setCart([]);
  }

  async function handleSubmit() {
    const parsed = directSaleSchema.safeParse({
      items: applyDiscount(cart, subtotal, grandTotal),
      accountId,
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
      const origin = await measureCheckoutOrigin();
      if (origin) triggerSaleSuccessOverlay(origin);
      setCart([]);
      setNotes('');
      setSearch('');
      setCategoryId(null);
      setVisibleCount(PAGE_SIZE);
      setShowDiscount(false);
      setDiscount('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar la venta');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedView type="backgroundElement" style={[styles.searchBar, Shadow.subtle]}>
            <Search color={theme.textSecondary} size={18} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar productos"
              placeholderTextColor={theme.textSecondary}
              style={[styles.searchInput, { color: theme.text }]}
            />
          </ThemedView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            <Pressable onPress={() => selectCategory(null)}>
              <ThemedView
                type="backgroundElement"
                style={[
                  styles.categoryPill,
                  categoryId === null ? { backgroundColor: theme.primary } : { borderWidth: 1, borderColor: theme.border },
                ]}>
                <ThemedText type="small" style={categoryId === null ? styles.categoryLabelSelected : undefined}>
                  Todos
                </ThemedText>
              </ThemedView>
            </Pressable>
            {categories.map((category) => (
              <Pressable key={category.id} onPress={() => selectCategory(category.id)}>
                <ThemedView
                  type="backgroundElement"
                  style={[
                    styles.categoryPill,
                    categoryId === category.id
                      ? { backgroundColor: theme.primary }
                      : { borderWidth: 1, borderColor: theme.border },
                  ]}>
                  <ThemedText type="small" style={categoryId === category.id ? styles.categoryLabelSelected : undefined}>
                    {category.name}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.productGrid}>
            {visibleCatalog.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                cardWidth={cardWidth}
                selected={cart.some((item) => item.productId === product.id)}
                onPress={() => toggleProduct(product)}
              />
            ))}
          </View>

          {catalog.length === 0 ? (
            <ThemedText themeColor="textSecondary" type="small" style={styles.emptyCatalog}>
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

          <ThemedView type="backgroundElement" style={[styles.cartCard, Shadow.subtle]}>
            <View style={styles.cartHeader}>
              <ThemedText type="smallBold">Carrito</ThemedText>
              {cart.length > 0 ? (
                <Pressable onPress={clearCart} style={styles.clearButton}>
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
                Ningún producto agregado todavía.
              </ThemedText>
            ) : (
              cart.map((item, index) => (
                <Animated.View
                  key={item.productId}
                  entering={FadeInDown.duration(220)}
                  exiting={FadeOutLeft.duration(180)}
                  layout={LinearTransition.delay(140)}>
                  <CartRow
                    item={item}
                    onIncrement={() => changeQuantity(item.productId, 1)}
                    onDecrement={() => changeQuantity(item.productId, -1)}
                    onRemove={() => removeItem(item.productId)}
                  />
                  {index < cart.length - 1 ? <View style={[styles.cartDivider, { backgroundColor: theme.border }]} /> : null}
                </Animated.View>
              ))
            )}
          </ThemedView>

          <ThemedView type="backgroundElement" style={[styles.paymentCard, Shadow.subtle]}>
            <ThemedText type="smallBold" style={styles.paymentCardTitle}>
              Método de pago
            </ThemedText>
            <View style={styles.typeRow}>
              {accounts.map((account) => (
                <Pressable key={account.id} style={styles.typeFlex} onPress={() => setAccountId(account.id)}>
                  <ThemedView type={accountId === account.id ? 'backgroundSelected' : 'backgroundElement'} style={styles.typeButton}>
                    <ThemedText type={accountId === account.id ? 'linkPrimary' : undefined}>{account.name}</ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
            </View>
          </ThemedView>

          <ThemedView type="backgroundElement" style={[styles.notesCard, Shadow.subtle]}>
            <ThemedText type="smallBold">Notas (opcional)</ThemedText>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Ej. cliente frecuente, entrega a domicilio…"
              placeholderTextColor={theme.textSecondary}
              multiline
              style={[styles.notesInput, { color: theme.text, borderColor: theme.border }]}
            />
          </ThemedView>

          <ThemedView type="backgroundElement" style={[styles.checkoutCard, Shadow.subtle]}>
            <Pressable onPress={toggleDiscount}>
              <View
                style={[
                  styles.discountButton,
                  { borderColor: withAlpha(theme.primary, 0.4) },
                  showDiscount && { borderColor: theme.primary, backgroundColor: theme.primaryLight },
                ]}>
                <Tag color={showDiscount ? theme.primary : withAlpha(theme.primary, 0.6)} size={18} />
                <ThemedText type="default" style={{ color: showDiscount ? theme.primary : withAlpha(theme.primary, 0.6) }}>
                  Descuento
                </ThemedText>
              </View>
            </Pressable>

            {showDiscount ? (
              <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)}>
                <View style={styles.totalRow}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Subtotal
                  </ThemedText>
                  <ThemedText type="small">{formatCOP(subtotal)}</ThemedText>
                </View>
                <View style={styles.totalRow}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Descuento
                  </ThemedText>
                  <TextInput
                    value={discount}
                    onChangeText={setDiscount}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                    autoFocus
                    style={[styles.discountInput, { color: theme.error }]}
                  />
                </View>
              </Animated.View>
            ) : null}

            <Animated.View layout={LinearTransition.delay(90)} style={styles.checkoutBottom}>
              <View style={styles.totalRow}>
                <ThemedText type="cardTitle">Total</ThemedText>
                <AnimatedTotal value={grandTotal} color={theme.primary} />
              </View>

              {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

              <Pressable ref={checkoutButtonRef} onPress={handleSubmit} disabled={saving || cart.length === 0}>
                <View
                  style={[
                    styles.checkoutButton,
                    { backgroundColor: theme.primary },
                    (saving || cart.length === 0) && styles.checkoutButtonDisabled,
                  ]}>
                  <ThemedText type="sectionTitle" style={styles.checkoutLabel}>
                    {saving ? 'Cobrando…' : 'Cobrar'}
                  </ThemedText>
                </View>
              </Pressable>
            </Animated.View>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { padding: Spacing.four, gap: Spacing.two },
  notesCard: {
    borderRadius: Radii.card,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    gap: Spacing.two,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    minHeight: 80,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  typeRow: { flexDirection: 'row', gap: Spacing.two },
  typeFlex: { flex: 1 },
  typeButton: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radii.button,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.three,
  },
  searchInput: { flex: 1, paddingVertical: Spacing.three, fontSize: 16 },
  categoryRow: { gap: Spacing.two, paddingBottom: Spacing.three },
  categoryPill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radii.chip,
  },
  categoryLabelSelected: { color: '#FFFFFF' },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Layout.cardGap,
    marginBottom: Spacing.three,
  },
  productCard: {
    borderRadius: Radii.card,
    padding: Spacing.two,
    gap: Spacing.half,
  },
  productImage: { width: '100%', height: 80, borderRadius: Spacing.two },
  productImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  productName: { minHeight: 36 },
  emptyCatalog: { textAlign: 'center', paddingVertical: Spacing.four },
  moreButton: {
    borderRadius: Radii.button,
    padding: Spacing.three,
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  cartCard: {
    borderRadius: Radii.card,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    marginBottom: Spacing.three,
  },
  paymentCard: {
    borderRadius: Radii.card,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  paymentCardTitle: { marginBottom: Spacing.two },
  cartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  cartHeaderDivider: { height: 1, marginHorizontal: -Spacing.three, marginBottom: Spacing.one },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    gap: Spacing.three,
  },
  cartDivider: { height: 1 },
  cartThumb: { width: 64, height: 64, borderRadius: Spacing.three },
  cartInfo: { flex: 1, gap: Spacing.two },
  cartRight: { alignItems: 'flex-end', gap: Spacing.two },
  quantityStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.two,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDisabled: { opacity: 0.3 },
  stepperValue: { minWidth: 20, textAlign: 'center' },
  removeButton: { padding: Spacing.one },
  error: { color: '#d9534f' },
  checkoutCard: {
    borderRadius: Radii.card,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  checkoutBottom: { gap: Spacing.three },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  discountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderRadius: Radii.buttonPrimary,
    paddingVertical: Spacing.three,
  },
  discountInput: { fontSize: 14, textAlign: 'right', minWidth: 80 },
  checkoutButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    borderRadius: Radii.buttonPrimary,
  },
  checkoutButtonDisabled: { opacity: 0.5 },
  checkoutLabel: { color: '#FFFFFF' },
});
