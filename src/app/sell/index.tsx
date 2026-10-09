import { ChevronRight, PackageSearch, Plus, ShoppingCart, Tag, Trash2, X } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutDown, FadeOutLeft, LinearTransition } from 'react-native-reanimated';

import { AnimatedTotal, CartRow, GRID_COLUMNS, gridCardWidth, PosSearchBar, ProductCard } from '@/components/pos';
import { SellerSaleForm } from '@/components/seller-sale-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing } from '@/constants/theme';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useMySeller } from '@/hooks/use-my-seller';
import { useTheme } from '@/hooks/use-theme';
import { cashAccountsRepo, categoriesRepo, directSalesRepo, productsRepo, type CashAccount, type Category, type Product } from '@/lib/data';
import { formatCOP } from '@/lib/format';
import { triggerSaleSuccessOverlay } from '@/lib/success-overlay';
import { directSaleSchema } from '@/lib/validations';

type CartItem = {
  productId: number;
  name: string;
  sku: string;
  imageUri: string | null;
  stock: number;
  quantity: string;
  unitPrice: string;
};

// There's no discount column on direct_sale_items — instead of adding one, the
// discount is folded into each line's unitPrice (proportional to its share of
// the subtotal) so the sale recorded in cash_movements matches what was
// actually charged. Rounding remainder goes to the line with the biggest
// subtotal, to keep every unitPrice >= 0.
function applyDiscount(cart: CartItem[], subtotal: number, grandTotal: number) {
  const items = cart.map((item) => ({
    productId: item.productId,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
  }));
  if (subtotal === 0 || grandTotal === subtotal) return items;

  const ratio = grandTotal / subtotal;
  const adjusted = items.map((item) => ({
    ...item,
    unitPrice: Math.max(0, Math.round(item.unitPrice * ratio)),
  }));

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

function stockCaption(product: Product): { caption: string; tone: 'normal' | 'warning' | 'error' } {
  if (product.stock <= 0) return { caption: 'Agotado', tone: 'error' };
  if (product.minStock > 0 && product.stock <= product.minStock) return { caption: `Quedan ${product.stock}`, tone: 'warning' };
  return { caption: `Stock: ${product.stock}`, tone: 'normal' };
}

// The owner and a 'store' seller use the direct-sale POS below (principal
// inventory, money into a cash account — a store seller's sale is tagged with
// them); a consignment seller's Vender tab is a sale against their own
// inventory (same form the owner uses from the seller detail). Split in
// components so the POS's many hooks never run conditionally.
export default function SellScreen() {
  const { isSeller } = useMySeller();
  return isSeller ? <SellerSellScreen /> : <DirectSaleScreen />;
}

function SellerSellScreen() {
  const { seller, loading } = useMySeller();
  // Bumping the key remounts the form: empties the cart and reloads the
  // inventory after each saved sale, without leaving the tab.
  const [formKey, setFormKey] = useState(0);

  if (!seller) {
    return (
      <ThemedView style={styles.waiting}>
        <ThemedView type="backgroundElement" style={[styles.waitingCard, Shadow.subtle]}>
          <ThemedText type="cardTitle">{loading ? 'Cargando…' : 'Preparando tus datos'}</ThemedText>
          <ThemedText type="secondary" themeColor="textSecondary">
            Tus productos aparecen aquí después de la primera sincronización. Si no llegan, ve a Más → Configuración → Sincronizar
            ahora.
          </ThemedText>
        </ThemedView>
      </ThemedView>
    );
  }
  if (seller.inventoryMode === 'store') return <DirectSaleScreen sellerId={seller.id} />;
  return <SellerSaleForm key={formKey} sellerId={seller.id} onSaved={() => setFormKey((k) => k + 1)} />;
}

// Shop POS. The catalog owns the screen; the cart lives in a sticky bar at
// the bottom and the checkout (cart, payment method, discount, notes) in a
// sheet opened from it — so the total is always in view and charging never
// needs scrolling past the whole catalog.
function DirectSaleScreen({ sellerId }: { sellerId?: number }) {
  const theme = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [gridWidth, setGridWidth] = useState(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [showDiscount, setShowDiscount] = useState(false);
  const [discount, setDiscount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The success circle (rendered globally, see SaleSuccessOverlay) grows from
  // the cart bar. It's measured when the sheet opens: by the time the sale is
  // saved the bar is gone (empty cart) and the sheet is closing, so neither
  // can be measured then.
  const cartBarRef = useRef<View>(null);
  const successOrigin = useRef<{ x: number; y: number } | null>(null);

  // Also called right after a sale: the screen stays mounted, so without it
  // the cards keep showing the stock from before the sale until the next focus.
  const loadProducts = useCallback(async () => {
    const rows = await productsRepo.list();
    setProducts(rows.filter((p) => p.active));
  }, []);

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      productsRepo.list().then((rows) => {
        if (cancelled) return;
        setProducts(rows.filter((p) => p.active));
        setLoaded(true);
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

  const cardWidth = gridCardWidth(gridWidth - Layout.screenPadding * 2);
  const quantityById = useMemo(() => new Map(cart.map((item) => [item.productId, Number(item.quantity) || 0])), [cart]);

  const units = useMemo(() => cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0), [cart]);
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
      if (prev.some((item) => item.productId === product.id)) {
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
    const next = cart.filter((item) => item.productId !== productId);
    setCart(next);
    if (next.length === 0) setCheckoutOpen(false);
  }

  function clearCart() {
    setCart([]);
    setCheckoutOpen(false);
  }

  function openCheckout() {
    setError(null);
    cartBarRef.current?.measureInWindow((x, y, w, h) => {
      successOrigin.current = { x: x + w / 2, y: y + h / 2 };
    });
    setCheckoutOpen(true);
  }

  async function handleSubmit() {
    const parsed = directSaleSchema.safeParse({
      items: applyDiscount(cart, subtotal, grandTotal),
      accountId,
      sellerId,
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
      await loadProducts();
      setCheckoutOpen(false);
      setCart([]);
      setNotes('');
      setSearch('');
      setCategoryId(null);
      setShowDiscount(false);
      setDiscount('');
      // Let the sheet slide away first: the overlay lives in the main window
      // and would otherwise grow underneath the modal.
      const origin = successOrigin.current;
      if (origin) setTimeout(() => triggerSaleSuccessOverlay(origin), 250);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar la venta');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={[]}>
        <View style={styles.header}>
          <PosSearchBar value={search} onChangeText={setSearch} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            <CategoryChip label="Todos" selected={categoryId === null} onPress={() => setCategoryId(null)} />
            {categories.map((category) => (
              <CategoryChip
                key={category.id}
                label={category.name}
                selected={categoryId === category.id}
                onPress={() => setCategoryId(category.id)}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.flex} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
          {gridWidth > 0 ? (
            <FlatList
              data={catalog}
              keyExtractor={(item) => String(item.id)}
              numColumns={GRID_COLUMNS}
              columnWrapperStyle={styles.gridRow}
              // renderItem reads the cart; without this the cards wouldn't
              // re-render when it changes (FlatList only diffs `data`).
              extraData={quantityById}
              ItemSeparatorComponent={RowSeparator}
              contentContainerStyle={[styles.gridContent, cart.length > 0 && styles.gridContentWithBar]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                loaded ? (
                  <View style={styles.empty}>
                    <View style={[styles.emptyIcon, { backgroundColor: theme.primaryLight }]}>
                      <PackageSearch color={theme.primary} size={28} />
                    </View>
                    <ThemedText type="secondary" themeColor="textSecondary" style={styles.center}>
                      {products.length === 0 ? 'Todavía no hay productos en el catálogo.' : 'Ningún producto coincide con la búsqueda.'}
                    </ThemedText>
                  </View>
                ) : null
              }
              renderItem={({ item }) => {
                const { caption, tone } = stockCaption(item);
                const inCart = quantityById.has(item.id);
                return (
                  <ProductCard
                    name={item.name}
                    price={item.price}
                    imageUri={item.primaryImageUri}
                    caption={caption}
                    captionTone={tone}
                    cardWidth={cardWidth}
                    selected={inCart}
                    quantity={quantityById.get(item.id)}
                    // Selling more than the shop has fails anyway (stock check
                    // in direct-sales-repo), so a sold-out card can't be picked.
                    disabled={item.stock <= 0 && !inCart}
                    onPress={() => toggleProduct(item)}
                  />
                );
              }}
            />
          ) : null}
        </View>

        {cart.length > 0 ? (
          <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOutDown.duration(160)} style={styles.cartBarWrap}>
            <Pressable onPress={openCheckout}>
              <View ref={cartBarRef} style={[styles.cartBar, Shadow.subtle, { backgroundColor: theme.primary }]}>
                <View style={styles.cartBarIcon}>
                  <ShoppingCart color="#FFFFFF" size={20} />
                  <View style={[styles.cartBarCount, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="caption" style={{ color: theme.primary }}>
                      {units}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.flex}>
                  <ThemedText type="caption" style={styles.onPrimaryMuted}>
                    {cart.length} {cart.length === 1 ? 'producto' : 'productos'}
                  </ThemedText>
                  <ThemedText type="cardTitle" style={styles.onPrimary}>
                    {formatCOP(grandTotal)}
                  </ThemedText>
                </View>
                <ThemedText type="cardTitle" style={styles.onPrimary}>
                  Cobrar
                </ThemedText>
                <ChevronRight color="#FFFFFF" size={22} />
              </View>
            </Pressable>
          </Animated.View>
        ) : null}
      </SafeAreaView>

      <CheckoutSheet
        visible={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        cart={cart}
        units={units}
        accounts={accounts}
        accountId={accountId}
        onSelectAccount={setAccountId}
        notes={notes}
        onChangeNotes={setNotes}
        showDiscount={showDiscount}
        onToggleDiscount={toggleDiscount}
        discount={discount}
        onChangeDiscount={setDiscount}
        subtotal={subtotal}
        grandTotal={grandTotal}
        error={error}
        saving={saving}
        onIncrement={(id) => changeQuantity(id, 1)}
        onDecrement={(id) => changeQuantity(id, -1)}
        onRemove={removeItem}
        onClear={clearCart}
        onSubmit={handleSubmit}
      />
    </ThemedView>
  );
}

function RowSeparator() {
  return <View style={styles.rowSeparator} />;
}

function CategoryChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress}>
      <View
        style={[
          styles.chip,
          selected
            ? { backgroundColor: theme.primary, borderColor: theme.primary }
            : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}>
        <ThemedText type="small" style={{ color: selected ? '#FFFFFF' : theme.text }}>
          {label}
        </ThemedText>
      </View>
    </Pressable>
  );
}

type CheckoutSheetProps = {
  visible: boolean;
  onClose: () => void;
  cart: CartItem[];
  units: number;
  accounts: CashAccount[];
  accountId: number | null;
  onSelectAccount: (id: number) => void;
  notes: string;
  onChangeNotes: (v: string) => void;
  showDiscount: boolean;
  onToggleDiscount: () => void;
  discount: string;
  onChangeDiscount: (v: string) => void;
  subtotal: number;
  grandTotal: number;
  error: string | null;
  saving: boolean;
  onIncrement: (productId: number) => void;
  onDecrement: (productId: number) => void;
  onRemove: (productId: number) => void;
  onClear: () => void;
  onSubmit: () => void;
};

function CheckoutSheet(props: CheckoutSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { cart, accounts, accountId, saving } = props;
  const canCharge = cart.length > 0 && accountId !== null && !saving;

  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
      onRequestClose={props.onClose}>
      <ThemedView style={styles.flex}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
            <View style={styles.flex}>
              <ThemedText type="sectionTitle">Cobrar venta</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {cart.length} {cart.length === 1 ? 'producto' : 'productos'} · {props.units} {props.units === 1 ? 'unidad' : 'unidades'}
              </ThemedText>
            </View>
            <Pressable onPress={props.onClose} hitSlop={10} style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
              <X color={theme.text} size={20} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            <ThemedView type="backgroundElement" style={[styles.card, styles.cartCard, Shadow.subtle]}>
              <View style={styles.cardHeader}>
                <ThemedText type="smallBold">Carrito</ThemedText>
                <Pressable onPress={props.onClear} hitSlop={6} style={styles.inlineButton}>
                  <Trash2 color={theme.error} size={16} />
                  <ThemedText type="small" style={{ color: theme.error }}>
                    Vaciar
                  </ThemedText>
                </Pressable>
              </View>
              {cart.map((item, index) => (
                <Animated.View
                  key={item.productId}
                  entering={FadeInDown.duration(200)}
                  exiting={FadeOutLeft.duration(180)}
                  layout={LinearTransition.delay(120)}>
                  {index > 0 ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
                  <CartRow
                    name={item.name}
                    imageUri={item.imageUri}
                    quantity={Number(item.quantity) || 0}
                    max={item.stock}
                    lineTotal={(Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)}
                    onIncrement={() => props.onIncrement(item.productId)}
                    onDecrement={() => props.onDecrement(item.productId)}
                    onRemove={() => props.onRemove(item.productId)}
                  />
                </Animated.View>
              ))}
              <Pressable onPress={props.onClose}>
                <View style={[styles.addMore, { borderTopColor: theme.border }]}>
                  <Plus color={theme.primary} size={16} />
                  <ThemedText type="small" style={{ color: theme.primary }}>
                    Agregar más productos
                  </ThemedText>
                </View>
              </Pressable>
            </ThemedView>

            <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
              <ThemedText type="smallBold">Método de pago</ThemedText>
              <View style={styles.accountRow}>
                {accounts.map((account) => {
                  const selected = accountId === account.id;
                  return (
                    <Pressable key={account.id} onPress={() => props.onSelectAccount(account.id)} style={styles.accountFlex}>
                      <View
                        style={[
                          styles.accountButton,
                          selected
                            ? { backgroundColor: theme.primaryLight, borderColor: theme.primary }
                            : { backgroundColor: theme.background, borderColor: theme.border },
                        ]}>
                        <ThemedText type={selected ? 'smallBold' : 'small'} style={{ color: selected ? theme.primary : theme.text }}>
                          {account.name}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              {accounts.length === 0 ? (
                <ThemedText type="caption" themeColor="textSecondary">
                  No hay cuentas activas. Crea una en Más → Caja → Gestionar cuentas.
                </ThemedText>
              ) : null}
            </ThemedView>

            <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
              <Pressable onPress={props.onToggleDiscount}>
                <View style={styles.cardHeader}>
                  <View style={styles.inlineButton}>
                    <Tag color={props.showDiscount ? theme.primary : theme.textSecondary} size={18} />
                    <ThemedText type="smallBold">Descuento</ThemedText>
                  </View>
                  <ThemedText type="small" style={{ color: theme.primary }}>
                    {props.showDiscount ? 'Quitar' : 'Agregar'}
                  </ThemedText>
                </View>
              </Pressable>
              {props.showDiscount ? (
                <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)}>
                  <View style={[styles.moneyInput, { borderColor: theme.border }]}>
                    <ThemedText type="default" themeColor="textSecondary">
                      $
                    </ThemedText>
                    <TextInput
                      value={props.discount}
                      onChangeText={props.onChangeDiscount}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={theme.textSecondary}
                      autoFocus
                      style={[styles.moneyInputField, { color: theme.text }]}
                    />
                  </View>
                </Animated.View>
              ) : null}

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <ThemedText type="smallBold">Notas (opcional)</ThemedText>
              <TextInput
                value={props.notes}
                onChangeText={props.onChangeNotes}
                placeholder="Ej. cliente frecuente, entrega a domicilio…"
                placeholderTextColor={theme.textSecondary}
                multiline
                style={[styles.notesInput, { color: theme.text, borderColor: theme.border }]}
              />
            </ThemedView>
          </ScrollView>

          <ThemedView
            type="backgroundElement"
            style={[styles.sheetFooter, { borderTopColor: theme.border, paddingBottom: Spacing.three + insets.bottom }]}>
            {props.subtotal !== props.grandTotal ? (
              <>
                <View style={styles.totalRow}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Subtotal
                  </ThemedText>
                  <ThemedText type="small">{formatCOP(props.subtotal)}</ThemedText>
                </View>
                <View style={styles.totalRow}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Descuento
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.error }}>
                    −{formatCOP(props.subtotal - props.grandTotal)}
                  </ThemedText>
                </View>
              </>
            ) : null}
            <View style={styles.totalRow}>
              <ThemedText type="cardTitle">Total</ThemedText>
              <AnimatedTotal value={props.grandTotal} color={theme.primary} />
            </View>

            {props.error ? <ThemedText style={{ color: theme.error }}>{props.error}</ThemedText> : null}

            <Pressable onPress={props.onSubmit} disabled={!canCharge}>
              <View style={[styles.chargeButton, { backgroundColor: theme.primary }, !canCharge && styles.disabled]}>
                <ThemedText type="sectionTitle" style={styles.onPrimary}>
                  {saving ? 'Cobrando…' : `Cobrar ${formatCOP(props.grandTotal)}`}
                </ThemedText>
              </View>
            </Pressable>
          </ThemedView>
        </KeyboardAvoidingView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  waiting: { flex: 1, padding: Layout.screenPadding },
  waitingCard: { borderRadius: Radii.card, padding: Spacing.four, gap: Spacing.one },

  header: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.three },
  categoryRow: { gap: Spacing.two, paddingBottom: Spacing.three },
  chip: { borderWidth: 1, borderRadius: Radii.chip, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },

  gridContent: { paddingHorizontal: Layout.screenPadding, paddingBottom: Spacing.four },
  rowSeparator: { height: Layout.cardGap },
  // Room for the cart bar so the last row isn't hidden behind it.
  gridContentWithBar: { paddingBottom: 104 },
  gridRow: { gap: Layout.cardGap },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.six },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },

  cartBarWrap: { position: 'absolute', left: Layout.screenPadding, right: Layout.screenPadding, bottom: Spacing.three },
  cartBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Radii.buttonPrimary,
  },
  cartBarIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  cartBarCount: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onPrimary: { color: '#FFFFFF' },
  onPrimaryMuted: { color: 'rgba(255,255,255,0.85)' },

  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sheetContent: { padding: Layout.screenPadding, gap: Spacing.three },
  card: { borderRadius: Radii.card, padding: Spacing.three, gap: Spacing.two },
  cartCard: { paddingBottom: 0, gap: 0 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: Spacing.one },
  inlineButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  divider: { height: 1 },
  addMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderTopWidth: 1,
    marginHorizontal: -Spacing.three,
    paddingVertical: Spacing.three,
  },
  accountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  accountFlex: { flexGrow: 1, flexBasis: '30%' },
  accountButton: { borderWidth: 1.5, borderRadius: Radii.button, paddingVertical: Spacing.three, alignItems: 'center' },
  moneyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  moneyInputField: { flex: 1, paddingVertical: Spacing.two, fontSize: 18 },
  notesInput: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    minHeight: 72,
    fontSize: 16,
    textAlignVertical: 'top',
  },

  sheetFooter: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.three, gap: Spacing.two, borderTopWidth: 1 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chargeButton: { alignItems: 'center', paddingVertical: Spacing.four, borderRadius: Radii.buttonPrimary, marginTop: Spacing.one },
  disabled: { opacity: 0.5 },
});
