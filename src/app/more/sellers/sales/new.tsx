import { router, Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { SellerSaleForm } from '@/components/seller-sale-form';
import { sellerSalesRepo } from '@/lib/data';
import { confirmLeaveCorrection } from '@/lib/sale-correction';

type Line = { productId: number; quantity: number; unitPrice: number };

export default function NewSellerSaleScreen() {
  const { sellerId, corregir } = useLocalSearchParams<{ sellerId: string; corregir?: string }>();
  const navigation = useNavigation();
  // Corregir (components/sale-detail.tsx): the voided sale's lines preload the
  // form; it waits for them so the cart is filled on first load.
  const [initialLines, setInitialLines] = useState<Line[] | undefined | null>(corregir ? null : undefined);
  // While a correction isn't saved, leaving (back button, gesture, header)
  // asks first: the sale is already voided. A ref, not state, so saving can
  // let the screen go in the same tick as router.back().
  const unsavedCorrection = useRef(Boolean(corregir));

  useEffect(() => {
    if (!corregir) return;
    let cancelled = false;
    sellerSalesRepo.listForSeller(Number(sellerId)).then((sales) => {
      if (cancelled) return;
      const sale = sales.find((s) => s.id === Number(corregir));
      setInitialLines(sale?.voidedAt ? sale.items.map(({ productId, quantity, unitPrice }) => ({ productId, quantity, unitPrice })) : undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [corregir, sellerId]);

  useEffect(() => {
    if (!corregir) return;
    return navigation.addListener('beforeRemove', (e) => {
      if (!unsavedCorrection.current) return;
      e.preventDefault();
      confirmLeaveCorrection(Number(corregir), () => {
        unsavedCorrection.current = false;
        navigation.dispatch(e.data.action);
      });
    });
  }, [navigation, corregir]);

  if (initialLines === null) return null;
  return (
    <>
      {corregir ? <Stack.Screen options={{ title: `Corregir venta #${corregir}` }} /> : null}
      <SellerSaleForm
        sellerId={Number(sellerId)}
        initialLines={initialLines}
        onSaved={() => {
          unsavedCorrection.current = false;
          router.back();
        }}
      />
    </>
  );
}
