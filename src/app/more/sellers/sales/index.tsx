import { Stack } from 'expo-router';
import { useCallback, useState } from 'react';

import { SaleList, type SaleListRow, type SaleListSummary } from '@/components/sale-list';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useMySeller } from '@/hooks/use-my-seller';
import { sellersRepo, sellerSalesRepo } from '@/lib/data';
import { formatDateTime } from '@/lib/format';

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

// Consignment sales. The owner sees every seller's; a consignment seller
// opens this as "Mis ventas" and only gets their own (their pull only brings
// theirs anyway — the filter just makes that explicit).
export default function SellerSalesScreen() {
  const [rows, setRows] = useState<SaleListRow[]>([]);
  const [summary, setSummary] = useState<SaleListSummary | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const { isSeller, seller } = useMySeller();
  const onlySellerId = isSeller ? (seller?.id ?? -1) : null;

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([sellerSalesRepo.list(), sellersRepo.list()]).then(([sales, sellers]) => {
        if (cancelled) return;
        const sellerNames = Object.fromEntries(sellers.map((s) => [s.id, s.name]));
        const visible = onlySellerId === null ? sales : sales.filter((s) => s.sellerId === onlySellerId);

        setRows(
          visible.map((sale) => {
            const units = plural(
              sale.items.reduce((sum, i) => sum + i.quantity, 0),
              'unidad',
              'unidades',
            );
            return {
              key: String(sale.id),
              title: onlySellerId === null ? (sellerNames[sale.sellerId] ?? `Vendedor #${sale.sellerId}`) : units,
              subtitle: onlySellerId === null ? `${units} · ${formatDateTime(sale.saleDate)}` : formatDateTime(sale.saleDate),
              amount: sale.totalAmount,
              commission: sale.commissionAmount,
            };
          }),
        );
        setSummary(
          onlySellerId === null
            ? undefined
            : {
                total: visible.reduce((sum, s) => sum + s.totalAmount, 0),
                count: visible.length,
                commission: visible.reduce((sum, s) => sum + s.commissionAmount, 0),
              },
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
      {isSeller ? <Stack.Screen options={{ title: 'Mis ventas' }} /> : null}
      <SaleList
        rows={rows}
        loading={loading}
        summary={summary}
        emptyText={isSeller ? 'Todavía no has registrado ventas.' : 'Sin ventas de vendedores todavía.'}
      />
    </>
  );
}
