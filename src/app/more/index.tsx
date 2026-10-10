import { BarChart3, Boxes, Package, Settings, ShoppingCart, Tags, Users, Wallet } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MenuRow } from '@/components/menu-row';
import { SellerHome } from '@/components/seller-home';
import { SyncStatusPill } from '@/components/sync-status';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing } from '@/constants/theme';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useMySeller } from '@/hooks/use-my-seller';
import { useTheme } from '@/hooks/use-theme';
import { cashRepo, categoriesRepo, productsRepo, purchaseOrdersRepo, sellersRepo } from '@/lib/data';
import { formatCOP } from '@/lib/format';

// One live hint per module, so the menu doubles as a glance at the business.
type Hints = {
  cashBalance: number;
  openOrders: number;
  activeSellers: number;
  activeProducts: number;
  outOfStock: number;
  lowStock: number;
  categories: number;
};

async function loadHints(): Promise<Hints> {
  const [balance, orders, sellers, products, categories] = await Promise.all([
    cashRepo.getBalance(),
    purchaseOrdersRepo.list(),
    sellersRepo.list(),
    productsRepo.list(),
    categoriesRepo.list(),
  ]);
  const active = products.filter((p) => p.active);
  return {
    cashBalance: balance,
    openOrders: orders.filter((o) => o.status === 'pendiente' || o.status === 'en_viaje').length,
    activeSellers: sellers.filter((s) => s.active).length,
    activeProducts: active.length,
    // Same rules as the Productos list: out = stock <= 0, low = at or under its minimum.
    outOfStock: active.filter((p) => p.stock <= 0).length,
    lowStock: active.filter((p) => p.stock > 0 && p.minStock > 0 && p.stock <= p.minStock).length,
    categories: categories.filter((c) => c.active).length,
  };
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function inventoryHint(h: Hints): string {
  const parts: string[] = [];
  if (h.outOfStock > 0) parts.push(plural(h.outOfStock, 'agotado', 'agotados'));
  if (h.lowStock > 0) parts.push(`${h.lowStock} con stock bajo`);
  return parts.length > 0 ? parts.join(' · ') : 'Todo con stock';
}

export default function MoreScreen() {
  const { isSeller, seller, loading } = useMySeller();

  // A seller gets their own summary + the few screens of their role
  // (components/seller-home.tsx); the owner gets the grouped module menu.
  if (isSeller) return <SellerHome seller={seller} loading={loading} />;
  return <OwnerMenu />;
}

function OwnerMenu() {
  const theme = useTheme();
  const [hints, setHints] = useState<Hints | null>(null);

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadHints().then((h) => {
        if (!cancelled) setHints(h);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={[]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.pill}>
            <SyncStatusPill />
          </View>

          <View style={styles.section}>
            <ThemedText type="sectionTitle">Negocio</ThemedText>
            <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
              <MenuRow href="/more/reports" icon={BarChart3} color={theme.info} title="Reportes" subtitle="Ventas, utilidad e inventario" />
              <MenuRow
                href="/more/cash"
                icon={Wallet}
                title="Caja"
                subtitle={hints ? `Saldo ${formatCOP(hints.cashBalance)}` : 'Movimientos y cuentas'}
                divider
              />
              <MenuRow
                href="/more/purchases"
                icon={ShoppingCart}
                color={theme.warning}
                title="Compras"
                subtitle={
                  hints && hints.openOrders > 0
                    ? `${plural(hints.openOrders, 'pedido', 'pedidos')} en curso`
                    : 'Pedidos y distribuidores'
                }
                divider
              />
              <MenuRow
                href="/more/sellers"
                icon={Users}
                color={theme.purple}
                title="Vendedores"
                subtitle={hints ? plural(hints.activeSellers, 'vendedor activo', 'vendedores activos') : 'Entregas y liquidaciones'}
                divider
              />
            </ThemedView>
          </View>

          <View style={styles.section}>
            <ThemedText type="sectionTitle">Catálogo</ThemedText>
            <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
              <MenuRow
                href="/more/products"
                icon={Package}
                title="Productos"
                subtitle={hints ? plural(hints.activeProducts, 'producto activo', 'productos activos') : 'Precios y fotos'}
              />
              <MenuRow
                href="/more/inventory"
                icon={Boxes}
                color={hints && hints.outOfStock > 0 ? theme.error : hints && hints.lowStock > 0 ? theme.warning : theme.info}
                title="Inventario"
                subtitle={hints ? inventoryHint(hints) : 'Stock y movimientos'}
                divider
              />
              <MenuRow
                href="/more/products/categories"
                icon={Tags}
                color={theme.info}
                title="Categorías"
                subtitle={hints ? plural(hints.categories, 'categoría', 'categorías') : 'Agrupan productos y SKU'}
                divider
              />
            </ThemedView>
          </View>

          <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
            <MenuRow
              href="/more/settings"
              icon={Settings}
              color={theme.textSecondary}
              title="Configuración"
              subtitle="Cuenta, sincronización y tema"
            />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { padding: Layout.screenPadding, gap: Layout.cardGap, paddingBottom: Spacing.six },
  pill: { flexDirection: 'row' },
  section: { gap: Spacing.two },
  card: { borderRadius: Radii.card, paddingHorizontal: Spacing.three },
});
