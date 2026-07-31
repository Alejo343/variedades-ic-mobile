import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useThemePreference } from '@/hooks/use-app-color-scheme';
import type { ThemePreference } from '@/lib/theme-preference';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'system', label: 'Sistema' },
];

export default function SettingsScreen() {
  const [preference, setPreference] = useThemePreference();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ThemedText type="small">Tema</ThemedText>
        <ThemedView style={styles.optionRow}>
          {OPTIONS.map((option) => (
            <Pressable key={option.value} style={styles.optionFlex} onPress={() => setPreference(option.value)}>
              <ThemedView
                type={preference === option.value ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.optionButton}>
                <ThemedText type={preference === option.value ? 'linkPrimary' : undefined}>{option.label}</ThemedText>
              </ThemedView>
            </Pressable>
          ))}
        </ThemedView>
        <ThemedText themeColor="textSecondary" type="small">
          &quot;Sistema&quot; sigue el modo claro/oscuro configurado en el teléfono.
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.two },
  optionRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.two },
  optionFlex: { flex: 1 },
  optionButton: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
