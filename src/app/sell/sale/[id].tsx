import { useLocalSearchParams } from 'expo-router';

import { SaleDetail } from '@/components/sale-detail';

export default function DirectSaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SaleDetail kind="direct" saleId={Number(id)} />;
}
