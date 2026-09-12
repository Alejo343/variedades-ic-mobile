import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { distributorsRepo, type Distributor } from '@/lib/data';

export default function DistributorsScreen() {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      distributorsRepo.list().then((rows) => {
        if (!cancelled) {
          setDistributors(rows);
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
          data={distributors}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            !loading ? (
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                Sin distribuidores todavía.
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => (
            <Link href={`/more/purchases/distributors/${item.id}`} asChild>
              <Pressable>
                <ThemedView type="backgroundElement" style={styles.row}>
                  <ThemedText type="default">{item.name}</ThemedText>
                  <ThemedText themeColor="textSecondary" type="small">
                    {item.city ?? ''}
                    {item.phone ? ` · ${item.phone}` : ''}
                    {!item.active ? ' · inactivo' : ''}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </Link>
          )}
        />

        <Link href="/more/purchases/distributors/new" asChild>
          <Pressable>
            <ThemedView type="backgroundSelected" style={styles.newButton}>
              <ThemedText type="linkPrimary">+ Nuevo distribuidor</ThemedText>
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
