import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  cashAccountsRepo,
  cashRepo,
  distributorsRepo,
  inventoryRepo,
  productsRepo,
  purchasePaymentsRepo,
  reportsRepo,
  sellersRepo,
  sellerSalesRepo,
  sellerReturnsRepo,
  type CashAccountWithBalance,
  type InventorySummary,
  type ProfitReport,
  type PurchasesReport,
  type SalesReport,
} from '@/lib/data';
import { formatCOP } from '@/lib/format';

type NameMaps = {
  products: Record<number, string>;
  sellers: Record<number, string>;
  distributors: Record<number, string>;
  accounts: Record<number, string>;
};

type ReportsData = {
  inventory: InventorySummary;
  lowStockCount: number;
  outOfStockCount: number;
  purchases: PurchasesReport;
  sales: SalesReport;
  profit: ProfitReport;
  accountBalances: CashAccountWithBalance[];
  cashBalance: number;
  cashPeriod: { income: number; expense: number };
  cashPeriodByAccount: { accountId: number; income: number; expense: number }[];
  accountsPayable: { distributorId: number; pending: number }[];
  sellerInventory: { sellerId: number; productId: number; quantity: number }[];
  sellerSales: { sellerId: number; count: number; totalAmount: number; totalCommission: number }[];
  returnedProducts: { productId: number; totalQuantity: number }[];
  names: NameMaps;
};

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold" style={styles.cardTitle}>
        {title}
      </ThemedText>
      {children}
    </ThemedView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small">{value}</ThemedText>
    </ThemedView>
  );
}

export default function ReportsScreen() {
  const theme = useTheme();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);

  const validFrom = from === '' || isValidDate(from) ? from || undefined : undefined;
  const validTo = to === '' || isValidDate(to) ? to || undefined : undefined;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);

      Promise.all([
        reportsRepo.getInventorySummary(),
        inventoryRepo.getLowStock(),
        inventoryRepo.getOutOfStock(),
        reportsRepo.getPurchasesReport(validFrom, validTo),
        reportsRepo.getSalesReport(validFrom, validTo),
        reportsRepo.getProfitReport(validFrom, validTo),
        cashRepo.getBalance(),
        cashRepo.list(),
        cashAccountsRepo.listWithBalances(),
        purchasePaymentsRepo.getAccountsPayableSummary(),
        sellersRepo.getAllInventory(),
        sellerSalesRepo.getSummaryBySeller(),
        sellerReturnsRepo.getReturnedProductsSummary(),
        productsRepo.list(),
        sellersRepo.list(),
        distributorsRepo.list(),
      ]).then(
        ([
          inventory,
          lowStock,
          outOfStock,
          purchases,
          sales,
          profit,
          cashBalance,
          cashMovements,
          accountBalances,
          accountsPayable,
          sellerInventory,
          sellerSalesSummary,
          returnedProducts,
          products,
          sellers,
          distributors,
        ]) => {
          if (cancelled) return;

          const cashInRange = cashMovements.filter((m) => {
            const day = m.movementDate.slice(0, 10);
            if (validFrom && day < validFrom) return false;
            if (validTo && day > validTo) return false;
            return true;
          });
          const cashPeriod = {
            income: cashInRange.filter((m) => m.type === 'ingreso').reduce((s, m) => s + m.amount, 0),
            expense: cashInRange.filter((m) => m.type === 'gasto').reduce((s, m) => s + m.amount, 0),
          };
          const byAccount = new Map<number, { income: number; expense: number }>();
          for (const m of cashInRange) {
            const bucket = byAccount.get(m.accountId) ?? { income: 0, expense: 0 };
            if (m.type === 'ingreso') bucket.income += m.amount;
            else bucket.expense += m.amount;
            byAccount.set(m.accountId, bucket);
          }
          const cashPeriodByAccount = Array.from(byAccount.entries()).map(([accountId, totals]) => ({ accountId, ...totals }));

          setData({
            inventory,
            lowStockCount: lowStock.length,
            outOfStockCount: outOfStock.length,
            purchases,
            sales,
            profit,
            accountBalances,
            cashBalance,
            cashPeriod,
            cashPeriodByAccount,
            accountsPayable,
            sellerInventory,
            sellerSales: sellerSalesSummary,
            returnedProducts,
            names: {
              products: Object.fromEntries(products.map((p) => [p.id, p.name])),
              sellers: Object.fromEntries(sellers.map((s) => [s.id, s.name])),
              distributors: Object.fromEntries(distributors.map((d) => [d.id, d.name])),
              accounts: Object.fromEntries(accountBalances.map((a) => [a.id, a.name])),
            },
          });
          setLoading(false);
        },
      );

      return () => {
        cancelled = true;
      };
    }, [validFrom, validTo]),
  );

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  if (loading || !data) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText themeColor="textSecondary">Cargando…</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="small">Rango de fechas (opcional, afecta Compras/Ventas/Utilidad/Caja del período)</ThemedText>
          <ThemedView style={styles.dateRow}>
            <TextInput
              value={from}
              onChangeText={setFrom}
              placeholder="Desde: 2026-01-01"
              placeholderTextColor={theme.textSecondary}
              style={[inputStyle, styles.dateField]}
            />
            <TextInput
              value={to}
              onChangeText={setTo}
              placeholder="Hasta: 2026-12-31"
              placeholderTextColor={theme.textSecondary}
              style={[inputStyle, styles.dateField]}
            />
          </ThemedView>

          <Card title="Inventario actual">
            <Row label="Productos activos" value={String(data.inventory.activeProducts)} />
            <Row label="Unidades totales" value={String(data.inventory.totalUnits)} />
            <Row label="Valor a costo" value={formatCOP(data.inventory.totalValue)} />
          </Card>

          <Card title="Stock mínimo / Agotados">
            <Row label="Con stock bajo" value={String(data.lowStockCount)} />
            <Row label="Agotados" value={String(data.outOfStockCount)} />
          </Card>

          <Card title="Compras">
            <Row label="Pedidos" value={String(data.purchases.totalCount)} />
            <Row label="Total" value={formatCOP(data.purchases.totalAmount)} />
            {data.purchases.byDistributor.map((line) => (
              <Row
                key={String(line.distributorId)}
                label={line.distributorId ? (data.names.distributors[line.distributorId] ?? `Distribuidor #${line.distributorId}`) : 'Sin distribuidor'}
                value={`${line.count} · ${formatCOP(line.total)}`}
              />
            ))}
          </Card>

          <Card title="Ventas">
            <Row label="Total" value={`${data.sales.totalCount} · ${formatCOP(data.sales.totalAmount)}`} />
            <Row label="En local" value={`${data.sales.byChannel.local.count} · ${formatCOP(data.sales.byChannel.local.total)}`} />
            <Row label="Vendedores" value={`${data.sales.byChannel.seller.count} · ${formatCOP(data.sales.byChannel.seller.total)}`} />
            {data.sales.localByAccount.map((line) => (
              <Row
                key={line.accountId}
                label={`  · ${data.names.accounts[line.accountId] ?? `Cuenta #${line.accountId}`} (en local)`}
                value={`${line.count} · ${formatCOP(line.total)}`}
              />
            ))}
          </Card>

          <Card title="Utilidad (bruta)">
            <Row label="Ventas" value={formatCOP(data.profit.revenue)} />
            <Row label="Costo de venta" value={formatCOP(data.profit.cogs)} />
            <Row label="Utilidad" value={formatCOP(data.profit.profit)} />
          </Card>

          <Card title="Cuentas">
            {data.accountBalances.map((account) => (
              <Row key={account.id} label={account.name + (!account.active ? ' · inactiva' : '')} value={formatCOP(account.balance)} />
            ))}
          </Card>

          <Card title="Caja">
            <Row label="Saldo actual" value={formatCOP(data.cashBalance)} />
            <Row label="Ingresos del período" value={formatCOP(data.cashPeriod.income)} />
            <Row label="Gastos del período" value={formatCOP(data.cashPeriod.expense)} />
            {data.cashPeriodByAccount.map((line) => (
              <Row
                key={line.accountId}
                label={`  · ${data.names.accounts[line.accountId] ?? `Cuenta #${line.accountId}`}`}
                value={`+${formatCOP(line.income)} / -${formatCOP(line.expense)}`}
              />
            ))}
          </Card>

          <Card title="Cuentas por pagar">
            {data.accountsPayable.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Sin saldos pendientes.
              </ThemedText>
            ) : (
              <>
                <Row label="Total pendiente" value={formatCOP(data.accountsPayable.reduce((s, r) => s + r.pending, 0))} />
                {data.accountsPayable.map((line) => (
                  <Row
                    key={line.distributorId}
                    label={data.names.distributors[line.distributorId] ?? `Distribuidor #${line.distributorId}`}
                    value={formatCOP(line.pending)}
                  />
                ))}
              </>
            )}
          </Card>

          <Card title="Inventario por vendedor">
            {data.sellerInventory.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Ningún vendedor tiene inventario actualmente.
              </ThemedText>
            ) : (
              data.sellerInventory.map((line) => (
                <Row
                  key={`${line.sellerId}-${line.productId}`}
                  label={`${data.names.sellers[line.sellerId] ?? `Vendedor #${line.sellerId}`} · ${data.names.products[line.productId] ?? `Producto #${line.productId}`}`}
                  value={String(line.quantity)}
                />
              ))
            )}
          </Card>

          <Card title="Ventas por vendedor (histórico)">
            {data.sellerSales.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Sin ventas de vendedores todavía.
              </ThemedText>
            ) : (
              data.sellerSales.map((line) => (
                <Row
                  key={line.sellerId}
                  label={data.names.sellers[line.sellerId] ?? `Vendedor #${line.sellerId}`}
                  value={`${line.count} · ${formatCOP(line.totalAmount)} · com. ${formatCOP(line.totalCommission)}`}
                />
              ))
            )}
          </Card>

          <Card title="Productos devueltos (histórico)">
            {data.returnedProducts.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Sin devoluciones todavía.
              </ThemedText>
            ) : (
              data.returnedProducts.map((line) => (
                <Row
                  key={line.productId}
                  label={data.names.products[line.productId] ?? `Producto #${line.productId}`}
                  value={String(line.totalQuantity)}
                />
              ))
            )}
          </Card>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four },
  scrollContent: { gap: Spacing.three, paddingBottom: Spacing.five },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
  dateRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one, marginBottom: Spacing.one },
  dateField: { flex: 1 },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  cardTitle: { marginBottom: Spacing.one },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
});
