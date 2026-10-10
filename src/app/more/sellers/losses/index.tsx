import { Stack, useLocalSearchParams } from 'expo-router';
import { PackageMinus } from 'lucide-react-native';
import { useCallback, useState } from 'react';

import { FilterNote, RecordList, type RecordRow } from '@/components/record-list';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useTheme } from '@/hooks/use-theme';
import { sellerLossesRepo, sellersRepo, type SellerLoss } from '@/lib/data';
import { formatCOP, formatDateTime } from '@/lib/format';

const TYPE_LABELS: Record<SellerLoss['type'], string> = {
  perdida: 'Pérdida',
  dano: 'Daño',
  robo: 'Robo',
};

// Every loss, or one seller's (`?sellerId=`, from their profile). The amount
// is the cost the seller takes on (added to their next settlement).
export default function SellerLossesScreen() {
  const theme = useTheme();
  const { sellerId } = useLocalSearchParams<{ sellerId?: string }>();
  const onlySellerId = sellerId ? Number(sellerId) : null;
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [sellerName, setSellerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([sellerLossesRepo.list(), sellersRepo.list()]).then(([losses, sellers]) => {
        if (cancelled) return;
        const names = Object.fromEntries(sellers.map((s) => [s.id, s.name]));
        setSellerName(onlySellerId !== null ? (names[onlySellerId] ?? null) : null);
        setRows(
          losses
            .filter((l) => onlySellerId === null || l.sellerId === onlySellerId)
            .map((l) => {
              const units = l.items.reduce((sum, i) => sum + i.quantity, 0);
              const label = `${TYPE_LABELS[l.type]} · ${units} ${units === 1 ? 'unidad' : 'unidades'}`;
              return {
                key: String(l.id),
                title: onlySellerId === null ? (names[l.sellerId] ?? `Vendedor #${l.sellerId}`) : label,
                subtitle: onlySellerId === null ? `${label} · ${formatDateTime(l.lossDate)}` : formatDateTime(l.lossDate),
                value: formatCOP(l.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0)),
                valueCaption: 'lo asume',
              };
            }),
        );
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [onlySellerId]),
  );

  return (
    <>
      {sellerName ? <Stack.Screen options={{ title: `Pérdidas · ${sellerName}` }} /> : null}
      <RecordList
        rows={rows}
        loading={loading}
        icon={PackageMinus}
        tint={theme.error}
        emptyText="Sin pérdidas registradas. Se registran desde la ficha de cada vendedor."
        header={sellerName ? <FilterNote text={`Solo las pérdidas de ${sellerName}.`} /> : undefined}
      />
    </>
  );
}
