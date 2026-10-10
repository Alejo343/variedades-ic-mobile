import { router, useLocalSearchParams } from 'expo-router';
import { PackageMinus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FormChip } from '@/components/form';
import { StockCartForm, type StockOption } from '@/components/stock-cart-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { productsRepo, sellerLossesRepo, sellersRepo, type Seller } from '@/lib/data';
import { sellerLossSchema } from '@/lib/validations';

type LossType = 'perdida' | 'dano' | 'robo';

const TYPE_OPTIONS: { value: LossType; label: string }[] = [
  { value: 'perdida', label: 'Pérdida' },
  { value: 'dano', label: 'Daño' },
  { value: 'robo', label: 'Robo' },
];

// Merchandise the seller lost: −seller only (the shop's stock never changes)
// and the cost is added to what they owe at the next settlement.
export default function NewSellerLossScreen() {
  const { sellerId: sellerIdParam } = useLocalSearchParams<{ sellerId: string }>();
  const sellerId = Number(sellerIdParam);
  const theme = useTheme();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [type, setType] = useState<LossType>('perdida');
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
          price: byId[l.productId]?.purchasePrice ?? 0,
          defaultCost: byId[l.productId]?.purchasePrice ?? 0,
        })),
      );
    });
  }, [sellerId]);

  return (
    <StockCartForm
      header={
        <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
          <View style={styles.identity}>
            <View style={[styles.iconDot, { backgroundColor: withAlpha(theme.error, 0.12) }]}>
              <PackageMinus color={theme.error} size={20} />
            </View>
            <View style={styles.flex}>
              <ThemedText type="cardTitle">{seller?.name ?? 'Vendedor'}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                El costo lo asume el vendedor: se suma a lo que entrega en la próxima liquidación.
              </ThemedText>
            </View>
          </View>
          <View style={styles.chips}>
            {TYPE_OPTIONS.map((option) => (
              <FormChip key={option.value} label={option.label} selected={type === option.value} onPress={() => setType(option.value)} />
            ))}
          </View>
        </ThemedView>
      }
      options={options}
      availableLabel={(n) => `Tiene ${n}`}
      emptyTitle="No tiene mercancía"
      emptyText="Este vendedor no tiene nada que reportar como perdido."
      withCost
      totalLabel="Lo que asume el vendedor"
      submitLabel={`Registrar ${TYPE_OPTIONS.find((o) => o.value === type)?.label.toLowerCase()}`}
      tint={theme.error}
      onSubmit={async (lines, notes) => {
        const parsed = sellerLossSchema.safeParse({ sellerId, type, items: lines, notes: notes || undefined });
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Datos inválidos');
        await sellerLossesRepo.create(parsed.data);
        router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: Radii.card, padding: Spacing.three, gap: Spacing.three },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  iconDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', gap: Spacing.two },
});
