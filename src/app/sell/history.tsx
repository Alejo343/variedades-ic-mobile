import { Stack } from 'expo-router';
import { useCallback, useState } from 'react';

import { SaleList, type SaleListRow, type SaleListSummary } from '@/components/sale-list';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useMySeller } from '@/hooks/use-my-seller';
import { cashAccountsRepo, directSalesRepo, sellersRepo } from '@/lib/data';
import { formatDateTime } from '@/lib/format';

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export default function SalesHistoryScreen() {
  const [rows, setRows] = useState<SaleListRow[]>([]);
  const [summary, setSummary] = useState<SaleListSummary | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  // A store seller only ever sees their own sales ("Mis ventas").
  const { isSeller, seller } = useMySeller();
  const onlySellerId = isSeller ? (seller?.id ?? -1) : null;

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([directSalesRepo.list(), cashAccountsRepo.list(), sellersRepo.list()]).then(([sales, accounts, sellers]) => {
        if (cancelled) return;
        const accountNames = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
        const sellerNames = Object.fromEntries(sellers.map((s) => [s.id, s.name]));
        const visible = onlySellerId === null ? sales : sales.filter((s) => s.sellerId === onlySellerId);

        setRows(
          visible.map((sale) => {
            const products = plural(sale.items.length, 'producto', 'productos');
            const parts = [formatDateTime(sale.saleDate), accountNames[sale.accountId] ?? `Cuenta #${sale.accountId}`];
            if (onlySellerId === null && sale.sellerId !== null) parts.push(`vendió ${sellerNames[sale.sellerId] ?? 'un vendedor'}`);
            return {
              key: String(sale.id),
              title: onlySellerId === null ? `Venta #${sale.id} · ${products}` : products,
              subtitle: parts.join(' · '),
              amount: sale.totalAmount,
              commission: sale.sellerId !== null ? sale.commissionAmount : undefined,
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
      <SaleList rows={rows} loading={loading} summary={summary} emptyText="Sin ventas todavía." />
    </>
  );
}
