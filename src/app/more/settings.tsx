import { Alert, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useThemePreference } from '@/hooks/use-app-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useSyncSession } from '@/hooks/use-sync-session';
import { sessionStore } from '@/lib/sync/session';
import type { ThemePreference } from '@/lib/theme-preference';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'system', label: 'Sistema' },
];

const ROLE_LABEL = { owner: 'Dueño', seller: 'Vendedor' } as const;

export default function SettingsScreen() {
  const [preference, setPreference] = useThemePreference();
  const session = useSyncSession();
  const theme = useTheme();

  function handleLogout() {
    Alert.alert('Cerrar sesión', '¿Cerrar la sesión de este celular?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => sessionStore.logout() },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        {session.status === 'authenticated' && (
          <>
            <ThemedText type="small">Cuenta</ThemedText>
            <ThemedView type="backgroundElement" style={styles.accountCard}>
              <ThemedText>{session.session.user.name}</ThemedText>
              <ThemedText themeColor="textSecondary" type="small">
                {session.session.user.username} · {ROLE_LABEL[session.session.user.role]}
              </ThemedText>
            </ThemedView>
            <Pressable onPress={handleLogout} style={styles.logoutButton}>
              <ThemedText style={{ color: theme.error }}>Cerrar sesión</ThemedText>
            </Pressable>
          </>
        )}

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
  accountCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    marginBottom: Spacing.one,
    gap: Spacing.half,
  },
  logoutButton: {
    marginBottom: Spacing.four,
  },
});
