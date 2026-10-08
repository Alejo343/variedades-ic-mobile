import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useSyncSession } from '@/hooks/use-sync-session';
import { useTheme } from '@/hooks/use-theme';
import {
  createSellerAccessRequest,
  getSellerAccessRequest,
  updateSellerAccessRequest,
  type SellerAccess,
} from '@/lib/sync/api';

// The seller's app login (username + password), managed by the owner from
// the seller detail — same rules as the web panel's "Acceso a la app" card.
// Online only: a password never lives on a phone, so this talks straight to
// the server instead of going through the outbox.
export function SellerAccessCard({ sellerUuid }: { sellerUuid: string }) {
  const theme = useTheme();
  const session = useSyncSession();
  const token = session.status === 'authenticated' ? session.session.token : null;

  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<SellerAccess>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return () => {};
    let cancelled = false;
    setLoading(true);
    getSellerAccessRequest(token, sellerUuid).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setAccess(result.data);
        setError(null);
      } else {
        setError(result.error);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token, sellerUuid]);

  useFocusEffect(load);

  async function run(action: () => Promise<{ ok: true; data: SellerAccess } | { ok: false; error: string }>, success: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAccess(result.data);
    setPassword('');
    setNotice(success);
  }

  function createAccess() {
    if (!token) return;
    run(() => createSellerAccessRequest(token, sellerUuid, username, password), 'Acceso creado.');
  }

  function changePassword() {
    if (!token) return;
    run(() => updateSellerAccessRequest(token, sellerUuid, { password }), 'Contraseña actualizada.');
  }

  function toggleActive() {
    if (!token || !access) return;
    const next = !access.active;
    const apply = () => run(() => updateSellerAccessRequest(token, sellerUuid, { active: next }), next ? 'Acceso activado.' : 'Acceso desactivado.');
    if (next) {
      apply();
      return;
    }
    Alert.alert('Desactivar acceso', 'El vendedor no podrá entrar ni sincronizar desde ningún celular hasta que lo vuelvas a activar.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desactivar', style: 'destructive', onPress: apply },
    ]);
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="smallBold">Acceso a la app</ThemedText>

      {loading ? (
        <ThemedText type="small" themeColor="textSecondary">
          Cargando…
        </ThemedText>
      ) : access ? (
        <>
          <ThemedView type="backgroundElement" style={styles.row}>
            <ThemedText type="small" themeColor="textSecondary">
              Usuario para iniciar sesión
            </ThemedText>
            <ThemedText type="default">{access.username}</ThemedText>
            <ThemedText type="small" themeColor={access.active ? 'textSecondary' : undefined} style={!access.active && styles.inactive}>
              {access.active ? 'Activo' : 'Desactivado'}
            </ThemedText>
          </ThemedView>

          <ThemedText type="small">Nueva contraseña</ThemedText>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="Mínimo 8 caracteres"
            placeholderTextColor={theme.textSecondary}
            style={inputStyle}
          />
          <Pressable onPress={changePassword} disabled={busy || password.length === 0}>
            <ThemedView type="backgroundSelected" style={[styles.button, (busy || password.length === 0) && styles.disabled]}>
              <ThemedText type="linkPrimary">{busy ? 'Guardando…' : 'Cambiar contraseña'}</ThemedText>
            </ThemedView>
          </Pressable>

          <Pressable onPress={toggleActive} disabled={busy}>
            <ThemedView type="backgroundElement" style={styles.button}>
              <ThemedText>{access.active ? 'Desactivar acceso' : 'Activar acceso'}</ThemedText>
            </ThemedView>
          </Pressable>
        </>
      ) : error ? null : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Este vendedor todavía no puede entrar a la app. Créale un usuario y una contraseña: con eso inicia sesión en su
            celular.
          </ThemedText>
          <ThemedText type="small">Usuario</ThemedText>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="ej. ella"
            placeholderTextColor={theme.textSecondary}
            style={inputStyle}
          />
          <ThemedText type="small">Contraseña</ThemedText>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="Mínimo 8 caracteres"
            placeholderTextColor={theme.textSecondary}
            style={inputStyle}
          />
          <Pressable onPress={createAccess} disabled={busy || !username || !password}>
            <ThemedView type="backgroundSelected" style={[styles.button, (busy || !username || !password) && styles.disabled]}>
              <ThemedText type="linkPrimary">{busy ? 'Creando…' : 'Crear acceso'}</ThemedText>
            </ThemedView>
          </Pressable>
        </>
      )}

      {error ? (
        <>
          <ThemedText style={styles.error}>{error}</ThemedText>
          {!access ? (
            <Pressable onPress={load}>
              <ThemedView type="backgroundElement" style={styles.button}>
                <ThemedText>Reintentar</ThemedText>
              </ThemedView>
            </Pressable>
          ) : null}
        </>
      ) : null}
      {notice ? <ThemedText type="small" themeColor="textSecondary">{notice}</ThemedText> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two, marginTop: Spacing.four },
  row: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.half },
  input: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.three },
  button: { padding: Spacing.three, borderRadius: Spacing.three, alignItems: 'center' },
  disabled: { opacity: 0.5 },
  inactive: { color: '#d9534f' },
  error: { color: '#d9534f' },
});
