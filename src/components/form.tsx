import type { ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Building blocks for edit forms in the "Tablero del negocio" style: a titled
// card per group of fields, a label above each input, an optional hint below.

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="sectionTitle">{title}</ThemedText>
      <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
        {children}
      </ThemedView>
    </View>
  );
}

export function FormField({ label, hint, children, style }: { label: string; hint?: string; children: ReactNode; style?: object }) {
  return (
    <View style={[styles.field, style]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
      {hint ? (
        <ThemedText type="caption" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

// Side-by-side fields (e.g. sale and purchase price).
export function FormRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export function FormInput({ prefix, style, multiline, ...props }: TextInputProps & { prefix?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.inputBox, { borderColor: theme.border, backgroundColor: theme.background }, multiline && styles.inputBoxMultiline]}>
      {prefix ? (
        <ThemedText type="default" themeColor="textSecondary">
          {prefix}
        </ThemedText>
      ) : null}
      <TextInput
        placeholderTextColor={theme.textSecondary}
        multiline={multiline}
        style={[styles.input, { color: theme.text }, multiline && styles.inputMultiline, style]}
        {...props}
      />
    </View>
  );
}

// One option of a single-choice chip row (e.g. the product's category).
export function FormChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress}>
      <View
        style={[
          styles.chip,
          selected
            ? { backgroundColor: theme.primary, borderColor: theme.primary }
            : { backgroundColor: theme.background, borderColor: theme.border },
        ]}>
        <ThemedText type="small" style={{ color: selected ? '#FFFFFF' : theme.text }}>
          {label}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { borderWidth: 1, borderRadius: Radii.chip, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  section: { gap: Spacing.two },
  card: { borderRadius: Radii.card, padding: Spacing.three, gap: Spacing.three },
  field: { gap: Spacing.one },
  row: { flexDirection: 'row', gap: Spacing.three },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  inputBoxMultiline: { alignItems: 'flex-start' },
  input: { flex: 1, paddingVertical: Spacing.three, fontSize: 16 },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
});
