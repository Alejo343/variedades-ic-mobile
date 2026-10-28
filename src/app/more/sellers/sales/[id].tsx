import { useLocalSearchParams } from 'expo-router';

import { SaleDetail } from '@/components/sale-detail';

export default function SellerSaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SaleDetail kind="seller" saleId={Number(id)} />;
}
