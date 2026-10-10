import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { PackageSearch, Plus, Tags } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormChip } from '@/components/form';
import { PosSearchBar, ProductThumb } from '@/components/pos';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useTheme } from '@/hooks/use-theme';
import { categoriesRepo, productsRepo, type Product } from '@/lib/data';
import { formatCOP } from '@/lib/format';
import { pendingUuidsForType } from '@/lib/sync/outbox';

type Filter = 'all' | 'low' | 'out' | 'inactive';

type StockState = 'ok' | 'low' | 'out';

function stockState(p: Product): StockState {
  if (p.stock <= 0) return 'out';
  if (p.minStock > 0 && p.stock <= p.minStock) return 'low';
  return 'ok';
}

function matchesFilter(p: Product, filter: Filter): boolean {
  if (filter === 'inactive') return !p.active;
  if (!p.active) return false;
  if (filter === 'all') return true;
  return stockState(p) === filter;
}

export default function ProductsScreen() {
  const theme = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryNames, setCategoryNames] = useState<Record<number, string>>({});
  const [pendingUuids, setPendingUuids] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  // Opened from a category ("Ver productos") with only its products.
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();
  const onlyCategoryId = categoryId ? Number(categoryId) : null;

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([productsRepo.list(), categoriesRepo.list(), pendingUuidsForType('upsertProduct')]).then(
        ([rows, categories, pending]) => {
          if (cancelled) return;
          setProducts(
            rows.filter((p) => onlyCategoryId === null || p.categoryId === onlyCategoryId).sort((a, b) => a.name.localeCompare(b.name)),
          );
          setCategoryNames(Object.fromEntries(categories.map((c) => [c.id, c.name])));
          setPendingUuids(pending);
          setLoading(false);
        },
      );
      return () => {
        cancelled = true;
      };
    }, [onlyCategoryId]),
  );

  const counts = useMemo(
    () => ({
      all: products.filter((p) => matchesFilter(p, 'all')).length,
      low: products.filter((p) => matchesFilter(p, 'low')).length,
      out: products.filter((p) => matchesFilter(p, 'out')).length,
      inactive: products.filter((p) => matchesFilter(p, 'inactive')).length,
    }),
    [products],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (!matchesFilter(p, filter)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.distributorCode ?? '').toLowerCase().includes(q)
      );
    });
  }, [products, search, filter]);

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: `Activos · ${counts.all}` },
    { key: 'low', label: `Stock bajo · ${counts.low}` },
    { key: 'out', label: `Agotados · ${counts.out}` },
    ...(counts.inactive > 0 ? [{ key: 'inactive' as const, label: `Inactivos · ${counts.inactive}` }] : []),
  ];

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: onlyCategoryId !== null ? (categoryNames[onlyCategoryId] ?? 'Productos') : 'Productos',
          headerRight: () => (
            <Link href="/more/products/categories" asChild>
              <Pressable hitSlop={8} style={styles.headerAction}>
                <Tags color={theme.primary} size={18} />
                <ThemedText type="smallBold" style={{ color: theme.primary }}>
                  Categorías
                </ThemedText>
              </Pressable>
            </Link>
          ),
        }}
      />
      <SafeAreaView style={styles.flex} edges={[]}>
        <View style={styles.header}>
          <PosSearchBar value={search} onChangeText={setSearch} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {filters.map(({ key, label }) => (
              <FormChip key={key} label={label} selected={filter === key} onPress={() => setFilter(key)} />
            ))}
          </ScrollView>
        </View>

        <FlatList
          data={visible}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <View style={[styles.emptyIcon, { backgroundColor: theme.primaryLight }]}>
                  <PackageSearch color={theme.primary} size={28} />
                </View>
                <ThemedText type="secondary" themeColor="textSecondary" style={styles.center}>
                  {products.length === 0
                    ? 'Todavía no hay productos. Crea el primero con el botón de abajo.'
                    : 'Ningún producto coincide con la búsqueda o el filtro.'}
                </ThemedText>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const state = stockState(item);
            const stockColor = state === 'out' ? theme.error : state === 'low' ? theme.warning : theme.primary;
            const details = [item.sku + (pendingUuids.has(item.uuid) ? ' (pendiente)' : '')];
            if (item.categoryId !== null && categoryNames[item.categoryId]) details.push(categoryNames[item.categoryId]);
            return (
              <Link href={{ pathname: '/more/products/[id]', params: { id: String(item.id) } }} asChild>
                <Pressable>
                  {/* Link asChild rejects style arrays on its direct child. */}
                  <View>
                    <ThemedView type="backgroundElement" style={[styles.row, Shadow.subtle, !item.active && styles.inactive]}>
                      <ProductThumb uri={item.primaryImageUri} style={styles.thumb} iconSize={22} />
                      <View style={styles.info}>
                        <ThemedText type="default" numberOfLines={1}>
                          {item.name}
                        </ThemedText>
                        <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                          {details.join(' · ')}
                        </ThemedText>
                        <ThemedText type="smallBold">{formatCOP(item.price)}</ThemedText>
                      </View>
                      <View style={[styles.stockBadge, { backgroundColor: withAlpha(item.active ? stockColor : theme.textSecondary, 0.12) }]}>
                        <ThemedText type="smallBold" style={{ color: item.active ? stockColor : theme.textSecondary }}>
                          {item.stock}
                        </ThemedText>
                        <ThemedText type="caption" style={{ color: item.active ? stockColor : theme.textSecondary }}>
                          {!item.active ? 'inactivo' : state === 'out' ? 'agotado' : state === 'low' ? 'bajo' : 'en stock'}
                        </ThemedText>
                      </View>
                    </ThemedView>
                  </View>
                </Pressable>
              </Link>
            );
          }}
        />

        <Link href="/more/products/new" asChild>
          <Pressable style={styles.fabWrap}>
            <View style={[styles.fab, Shadow.subtle, { backgroundColor: theme.primary }]}>
              <Plus color="#FFFFFF" size={20} />
              <ThemedText type="cardTitle" style={styles.onPrimary}>
                Nuevo producto
              </ThemedText>
            </View>
          </Pressable>
        </Link>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  headerAction: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  header: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.three },
  chips: { gap: Spacing.two, paddingBottom: Spacing.three },
  // Bottom room so the last row clears the floating button.
  listContent: { paddingHorizontal: Layout.screenPadding, gap: Spacing.two, paddingBottom: 96 },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.six },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radii.card },
  inactive: { opacity: 0.6 },
  thumb: { width: 56, height: 56, borderRadius: Spacing.two },
  info: { flex: 1, gap: 2 },
  stockBadge: { minWidth: 64, alignItems: 'center', borderRadius: Spacing.three, paddingVertical: Spacing.one, paddingHorizontal: Spacing.two },
  fabWrap: { position: 'absolute', right: Layout.screenPadding, bottom: Spacing.three },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Radii.buttonPrimary,
  },
  onPrimary: { color: '#FFFFFF' },
});
