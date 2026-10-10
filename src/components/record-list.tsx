import type { LucideProps } from 'lucide-react-native';
import type { ComponentType, ReactNode } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';

export type RecordRow = {
  key: string;
  title: string;
  subtitle: string;
  // Right column: an amount or a count; omitted when there's nothing to show.
  value?: string;
  valueCaption?: string;
};

// Read-only history list (deliveries, returns, losses): one icon and tint for
// the whole list, an optional header (summary card) and a footer slot (a
// fixed action under the list).
export function RecordList({
  rows,
  loading,
  icon: Icon,
  tint,
  emptyText,
  header,
  footer,
}: {
  rows: RecordRow[];
  loading: boolean;
  icon: ComponentType<LucideProps>;
  tint: string;
  emptyText: string;
  header?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={[]}>
        <FlatList
          data={rows}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={header ? <View style={styles.header}>{header}</View> : null}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <View style={[styles.emptyIcon, { backgroundColor: withAlpha(tint, 0.12) }]}>
                  <Icon color={tint} size={28} />
                </View>
                <ThemedText type="secondary" themeColor="textSecondary" style={styles.center}>
                  {emptyText}
                </ThemedText>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <ThemedView type="backgroundElement" style={[styles.row, Shadow.subtle]}>
              <View style={[styles.iconDot, { backgroundColor: withAlpha(tint, 0.12) }]}>
                <Icon color={tint} size={18} />
              </View>
              <View style={styles.flex}>
                <ThemedText type="small" numberOfLines={1}>
                  {item.title}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary" numberOfLines={2}>
                  {item.subtitle}
                </ThemedText>
              </View>
              {item.value ? (
                <View style={styles.right}>
                  <ThemedText type="smallBold">{item.value}</ThemedText>
                  {item.valueCaption ? (
                    <ThemedText type="caption" themeColor="textSecondary">
                      {item.valueCaption}
                    </ThemedText>
                  ) : null}
                </View>
              ) : null}
            </ThemedView>
          )}
        />
        {footer}
      </SafeAreaView>
    </ThemedView>
  );
}

// "Filtrado por …" card for a list opened from a seller's profile.
export function FilterNote({ text }: { text: string }) {
  return (
    <ThemedText type="caption" themeColor="textSecondary">
      {text}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1, gap: 2 },
  center: { textAlign: 'center' },
  listContent: { padding: Layout.screenPadding, gap: Spacing.two, paddingBottom: Spacing.five },
  header: { marginBottom: Spacing.two, gap: Spacing.two },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.six },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radii.card },
  iconDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  right: { alignItems: 'flex-end', gap: 2 },
});
