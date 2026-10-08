import { Link } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useMySeller } from '@/hooks/use-my-seller';

const OWNER_MENU_ITEMS = [
  { label: 'Reportes', href: '/more/reports' },
  { label: 'Caja', href: '/more/cash' },
  { label: 'Compras', href: '/more/purchases' },
  { label: 'Vendedores', href: '/more/sellers' },
  { label: 'Productos', href: '/more/products' },
  { label: 'Inventario', href: '/more/inventory' },
  { label: 'Categorías', href: '/more/products/categories' },
  { label: 'Respaldo', href: '/more/backup' },
  { label: 'Configuración', href: '/more/settings' },
] as const;

export default function MoreScreen() {
  const { isSeller, seller } = useMySeller();

  // A seller's menu is only their own stuff. Consignment: inventory (with
  // sale / return / loss actions — the seller detail screen, which hides the
  // owner-only controls for this role) and settlements. Store: they sell the
  // principal inventory from Vender and never settle, so only their sales.
  const items: { label: string; href: string }[] = !isSeller
    ? [...OWNER_MENU_ITEMS]
    : seller?.inventoryMode === 'store'
      ? [
          { label: 'Mis ventas', href: '/sell/history' },
          ...(seller ? [{ label: 'Mis comisiones', href: `/more/sellers/${seller.id}` }] : []),
          { label: 'Configuración', href: '/more/settings' },
        ]
      : [
          ...(seller ? [{ label: 'Mi inventario', href: `/more/sellers/${seller.id}` }] : []),
          { label: 'Mis liquidaciones', href: '/more/sellers/settlements' },
          { label: 'Configuración', href: '/more/settings' },
        ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        {items.map((item) => (
          <Link key={item.href} href={item.href as never} asChild>
            <Pressable>
              <ThemedView type="backgroundElement" style={styles.row}>
                <ThemedText type="link">{item.label}</ThemedText>
              </ThemedView>
            </Pressable>
          </Link>
        ))}
        {isSeller && !seller ? (
          <ThemedText themeColor="textSecondary" type="small">
            Tu inventario aparecerá aquí después de la primera sincronización (Configuración → Sincronizar ahora).
          </ThemedText>
        ) : null}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.two },
  row: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
});
