import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { SellerSaleForm } from '@/components/seller-sale-form';
import { sellerSalesRepo } from '@/lib/data';

type Line = { productId: number; quantity: number; unitPrice: number };

export default function NewSellerSaleScreen() {
  const { sellerId, corregir } = useLocalSearchParams<{ sellerId: string; corregir?: string }>();
  // Corregir (components/sale-detail.tsx): the voided sale's lines preload the
  // form; it waits for them so the cart is filled on first load.
  const [initialLines, setInitialLines] = useState<Line[] | undefined | null>(corregir ? null : undefined);

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

  if (initialLines === null) return null;
  return (
    <>
      {corregir ? <Stack.Screen options={{ title: `Corregir venta #${corregir}` }} /> : null}
      <SellerSaleForm sellerId={Number(sellerId)} initialLines={initialLines} onSaved={() => router.back()} />
    </>
  );
}
