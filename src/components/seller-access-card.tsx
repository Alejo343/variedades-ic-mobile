import { useCallback, useState } from 'react';
import { KeyRound } from 'lucide-react-native';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { FormField, FormInput, FormSection } from '@/components/form';
import { Radii, Spacing, withAlpha } from '@/constants/theme';
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

  return (
    <FormSection title="Acceso a la app">
      {loading ? (
        <ThemedText type="small" themeColor="textSecondary">
          Cargando…
        </ThemedText>
      ) : access ? (
        <>
          <View style={styles.userRow}>
            <View style={[styles.iconDot, { backgroundColor: withAlpha(access.active ? theme.primary : theme.error, 0.12) }]}>
              <KeyRound color={access.active ? theme.primary : theme.error} size={18} />
            </View>
            <View style={styles.flex}>
              <ThemedText type="caption" themeColor="textSecondary">
                Usuario para iniciar sesión
              </ThemedText>
              <ThemedText type="default">{access.username}</ThemedText>
            </View>
            <View style={[styles.badge, { backgroundColor: withAlpha(access.active ? theme.primary : theme.error, 0.12) }]}>
              <ThemedText type="caption" style={{ color: access.active ? theme.primary : theme.error }}>
                {access.active ? 'Activo' : 'Desactivado'}
              </ThemedText>
            </View>
          </View>

          <FormField label="Nueva contraseña">
            <FormInput value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder="Mínimo 8 caracteres" />
          </FormField>
          <Pressable onPress={changePassword} disabled={busy || password.length === 0}>
            <View style={[styles.primaryButton, { backgroundColor: theme.primary }, (busy || password.length === 0) && styles.disabled]}>
              <ThemedText type="smallBold" style={styles.onPrimary}>
                {busy ? 'Guardando…' : 'Cambiar contraseña'}
              </ThemedText>
            </View>
          </Pressable>

          <Pressable onPress={toggleActive} disabled={busy}>
            <View style={[styles.outlineButton, { borderColor: withAlpha(access.active ? theme.error : theme.primary, 0.4) }]}>
              <ThemedText type="small" style={{ color: access.active ? theme.error : theme.primary }}>
                {access.active ? 'Desactivar acceso' : 'Activar acceso'}
              </ThemedText>
            </View>
          </Pressable>
        </>
      ) : error ? null : (
        <>
          <ThemedText type="secondary" themeColor="textSecondary">
            Todavía no puede entrar a la app. Créale un usuario y una contraseña: con eso inicia sesión en su celular.
          </ThemedText>
          <FormField label="Usuario">
            <FormInput value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} placeholder="ej. maria" />
          </FormField>
          <FormField label="Contraseña">
            <FormInput value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder="Mínimo 8 caracteres" />
          </FormField>
          <Pressable onPress={createAccess} disabled={busy || !username || !password}>
            <View style={[styles.primaryButton, { backgroundColor: theme.primary }, (busy || !username || !password) && styles.disabled]}>
              <ThemedText type="smallBold" style={styles.onPrimary}>
                {busy ? 'Creando…' : 'Crear acceso'}
              </ThemedText>
            </View>
          </Pressable>
        </>
      )}

      {error ? (
        <>
          <ThemedText type="small" style={{ color: theme.error }}>
            {error}
          </ThemedText>
          {!access ? (
            <Pressable onPress={load}>
              <View style={[styles.outlineButton, { borderColor: theme.border }]}>
                <ThemedText type="small">Reintentar</ThemedText>
              </View>
            </Pressable>
          ) : null}
        </>
      ) : null}
      {notice ? (
        <ThemedText type="small" themeColor="textSecondary">
          {notice}
        </ThemedText>
      ) : null}
      <ThemedText type="caption" themeColor="textSecondary">
        Necesita internet. Para cerrar la sesión de un celular específico, usa el panel web.
      </ThemedText>
    </FormSection>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  iconDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  badge: { borderRadius: Radii.chip, paddingHorizontal: Spacing.two, paddingVertical: 2 },
  primaryButton: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Radii.button },
  outlineButton: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Radii.button, borderWidth: 1.5 },
  onPrimary: { color: '#FFFFFF' },
  disabled: { opacity: 0.5 },
});
