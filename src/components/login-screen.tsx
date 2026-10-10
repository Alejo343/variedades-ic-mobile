import * as Device from 'expo-device';
import { Image } from 'expo-image';
import { Eye, EyeOff, Lock, User, type LucideProps } from 'lucide-react-native';
import { useRef, useState, type ComponentType, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { sessionStore } from '@/lib/sync/session';

// Shown instead of the tabs whenever there's no session (app/_layout.tsx) —
// not a routed screen, same pattern as components/app-tabs.tsx. Both the
// owner and sellers sign in here; what each one sees after is decided by
// their role elsewhere.
export function LoginScreen() {
  const theme = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const canSubmit = username.trim().length > 0 && password.length > 0 && !loading;

  async function handleSubmit() {
    if (!username.trim() || !password) {
      setError('Escribe tu usuario y tu contraseña.');
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
      // sessionStore already flipped to "authenticated" (and, on a device's
      // first login, already emptied the local database — see
      // session.ts#login) — app/_layout.tsx re-renders the tabs on its
      // own, nothing else to do here.
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.brand}>
              <Image source={require('@/assets/images/icon.png')} style={styles.logo} contentFit="cover" />
              <ThemedText type="greeting" style={styles.center}>
                Bienvenido
              </ThemedText>
              <ThemedText type="secondary" themeColor="textSecondary" style={styles.center}>
                Entra con el usuario que te dio IC Variedades.
              </ThemedText>
            </View>

            <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
              <Field label="Usuario">
                <IconInput
                  icon={User}
                  value={username}
                  onChangeText={(v) => {
                    setUsername(v);
                    setError(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  textContentType="username"
                  placeholder="tu usuario"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  submitBehavior="submit"
                />
              </Field>

              <Field label="Contraseña">
                <IconInput
                  ref={passwordRef}
                  icon={Lock}
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    setError(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="current-password"
                  textContentType="password"
                  placeholder="tu contraseña"
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                  trailing={
                    <Pressable
                      onPress={() => setShowPassword((s) => !s)}
                      hitSlop={10}
                      accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                      {showPassword ? <EyeOff color={theme.textSecondary} size={20} /> : <Eye color={theme.textSecondary} size={20} />}
                    </Pressable>
                  }
                />
              </Field>

              {error ? (
                <View style={[styles.errorBox, { backgroundColor: withAlpha(theme.error, 0.08) }]}>
                  <ThemedText type="small" style={{ color: theme.error }}>
                    {error}
                  </ThemedText>
                </View>
              ) : null}

              <Pressable onPress={handleSubmit} disabled={!canSubmit}>
                <View style={[styles.primaryButton, { backgroundColor: theme.primary }, !canSubmit && styles.disabled]}>
                  {loading ? <ActivityIndicator color="#FFFFFF" /> : null}
                  <ThemedText type="cardTitle" style={styles.onPrimary}>
                    {loading ? 'Entrando…' : 'Iniciar sesión'}
                  </ThemedText>
                </View>
              </Pressable>
            </ThemedView>

            <ThemedText type="caption" themeColor="textSecondary" style={styles.center}>
              Necesitas internet para entrar. Después la app funciona sin conexión y sincroniza sola.
            </ThemedText>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

function IconInput({
  icon: Icon,
  trailing,
  ref,
  ...props
}: TextInputProps & { icon: ComponentType<LucideProps>; trailing?: ReactNode; ref?: React.Ref<TextInput> }) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.inputBox, { borderColor: focused ? theme.primary : theme.border, backgroundColor: theme.background }]}>
      <Icon color={focused ? theme.primary : theme.textSecondary} size={20} />
      <TextInput
        ref={ref}
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text }]}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: Layout.screenPadding, gap: Spacing.four },
  brand: { alignItems: 'center', gap: Spacing.one },
  logo: { width: 112, height: 112, borderRadius: 56, marginBottom: Spacing.two },
  card: { borderRadius: Radii.card, padding: Spacing.four, gap: Spacing.three },
  field: { gap: Spacing.one },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: Spacing.three },
  errorBox: { borderRadius: Spacing.three, padding: Spacing.three },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Radii.buttonPrimary,
    marginTop: Spacing.one,
  },
  disabled: { opacity: 0.5 },
  onPrimary: { color: '#FFFFFF' },
});
