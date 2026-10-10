import { Link } from 'expo-router';
import { ChevronRight, Plus, Tag } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useTheme } from '@/hooks/use-theme';
import { categoriesRepo, productsRepo, type Category } from '@/lib/data';
import { getSkuPrefix } from '@/lib/domain/sku';

type Row = Category & { products: number };

export default function CategoriesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<Row[]>([]);
  const [uncategorized, setUncategorized] = useState(0);
  const [loading, setLoading] = useState(true);

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([categoriesRepo.list(), productsRepo.list()]).then(([categories, products]) => {
        if (cancelled) return;
        const active = products.filter((p) => p.active);
        setRows(
          categories
            .map((c) => ({ ...c, products: active.filter((p) => p.categoryId === c.id).length }))
            .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)),
        );
        setUncategorized(active.filter((p) => p.categoryId === null).length);
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={[]}>
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <View style={[styles.emptyIcon, { backgroundColor: theme.primaryLight }]}>
                  <Tag color={theme.primary} size={28} />
                </View>
                <ThemedText type="secondary" themeColor="textSecondary" style={styles.center}>
                  Todavía no hay categorías. Sirven para filtrar en Vender y para el prefijo del SKU.
                </ThemedText>
              </View>
            ) : null
          }
          ListFooterComponent={
            uncategorized > 0 ? (
              <ThemedText type="caption" themeColor="textSecondary" style={styles.footer}>
                {uncategorized} {uncategorized === 1 ? 'producto está' : 'productos están'} en General (sin categoría), con SKU GEN-.
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => (
            <Link href={`/more/products/categories/${item.id}`} asChild>
              <Pressable>
                {/* Link asChild rejects style arrays on its direct child. */}
                <View>
                  <ThemedView type="backgroundElement" style={[styles.row, Shadow.subtle, !item.active && styles.dim]}>
                    <View style={[styles.iconDot, { backgroundColor: withAlpha(theme.primary, 0.12) }]}>
                      <Tag color={theme.primary} size={18} />
                    </View>
                    <View style={styles.flex}>
                      <ThemedText type="default" numberOfLines={1}>
                        {item.name}
                      </ThemedText>
                      <ThemedText type="caption" themeColor="textSecondary">
                        {item.products} {item.products === 1 ? 'producto' : 'productos'}
                        {!item.active ? ' · inactiva' : ''}
                      </ThemedText>
                    </View>
                    <View style={[styles.skuChip, { backgroundColor: withAlpha(theme.info, 0.12) }]}>
                      <ThemedText type="caption" style={{ color: theme.info }}>
                        {getSkuPrefix(item.name)}-
                      </ThemedText>
                    </View>
                    <ChevronRight color={theme.textSecondary} size={18} />
                  </ThemedView>
                </View>
              </Pressable>
            </Link>
          )}
        />

        <ThemedView
          type="backgroundElement"
          style={[styles.bottomBar, { borderTopColor: theme.border, paddingBottom: Spacing.three + insets.bottom }]}>
          <Link href="/more/products/categories/new" asChild>
            <Pressable>
              <View style={[styles.primaryButton, { backgroundColor: theme.primary }]}>
                <Plus color="#FFFFFF" size={18} />
                <ThemedText type="cardTitle" style={styles.onPrimary}>
                  Nueva categoría
                </ThemedText>
              </View>
            </Pressable>
          </Link>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  listContent: { padding: Layout.screenPadding, gap: Spacing.two },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.six },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  footer: { marginTop: Spacing.two, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radii.card },
  dim: { opacity: 0.6 },
  iconDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  skuChip: { borderRadius: Radii.chip, paddingHorizontal: Spacing.two, paddingVertical: 2 },
  bottomBar: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.three, borderTopWidth: 1 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Radii.buttonPrimary,
  },
  onPrimary: { color: '#FFFFFF' },
});
