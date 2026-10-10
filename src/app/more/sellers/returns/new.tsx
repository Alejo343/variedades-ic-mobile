import { router, useLocalSearchParams } from 'expo-router';
import { Undo2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { StockCartForm, type StockOption } from '@/components/stock-cart-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { productsRepo, sellerReturnsRepo, sellersRepo, type Seller } from '@/lib/data';
import { sellerReturnSchema } from '@/lib/validations';

// A seller hands merchandise back: −seller, +principal in the ledger. Only
// what they hold can be returned; no money moves.
export default function NewSellerReturnScreen() {
  const { sellerId: sellerIdParam } = useLocalSearchParams<{ sellerId: string }>();
  const sellerId = Number(sellerIdParam);
  const theme = useTheme();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [options, setOptions] = useState<StockOption[] | null>(null);

  useEffect(() => {
    sellersRepo.getById(sellerId).then(setSeller);
    Promise.all([sellersRepo.getInventory(sellerId), productsRepo.list()]).then(([lines, products]) => {
      const byId = Object.fromEntries(products.map((p) => [p.id, p]));
      setOptions(
        lines.map((l) => ({
          productId: l.productId,
          name: byId[l.productId]?.name ?? `Producto #${l.productId}`,
          sku: byId[l.productId]?.sku ?? '',
          imageUri: byId[l.productId]?.primaryImageUri ?? null,
          available: l.quantity,
          price: byId[l.productId]?.price ?? 0,
          defaultCost: 0,
        })),
      );
    });
  }, [sellerId]);

  return (
    <StockCartForm
      header={
        <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
          <View style={[styles.iconDot, { backgroundColor: withAlpha(theme.warning, 0.12) }]}>
            <Undo2 color={theme.warning} size={20} />
          </View>
          <View style={styles.flex}>
            <ThemedText type="cardTitle">{seller?.name ?? 'Vendedor'}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              Lo que devuelva vuelve al inventario de la tienda.
            </ThemedText>
          </View>
        </ThemedView>
      }
      options={options}
      availableLabel={(n) => `Tiene ${n}`}
      emptyTitle="No tiene mercancía"
      emptyText="Este vendedor no tiene nada que devolver."
      submitLabel="Registrar devolución"
      tint={theme.warning}
      onSubmit={async (lines, notes) => {
        const parsed = sellerReturnSchema.safeParse({
          sellerId,
          items: lines.map(({ productId, quantity }) => ({ productId, quantity })),
          notes: notes || undefined,
        });
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Datos inválidos');
        await sellerReturnsRepo.create(parsed.data);
        router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderRadius: Radii.card, padding: Spacing.three },
  iconDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
