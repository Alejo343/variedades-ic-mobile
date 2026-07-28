import { Link } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

const MENU_ITEMS = [
  { label: 'Reportes', href: '/more/reports' },
  { label: 'Caja', href: '/more/cash' },
  { label: 'Compras', href: '/more/purchases' },
  { label: 'Vendedores', href: '/more/sellers' },
  { label: 'Inventario', href: '/more/inventory' },
  { label: 'Categorías', href: '/more/products/categories' },
  { label: 'Respaldo', href: '/more/backup' },
  { label: 'Configuración', href: '/more/settings' },
] as const;

export default function MoreScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        {MENU_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} asChild>
            <Pressable>
              <ThemedView type="backgroundElement" style={styles.row}>
                <ThemedText type="link">{item.label}</ThemedText>
              </ThemedView>
            </Pressable>
          </Link>
        ))}
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
