import { Link } from 'expo-router';
import { ChevronRight, ReceiptText, Search, ShoppingCart, Truck, Users, type LucideProps } from 'lucide-react-native';
import { useCallback, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormChip } from '@/components/form';
import { PosSearchBar, ProductThumb } from '@/components/pos';
import { PurchaseStatusChip } from '@/components/purchase-status';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useTheme } from '@/hooks/use-theme';
import {
  directSalesRepo,
  distributorsRepo,
  productsRepo,
  purchaseOrdersRepo,
  sellerSalesRepo,
  sellersRepo,
  type DirectSale,
  type Distributor,
  type Product,
  type PurchaseOrder,
  type Seller,
  type SellerSale,
} from '@/lib/data';
import { formatCOP, formatDateTime } from '@/lib/format';
import { matchesRecordNumber, normalizeSearch, rankMatches } from '@/lib/search';
import { pendingUuidsForType } from '@/lib/sync/outbox';

type GroupKey = 'products' | 'sales' | 'sellers' | 'distributors' | 'orders';

const GROUP_LABEL: Record<GroupKey, string> = {
  products: 'Productos',
  sales: 'Ventas',
  sellers: 'Vendedores',
  distributors: 'Distribuidores',
  orders: 'Compras',
};

// "Todo" shows a preview of each group; tapping its chip or "Ver los N"
// shows the whole group, capped so a one-letter search stays fast.
const PREVIEW_ROWS = 4;
const MAX_ROWS = 50;

// Shop sales and consignment sales share one "Ventas" group, newest first.
type SaleHit =
  | { kind: 'direct'; sale: DirectSale }
  | { kind: 'seller'; sale: SellerSale };

type Data = {
  products: Product[];
  sellers: Seller[];
  distributors: Distributor[];
  directSales: DirectSale[];
  sellerSales: SellerSale[];
  orders: PurchaseOrder[];
  pendingProductUuids: Set<string>;
};

const EMPTY_DATA: Data = {
  products: [],
  sellers: [],
  distributors: [],
  directSales: [],
  sellerSales: [],
  orders: [],
  pendingProductUuids: new Set(),
};

export default function SearchScreen() {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<GroupKey | 'all'>('all');
  const [data, setData] = useState<Data>(EMPTY_DATA);

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([
        productsRepo.list(),
        sellersRepo.list(),
        distributorsRepo.list(),
        directSalesRepo.list(),
        sellerSalesRepo.list(),
        purchaseOrdersRepo.list(),
        pendingUuidsForType('upsertProduct'),
      ]).then(([products, sellers, distributors, directSales, sellerSales, orders, pendingProductUuids]) => {
        if (!cancelled) setData({ products, sellers, distributors, directSales, sellerSales, orders, pendingProductUuids });
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const names = useMemo(
    () => ({
      product: new Map(data.products.map((p) => [p.id, p.name])),
      seller: new Map(data.sellers.map((s) => [s.id, s.name])),
      distributor: new Map(data.distributors.map((d) => [d.id, d.name])),
    }),
    [data],
  );

  const q = normalizeSearch(query);

  const results = useMemo(() => {
    if (!q) return null;
    const productNames = (items: { productId: number }[]) => items.map((i) => names.product.get(i.productId));

    const sales: SaleHit[] = [
      ...data.directSales
        .filter(
          (s) =>
            matchesRecordNumber(s.id, q) ||
            rankMatches([s], q, (x) => [x.notes, x.sellerId !== null ? names.seller.get(x.sellerId) : null, ...productNames(x.items)])
              .length > 0,
        )
        .map((sale) => ({ kind: 'direct' as const, sale })),
      ...data.sellerSales
        .filter(
          (s) =>
            matchesRecordNumber(s.id, q) ||
            rankMatches([s], q, (x) => [x.notes, names.seller.get(x.sellerId), ...productNames(x.items)]).length > 0,
        )
        .map((sale) => ({ kind: 'seller' as const, sale })),
    ].sort((a, b) => b.sale.saleDate.localeCompare(a.sale.saleDate));

    const orders = data.orders.filter(
      (o) =>
        matchesRecordNumber(o.id, q) ||
        rankMatches([o], q, (x) => [
          x.distributorId !== null ? names.distributor.get(x.distributorId) : null,
          x.notes,
          ...productNames(x.items),
        ]).length > 0,
    );

    return {
      products: rankMatches(data.products, q, (p) => [p.name, p.sku, p.distributorCode]),
      sales,
      sellers: rankMatches(data.sellers, q, (s) => [s.name, s.phone, s.city]),
      distributors: rankMatches(data.distributors, q, (d) => [d.name, d.phone, d.city]),
      orders,
    };
  }, [q, data, names]);

  const counts: Record<GroupKey, number> = {
    products: results?.products.length ?? 0,
    sales: results?.sales.length ?? 0,
    sellers: results?.sellers.length ?? 0,
    distributors: results?.distributors.length ?? 0,
    orders: results?.orders.length ?? 0,
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const groupKeys = (Object.keys(GROUP_LABEL) as GroupKey[]).filter((k) => counts[k] > 0);
  // A chip whose group emptied out (the query changed) falls back to "Todo".
  const activeFilter = filter !== 'all' && counts[filter] > 0 ? filter : 'all';
  const visibleGroups = activeFilter === 'all' ? groupKeys : [activeFilter];
  const limit = activeFilter === 'all' ? PREVIEW_ROWS : MAX_ROWS;

  function renderRows(key: GroupKey): ReactNode[] {
    if (!results) return [];
    switch (key) {
      case 'products':
        return results.products.slice(0, limit).map((p) => <ProductRow key={p.id} product={p} pending={data.pendingProductUuids.has(p.uuid)} />);
      case 'sales':
        return results.sales.slice(0, limit).map((hit) => {
          const sellerId = hit.sale.sellerId;
          const sellerName = sellerId !== null ? names.seller.get(sellerId) : null;
          const items = hit.sale.items;
          const firstNames = items
            .slice(0, 2)
            .map((i) => `${i.quantity}× ${names.product.get(i.productId) ?? 'Producto'}`)
            .join(', ');
          const href =
            hit.kind === 'seller'
              ? `/more/sellers/sales?sellerId=${hit.sale.sellerId}`
              : sellerId !== null
                ? `/sell/history?sellerId=${sellerId}`
                : '/sell/history';
          return (
            <ResultRow
              key={`${hit.kind}-${hit.sale.id}`}
              href={href}
              icon={ReceiptText}
              color={hit.kind === 'seller' ? theme.purple : theme.success}
              title={`Venta #${hit.sale.id}${sellerName ? ` · ${sellerName}` : ' · en local'}`}
              subtitle={`${formatDateTime(hit.sale.saleDate)} · ${firstNames}${items.length > 2 ? ` y ${items.length - 2} más` : ''}`}
              right={<ThemedText type="smallBold">{formatCOP(hit.sale.totalAmount)}</ThemedText>}
            />
          );
        });
      case 'sellers':
        return results.sellers.slice(0, limit).map((s) => (
          <ResultRow
            key={s.id}
            href={`/more/sellers/${s.id}`}
            icon={Users}
            color={theme.purple}
            title={s.name}
            subtitle={[s.inventoryMode === 'store' ? 'Tienda' : 'Consignación', s.city, s.phone].filter(Boolean).join(' · ')}
            dim={!s.active}
          />
        ));
      case 'distributors':
        return results.distributors.slice(0, limit).map((d) => (
          <ResultRow
            key={d.id}
            href={`/more/purchases/distributors/${d.id}`}
            icon={Truck}
            color={theme.warning}
            title={d.name}
            subtitle={[d.city, d.phone].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
            dim={!d.active}
          />
        ));
      case 'orders':
        return results.orders.slice(0, limit).map((o) => (
          <ResultRow
            key={o.id}
            href={`/more/purchases/${o.id}`}
            icon={ShoppingCart}
            color={theme.warning}
            title={`Pedido #${o.id} · ${o.distributorId !== null ? (names.distributor.get(o.distributorId) ?? 'Distribuidor') : 'Sin distribuidor'}`}
            subtitle={`${formatDateTime(o.orderDate)} · ${formatCOP(o.totalCost)}`}
            right={<PurchaseStatusChip status={o.status} />}
          />
        ));
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={[]}>
        <View style={styles.header}>
          <PosSearchBar value={query} onChangeText={setQuery} placeholder="Productos, ventas, vendedores, compras…" />
          {results && total > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
              <FormChip label={`Todo · ${total}`} selected={activeFilter === 'all'} onPress={() => setFilter('all')} />
              {groupKeys.map((k) => (
                <FormChip key={k} label={`${GROUP_LABEL[k]} · ${counts[k]}`} selected={activeFilter === k} onPress={() => setFilter(k)} />
              ))}
            </ScrollView>
          ) : null}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}>
          {!results ? (
            <EmptyState
              title="Busca en todo el negocio"
              text="Productos por nombre, SKU o código del proveedor; ventas y pedidos por número (#12) o por producto; vendedores y distribuidores por nombre, ciudad o teléfono."
            />
          ) : total === 0 ? (
            <EmptyState title="Sin resultados" text={`Nada coincide con "${query.trim()}". Prueba con otra palabra o menos letras.`} />
          ) : (
            visibleGroups.map((key) => {
              const hidden = counts[key] - Math.min(counts[key], limit);
              return (
                <View key={key} style={styles.section}>
                  {activeFilter === 'all' ? (
                    <View style={styles.sectionHeader}>
                      <ThemedText type="sectionTitle">{GROUP_LABEL[key]}</ThemedText>
                      {hidden > 0 ? (
                        <Pressable onPress={() => setFilter(key)} hitSlop={8}>
                          <ThemedText type="smallBold" style={{ color: theme.primary }}>
                            Ver los {counts[key]}
                          </ThemedText>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                  <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
                    {renderRows(key).map((row, i) => (
                      <View key={i} style={i > 0 ? [styles.divider, { borderTopColor: theme.border }] : undefined}>
                        {row}
                      </View>
                    ))}
                  </ThemedView>
                  {activeFilter !== 'all' && hidden > 0 ? (
                    <ThemedText type="caption" themeColor="textSecondary" style={styles.center}>
                      Mostrando {MAX_ROWS} de {counts[key]}. Escribe más para afinar la búsqueda.
                    </ThemedText>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.primaryLight }]}>
        <Search color={theme.primary} size={28} />
      </View>
      <ThemedText type="cardTitle" style={styles.center}>
        {title}
      </ThemedText>
      <ThemedText type="secondary" themeColor="textSecondary" style={styles.center}>
        {text}
      </ThemedText>
    </View>
  );
}

function ResultRow({
  href,
  icon: Icon,
  color,
  title,
  subtitle,
  right,
  dim,
}: {
  href: string;
  icon: ComponentType<LucideProps>;
  color: string;
  title: string;
  subtitle: string;
  right?: ReactNode;
  dim?: boolean;
}) {
  const theme = useTheme();
  return (
    <Link href={href as never} asChild>
      <Pressable>
        {/* Link asChild rejects style arrays on its direct child. */}
        <View style={[styles.row, dim && styles.dim]}>
          <View style={[styles.iconDot, { backgroundColor: withAlpha(color, 0.12) }]}>
            <Icon color={color} size={18} />
          </View>
          <View style={styles.flex}>
            <ThemedText type="default" numberOfLines={1}>
              {title}
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
              {subtitle}
            </ThemedText>
          </View>
          {right ?? <ChevronRight color={theme.textSecondary} size={18} />}
        </View>
      </Pressable>
    </Link>
  );
}

function ProductRow({ product: p, pending }: { product: Product; pending: boolean }) {
  const theme = useTheme();
  const out = p.stock <= 0;
  const low = !out && p.minStock > 0 && p.stock <= p.minStock;
  const color = !p.active ? theme.textSecondary : out ? theme.error : low ? theme.warning : theme.primary;
  return (
    <Link href={{ pathname: '/more/products/[id]', params: { id: String(p.id) } }} asChild>
      <Pressable>
        <View style={[styles.row, !p.active && styles.dim]}>
          <ProductThumb uri={p.primaryImageUri} style={styles.thumb} iconSize={18} />
          <View style={styles.flex}>
            <ThemedText type="default" numberOfLines={1}>
              {p.name}
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
              {p.sku}
              {pending ? ' (pendiente)' : ''} · {formatCOP(p.price)}
            </ThemedText>
          </View>
          <View style={[styles.stockBadge, { backgroundColor: withAlpha(color, 0.12) }]}>
            <ThemedText type="smallBold" style={{ color }}>
              {p.stock}
            </ThemedText>
            <ThemedText type="caption" style={{ color }}>
              {!p.active ? 'inactivo' : out ? 'agotado' : low ? 'bajo' : 'en stock'}
            </ThemedText>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  header: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.three, gap: Spacing.three },
  chips: { gap: Spacing.two },
  scrollContent: { padding: Layout.screenPadding, gap: Layout.cardGap, paddingBottom: Spacing.six },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.six, paddingHorizontal: Spacing.three },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  section: { gap: Spacing.two },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { borderRadius: Radii.card, paddingHorizontal: Spacing.three },
  divider: { borderTopWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  dim: { opacity: 0.6 },
  iconDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 40, height: 40, borderRadius: Spacing.two },
  stockBadge: { minWidth: 56, alignItems: 'center', borderRadius: Spacing.three, paddingVertical: 2, paddingHorizontal: Spacing.two },
});
