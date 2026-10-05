import { Link } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { categoriesRepo, type Category } from '@/lib/data';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      categoriesRepo.list().then((rows) => {
        if (!cancelled) {
          setCategories(rows);
          setLoading(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <FlatList
          data={categories}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            !loading ? (
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                Sin categorías todavía.
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => (
            <Link href={`/more/products/categories/${item.id}`} asChild>
              <Pressable>
                <ThemedView type="backgroundElement" style={styles.row}>
                  <ThemedText type="default">{item.name}</ThemedText>
                  <ThemedText themeColor="textSecondary" type="small">
                    {item.slug}
                    {!item.active ? ' · inactiva' : ''}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </Link>
          )}
        />

        <Link href="/more/products/categories/new" asChild>
          <Pressable>
            <ThemedView type="backgroundSelected" style={styles.newButton}>
              <ThemedText type="linkPrimary">+ Nueva categoría</ThemedText>
            </ThemedView>
          </Pressable>
        </Link>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  listContent: { gap: Spacing.two },
  empty: { textAlign: 'center', paddingVertical: Spacing.five },
  row: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.half,
  },
  newButton: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
