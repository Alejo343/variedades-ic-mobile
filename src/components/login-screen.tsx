import * as Device from 'expo-device';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { sessionStore } from '@/lib/sync/session';

// Shown instead of the tabs whenever there's no session (app/_layout.tsx) —
// not a routed screen, same pattern as components/app-tabs.tsx. Both the
// owner and sellers sign in here (sub-paso 9); role-based navigation
// (vendedor vs. dueño) is sub-paso 14, not this screen's job.
export function LoginScreen() {
  const theme = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [restartMessage, setRestartMessage] = useState<string | null>(null);

  async function handleSubmit() {
    if (!username.trim() || !password) {
      setError('Usuario y contraseña son requeridos');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const deviceName = Device.deviceName ?? Device.modelName ?? undefined;
      const result = await sessionStore.login(username.trim(), password, deviceName);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.restartRequired) {
        setRestartMessage('Todo listo. Cierra la app por completo y vuelve a abrirla para continuar.');
      }
      // If a restart isn't required, sessionStore already flipped to
      // "authenticated" and app/_layout.tsx re-renders the tabs on its own —
      // nothing else to do here.
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  if (restartMessage) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <ThemedText type="greeting" style={styles.title}>
            ¡Bienvenido!
          </ThemedText>
          <ThemedText style={styles.restartMessage}>{restartMessage}</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ThemedText type="greeting" style={styles.title}>
          IC Variedades
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          Inicia sesión para sincronizar con el servidor.
        </ThemedText>

        <ThemedText type="small">Usuario</ThemedText>
        <TextInput
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          placeholder="usuario"
          placeholderTextColor={theme.textSecondary}
          style={inputStyle}
        />

        <ThemedText type="small">Contraseña</ThemedText>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          placeholder="contraseña"
          placeholderTextColor={theme.textSecondary}
          style={inputStyle}
          onSubmitEditing={handleSubmit}
        />

        {error && <ThemedText style={[styles.error, { color: theme.error }]}>{error}</ThemedText>}

        <Pressable onPress={handleSubmit} disabled={loading} style={styles.buttonWrap}>
          <ThemedView type="backgroundSelected" style={styles.button}>
            {loading ? <ActivityIndicator /> : <ThemedText type="linkPrimary">Iniciar sesión</ThemedText>}
          </ThemedView>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.two, justifyContent: 'center' },
  title: { marginBottom: Spacing.one, textAlign: 'center' },
  subtitle: { marginBottom: Spacing.four, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  buttonWrap: { marginTop: Spacing.two },
  button: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  error: { marginBottom: Spacing.two },
  restartMessage: { textAlign: 'center', marginTop: Spacing.two },
});
