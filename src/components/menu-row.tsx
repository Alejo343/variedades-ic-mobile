import { Link } from 'expo-router';
import { ChevronRight, type LucideProps } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type MenuRowProps = {
  href: string;
  icon: ComponentType<LucideProps>;
  title: string;
  subtitle?: string;
  color?: string;
  // Hairline above the row, for stacking several rows inside one card.
  divider?: boolean;
};

// One tappable row of a grouped menu card: tinted icon, title, optional
// subtitle, chevron.
export function MenuRow({ href, icon: Icon, title, subtitle, color, divider }: MenuRowProps) {
  const theme = useTheme();
  const tint = color ?? theme.primary;
  return (
    <Link href={href as never} asChild>
      <Pressable>
        {/* Link asChild rejects style arrays on its direct child — keep them on this View. */}
        <View style={[styles.row, divider && { borderTopWidth: 1, borderTopColor: theme.border }]}>
          <View style={[styles.icon, { backgroundColor: withAlpha(tint, 0.12) }]}>
            <Icon color={tint} size={20} />
          </View>
          <View style={styles.text}>
            <ThemedText type="default">{title}</ThemedText>
            {subtitle ? (
              <ThemedText type="caption" themeColor="textSecondary">
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
          <ChevronRight color={theme.textSecondary} size={18} />
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
