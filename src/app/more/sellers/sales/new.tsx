import { router, useLocalSearchParams } from 'expo-router';

import { SellerSaleForm } from '@/components/seller-sale-form';

export default function NewSellerSaleScreen() {
  const { sellerId } = useLocalSearchParams<{ sellerId: string }>();
  return <SellerSaleForm sellerId={Number(sellerId)} onSaved={() => router.back()} />;
}
