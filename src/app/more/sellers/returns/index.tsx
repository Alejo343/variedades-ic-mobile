import { Stack, useLocalSearchParams } from 'expo-router';
import { Undo2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';

import { FilterNote, RecordList, type RecordRow } from '@/components/record-list';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useTheme } from '@/hooks/use-theme';
import { productsRepo, sellerReturnsRepo, sellersRepo } from '@/lib/data';
import { formatDateTime } from '@/lib/format';

// Every return, or one seller's (`?sellerId=`, from their profile). Returns
// move no money, so the right column is the units.
export default function SellerReturnsScreen() {
  const theme = useTheme();
  const { sellerId } = useLocalSearchParams<{ sellerId?: string }>();
  const onlySellerId = sellerId ? Number(sellerId) : null;
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [sellerName, setSellerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([sellerReturnsRepo.list(), sellersRepo.list(), productsRepo.list()]).then(([returns, sellers, products]) => {
        if (cancelled) return;
        const names = Object.fromEntries(sellers.map((s) => [s.id, s.name]));
        const productNames = Object.fromEntries(products.map((p) => [p.id, p.name]));
        setSellerName(onlySellerId !== null ? (names[onlySellerId] ?? null) : null);
        setRows(
          returns
            .filter((r) => onlySellerId === null || r.sellerId === onlySellerId)
            .map((r) => {
              const units = r.items.reduce((sum, i) => sum + i.quantity, 0);
              const what = r.items.map((i) => productNames[i.productId] ?? `Producto #${i.productId}`).join(', ');
              return {
                key: String(r.id),
                title: onlySellerId === null ? (names[r.sellerId] ?? `Vendedor #${r.sellerId}`) : what,
                subtitle: onlySellerId === null ? `${what} · ${formatDateTime(r.returnDate)}` : formatDateTime(r.returnDate),
                value: String(units),
                valueCaption: units === 1 ? 'unidad' : 'unidades',
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
      {sellerName ? <Stack.Screen options={{ title: `Devoluciones · ${sellerName}` }} /> : null}
      <RecordList
        rows={rows}
        loading={loading}
        icon={Undo2}
        tint={theme.warning}
        emptyText="Sin devoluciones todavía. Se registran desde la ficha de cada vendedor."
        header={sellerName ? <FilterNote text={`Solo las devoluciones de ${sellerName}.`} /> : undefined}
      />
    </>
  );
}
