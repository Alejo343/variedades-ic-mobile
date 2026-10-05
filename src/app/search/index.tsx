import { Link } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
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
import { formatCOP } from '@/lib/format';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';

function includesQuery(value: string | null | undefined, q: string): boolean {
  return !!value && value.toLowerCase().includes(q);
}

export default function SearchScreen() {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [directSales, setDirectSales] = useState<DirectSale[]>([]);
  const [sellerSales, setSellerSales] = useState<SellerSale[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

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
      ]).then(([p, s, d, ds, ss, po]) => {
        if (cancelled) return;
        setProducts(p);
        setSellers(s);
        setDistributors(d);
        setDirectSales(ds);
        setSellerSales(ss);
        setPurchaseOrders(po);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const sellersById = useMemo(() => new Map(sellers.map((s) => [s.id, s])), [sellers]);
  const distributorsById = useMemo(() => new Map(distributors.map((d) => [d.id, d])), [distributors]);

  const q = query.trim().toLowerCase();

  const matchedProducts = useMemo(() => {
    if (!q) return [];
    return products.filter((p) => includesQuery(p.name, q) || includesQuery(p.sku, q));
  }, [products, q]);

  const matchedSellers = useMemo(() => {
    if (!q) return [];
    return sellers.filter((s) => includesQuery(s.name, q) || includesQuery(s.phone, q) || includesQuery(s.city, q));
  }, [sellers, q]);

  const matchedDistributors = useMemo(() => {
    if (!q) return [];
    return distributors.filter((d) => includesQuery(d.name, q) || includesQuery(d.phone, q));
  }, [distributors, q]);

  const matchedDirectSales = useMemo(() => {
    if (!q) return [];
    return directSales.filter(
      (sale) =>
        `#${sale.id}`.includes(q) ||
        includesQuery(sale.notes, q) ||
        sale.items.some((item) => includesQuery(productsById.get(item.productId)?.name, q)),
    );
  }, [directSales, productsById, q]);

  const matchedSellerSales = useMemo(() => {
    if (!q) return [];
    return sellerSales.filter(
      (sale) =>
        `#${sale.id}`.includes(q) ||
        includesQuery(sale.notes, q) ||
        includesQuery(sellersById.get(sale.sellerId)?.name, q) ||
        sale.items.some((item) => includesQuery(productsById.get(item.productId)?.name, q)),
    );
  }, [sellerSales, sellersById, productsById, q]);

  const matchedPurchaseOrders = useMemo(() => {
    if (!q) return [];
    return purchaseOrders.filter(
      (order) =>
        `#${order.id}`.includes(q) ||
        includesQuery(order.notes, q) ||
        includesQuery(order.distributorId ? distributorsById.get(order.distributorId)?.name : null, q),
    );
  }, [purchaseOrders, distributorsById, q]);

  const hasResults =
    matchedProducts.length > 0 ||
    matchedSellers.length > 0 ||
    matchedDistributors.length > 0 ||
    matchedDirectSales.length > 0 ||
    matchedSellerSales.length > 0 ||
    matchedPurchaseOrders.length > 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar productos, vendedores, distribuidores, ventas, compras…"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {!q ? (
            <ThemedText themeColor="textSecondary" style={styles.hint}>
              Escribe para buscar.
            </ThemedText>
          ) : !hasResults ? (
            <ThemedText themeColor="textSecondary" style={styles.hint}>
              Sin resultados.
            </ThemedText>
          ) : null}

          {matchedProducts.length > 0 ? (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">Productos</ThemedText>
              {matchedProducts.map((item) => (
                <Link key={item.id} href={{ pathname: '/more/products/[id]', params: { id: String(item.id) } }} asChild>
                  <Pressable>
                    <ThemedView type="backgroundElement" style={styles.row}>
                      <ThemedText type="small">{item.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {item.sku} · {formatCOP(item.price)}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                </Link>
              ))}
            </ThemedView>
          ) : null}

          {matchedSellers.length > 0 ? (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">Vendedores</ThemedText>
              {matchedSellers.map((item) => (
                <Link key={item.id} href={`/more/sellers/${item.id}`} asChild>
                  <Pressable>
                    <ThemedView type="backgroundElement" style={styles.row}>
                      <ThemedText type="small">{item.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {item.city ?? 'Sin ciudad'}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                </Link>
              ))}
            </ThemedView>
          ) : null}

          {matchedDistributors.length > 0 ? (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">Distribuidores</ThemedText>
              {matchedDistributors.map((item) => (
                <Link key={item.id} href={`/more/purchases/distributors/${item.id}`} asChild>
                  <Pressable>
                    <ThemedView type="backgroundElement" style={styles.row}>
                      <ThemedText type="small">{item.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {item.phone ?? 'Sin teléfono'}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                </Link>
              ))}
            </ThemedView>
          ) : null}

          {matchedDirectSales.length > 0 ? (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">Ventas en local</ThemedText>
              {matchedDirectSales.map((item) => (
                <Link key={item.id} href="/sell/history" asChild>
                  <Pressable>
                    <ThemedView type="backgroundElement" style={styles.row}>
                      <ThemedText type="small">Venta #{item.id}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {formatCOP(item.totalAmount)} · {item.saleDate}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                </Link>
              ))}
            </ThemedView>
          ) : null}

          {matchedSellerSales.length > 0 ? (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">Ventas de vendedor</ThemedText>
              {matchedSellerSales.map((item) => (
                <Link key={item.id} href="/more/sellers/sales" asChild>
                  <Pressable>
                    <ThemedView type="backgroundElement" style={styles.row}>
                      <ThemedText type="small">
                        Venta #{item.id} · {sellersById.get(item.sellerId)?.name ?? 'Vendedor'}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {formatCOP(item.totalAmount)} · {item.saleDate}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                </Link>
              ))}
            </ThemedView>
          ) : null}

          {matchedPurchaseOrders.length > 0 ? (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">Compras</ThemedText>
              {matchedPurchaseOrders.map((item) => (
                <Link key={item.id} href={`/more/purchases/${item.id}`} asChild>
                  <Pressable>
                    <ThemedView type="backgroundElement" style={styles.row}>
                      <ThemedText type="small">
                        Pedido #{item.id} · {item.distributorId ? (distributorsById.get(item.distributorId)?.name ?? 'Distribuidor') : 'Sin distribuidor'}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {formatCOP(item.totalCost)} · {item.status}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                </Link>
              ))}
            </ThemedView>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
  scrollContent: { gap: Spacing.three },
  hint: { textAlign: 'center', paddingVertical: Spacing.five },
  section: { gap: Spacing.two },
  row: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.half,
  },
});
