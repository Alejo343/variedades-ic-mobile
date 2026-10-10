import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { FormChip, FormSection } from '@/components/form';
import { StockCartForm, type StockOption } from '@/components/stock-cart-form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { productsRepo, sellerDeliveriesRepo, sellersRepo, type Seller } from '@/lib/data';
import { sellerDeliverySchema } from '@/lib/validations';

// Hands principal stock to a consignment seller (−principal, +seller in the
// ledger). Opened from the seller's profile with them preselected
// (`?sellerId=`), or from the sellers list to pick one.
export default function NewSellerDeliveryScreen() {
  const theme = useTheme();
  const { sellerId: sellerIdParam } = useLocalSearchParams<{ sellerId?: string }>();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sellerId, setSellerId] = useState<number | null>(sellerIdParam ? Number(sellerIdParam) : null);
  const [options, setOptions] = useState<StockOption[] | null>(null);

  useEffect(() => {
    sellersRepo.list().then((rows) => setSellers(rows.filter((s) => s.active && s.inventoryMode !== 'store')));
    productsRepo.list().then((rows) =>
      setOptions(
        rows
          .filter((p) => p.active)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((p) => ({
            productId: p.id,
            name: p.name,
            sku: p.sku,
            imageUri: p.primaryImageUri,
            available: p.stock,
            price: p.price,
            defaultCost: p.purchasePrice,
          })),
      ),
    );
  }, []);

  const seller = sellers.find((s) => s.id === sellerId) ?? null;

  return (
    <StockCartForm
      header={
        <FormSection title="Para">
          {sellers.length === 0 ? (
            <ThemedText type="secondary" themeColor="textSecondary">
              No hay vendedores de consignación activos.
            </ThemedText>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {sellers.map((s) => (
                <FormChip key={s.id} label={s.name} selected={s.id === sellerId} onPress={() => setSellerId(s.id)} />
              ))}
            </ScrollView>
          )}
          {!seller && sellers.length > 0 ? (
            <ThemedText type="caption" themeColor="textSecondary">
              Elige a quién le entregas la mercancía.
            </ThemedText>
          ) : null}
        </FormSection>
      }
      options={options}
      availableLabel={(n) => `Stock: ${n}`}
      emptyTitle="No hay productos"
      emptyText="Crea productos y súmales stock antes de entregar."
      withCost
      totalLabel="Costo de la mercancía"
      submitLabel={seller ? `Entregar a ${seller.name}` : 'Registrar entrega'}
      ready={seller !== null}
      tint={theme.info}
      onSubmit={async (lines, notes) => {
        if (!seller) throw new Error('Elige un vendedor');
        const parsed = sellerDeliverySchema.safeParse({ sellerId: seller.id, items: lines, notes: notes || undefined });
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Datos inválidos');
        await sellerDeliveriesRepo.create(parsed.data);
        router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({
  chips: { gap: Spacing.two },
});
