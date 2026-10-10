import { Image } from 'expo-image';
import { Minus, Package, Plus, Search, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatCOP } from '@/lib/format';
import { resolveImageUri } from '@/lib/sync/image-url';

// Building blocks shared by the two sale screens: the owner/store-seller POS
// (sell/index.tsx) and the consignment seller's sale form
// (components/seller-sale-form.tsx).

export function PosSearchBar({ value, onChangeText }: { value: string; onChangeText: (v: string) => void }) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={[styles.searchBar, Shadow.subtle]}>
      <Search color={theme.textSecondary} size={18} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Buscar productos"
        placeholderTextColor={theme.textSecondary}
        style={[styles.searchInput, { color: theme.text }]}
      />
    </ThemedView>
  );
}

export const GRID_COLUMNS = 3;

// Card width for a GRID_COLUMNS grid whose own measured width is
// `containerWidth` (see ProductGrid for why it's measured, not derived).
export function gridCardWidth(containerWidth: number): number {
  return Math.floor((containerWidth - Layout.cardGap * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
}

// Lays cards out in exactly GRID_COLUMNS columns. The card width comes from
// the grid's own measured width, not the window's: deriving it from the
// window meant assuming the screen's horizontal padding, and when that
// assumption was off (24 vs 20) or fractional widths rounded up, the third
// card no longer fit and wrapped to the next row. Flooring keeps the sum of
// widths + gaps at or under the real width.
export function ProductGrid({ children }: { children: (cardWidth: number) => ReactNode }) {
  const [width, setWidth] = useState(0);
  const cardWidth = gridCardWidth(width);
  return (
    <View style={styles.grid} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? children(cardWidth) : null}
    </View>
  );
}

type ProductCardProps = {
  name: string;
  price: number;
  imageUri: string | null;
  // Third line under the price, e.g. "Stock: 4" or "Tienes 4".
  caption: string;
  // Tints the caption: 'warning' for low stock, 'error' for sold out.
  captionTone?: 'normal' | 'warning' | 'error';
  selected: boolean;
  // Units of this product in the cart, shown as a badge while selected.
  quantity?: number;
  // Dimmed and not tappable (e.g. sold out).
  disabled?: boolean;
  cardWidth: number;
  onPress: () => void;
};

// Quick scale bounce on tap gives immediate tactile feedback before the
// slower `backgroundSelected` color swap lands.
export function ProductCard({
  name,
  price,
  imageUri,
  caption,
  captionTone = 'normal',
  selected,
  quantity,
  disabled = false,
  cardWidth,
  onPress,
}: ProductCardProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const [pressCount, setPressCount] = useState(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

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
    <Pressable onPress={handlePress} disabled={disabled} style={{ width: cardWidth }}>
      <Animated.View style={[animatedStyle, disabled && styles.cardDisabled]}>
        <ThemedView
          type={selected ? 'backgroundSelected' : 'backgroundElement'}
          style={[styles.productCard, Shadow.subtle, { borderColor: selected ? theme.primary : 'transparent' }]}>
          <ProductThumb uri={imageUri} style={styles.productImage} iconSize={22} />
          {selected && quantity ? (
            <View style={[styles.qtyBadge, { backgroundColor: theme.primary, borderColor: theme.backgroundElement }]}>
              <ThemedText type="caption" style={styles.qtyBadgeLabel}>
                {quantity}
              </ThemedText>
            </View>
          ) : null}
          <ThemedText type="small" numberOfLines={2} style={styles.productName}>
            {name}
          </ThemedText>
          <ThemedText type="smallBold">{formatCOP(price)}</ThemedText>
          <ThemedText
            type="caption"
            themeColor={captionTone === 'normal' ? 'textSecondary' : undefined}
            style={captionTone === 'warning' ? { color: theme.warning } : captionTone === 'error' ? { color: theme.error } : undefined}>
            {caption}
          </ThemedText>
        </ThemedView>
      </Animated.View>
    </Pressable>
  );
}

export function ProductThumb({ uri, style, iconSize }: { uri: string | null; style: object; iconSize: number }) {
  const theme = useTheme();
  if (uri) return <Image source={{ uri: resolveImageUri(uri) }} style={style} />;
  return (
    <View style={[style, styles.placeholder, { backgroundColor: theme.primaryLight }]}>
      <Package color={theme.primary} size={iconSize} />
    </View>
  );
}

type CartRowProps = {
  name: string;
  imageUri: string | null;
  quantity: number;
  // Upper bound for the + button (stock in the shop, or what the seller holds).
  max: number;
  // Omitted where the line moves no money (a return).
  lineTotal?: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
  // When set, the unit price is editable under the stepper.
  unitPrice?: { value: string; onChange: (v: string) => void; label?: string };
};

// Quantity punches on change so +/- taps register visually, not just numerically.
export function CartRow({ name, imageUri, quantity, max, lineTotal, onIncrement, onDecrement, onRemove, unitPrice }: CartRowProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    // eslint-disable-next-line react-hooks/immutability -- see ProductCard note above
    scale.value = withSequence(withTiming(1.25, { duration: 90 }), withTiming(1, { duration: 120 }));
  }, [quantity, scale]);

  const atMin = quantity <= 1;
  const atMax = quantity >= max;

  return (
    <View style={styles.cartRow}>
      <ProductThumb uri={imageUri} style={styles.cartThumb} iconSize={26} />

      <View style={styles.cartInfo}>
        <ThemedText type="default" numberOfLines={2}>
          {name}
        </ThemedText>

        <View style={styles.quantityStepper}>
          <Pressable
            onPress={onDecrement}
            disabled={atMin}
            hitSlop={6}
            style={[styles.stepperButton, { borderColor: theme.primary }, atMin && styles.stepperButtonDisabled]}>
            <Minus color={theme.primary} size={16} />
          </Pressable>
          <Animated.View style={animatedStyle}>
            <ThemedText type="smallBold" style={[styles.stepperValue, { color: theme.primary }]}>
              {quantity}
            </ThemedText>
          </Animated.View>
          <Pressable
            onPress={onIncrement}
            disabled={atMax}
            hitSlop={6}
            style={[styles.stepperButton, { borderColor: theme.primary }, atMax && styles.stepperButtonDisabled]}>
            <Plus color={theme.primary} size={16} />
          </Pressable>
        </View>
        {atMax ? (
          <ThemedText type="caption" themeColor="textSecondary">
            Máximo disponible
          </ThemedText>
        ) : null}
        {unitPrice ? (
          <View style={[styles.unitPriceRow, { borderColor: theme.border }]}>
            <ThemedText type="caption" themeColor="textSecondary">
              {unitPrice.label ?? 'Precio c/u $'}
            </ThemedText>
            <TextInput
              value={unitPrice.value}
              onChangeText={unitPrice.onChange}
              keyboardType="numeric"
              style={[styles.unitPriceInput, { color: theme.text }]}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.cartRight}>
        {lineTotal !== undefined ? <ThemedText type="cardTitle">{formatCOP(lineTotal)}</ThemedText> : null}
        <Pressable onPress={onRemove} hitSlop={8} style={styles.removeButton}>
          <Trash2 color={theme.error} size={22} />
        </Pressable>
      </View>
    </View>
  );
}

// Small "punch" every time the total actually changes, so the number reads
// as freshly updated rather than a silent re-render.
export function AnimatedTotal({ value, color }: { value: number; color: string }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSequence(withTiming(1.08, { duration: 100 }), withTiming(1, { duration: 140 }));
  }, [value, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <ThemedText type="sectionTitle" style={{ color }}>
        {formatCOP(value)}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Layout.cardGap },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radii.button,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.three,
  },
  searchInput: { flex: 1, paddingVertical: Spacing.three, fontSize: 16 },
  productCard: {
    borderRadius: Radii.card,
    borderWidth: 1.5,
    padding: Spacing.two,
    gap: Spacing.half,
  },
  cardDisabled: { opacity: 0.45 },
  qtyBadge: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBadgeLabel: { color: '#FFFFFF' },
  productImage: { width: '100%', height: 80, borderRadius: Spacing.two },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  productName: { minHeight: 36 },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    gap: Spacing.three,
  },
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
  unitPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  unitPriceInput: { minWidth: 72, paddingVertical: Spacing.one, fontSize: 14 },
  removeButton: { padding: Spacing.one },
});
