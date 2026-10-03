import { useFocusEffect } from 'expo-router';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useThemePreference } from '@/hooks/use-app-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useSyncSession } from '@/hooks/use-sync-session';
import { formatRelativeTime } from '@/lib/format';
import { getLastSyncAt, resetCursor } from '@/lib/sync/cursor';
import { runSync, syncEngineStore } from '@/lib/sync/engine';
import { pendingStore } from '@/lib/sync/pending';
import { dismissRejection, listRejections, retryRejection } from '@/lib/sync/push-engine';
import { sessionStore } from '@/lib/sync/session';
import type { ThemePreference } from '@/lib/theme-preference';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'system', label: 'Sistema' },
];

const ROLE_LABEL = { owner: 'Dueño', seller: 'Vendedor' } as const;

type Rejection = { id: number; type: string; error: string; createdAt: string };

// The manual button + rejected-operations list (sub-paso 11), plus the
// pending count and last-sync time (sub-paso 12) — hooks/use-auto-sync.ts
// is what actually triggers automatic syncs; this section just shows where
// things stand and still lets the user force one by hand.
function SyncSection() {
  const running = useSyncExternalStore(syncEngineStore.subscribe, syncEngineStore.isRunning);
  const pending = useSyncExternalStore(pendingStore.subscribe, pendingStore.getSnapshot);
  const [message, setMessage] = useState<string | null>(null);
  const [rejections, setRejections] = useState<Rejection[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const reload = useCallback(() => {
    listRejections().then(setRejections);
    setLastSyncAt(getLastSyncAt());
  }, []);

  useFocusEffect(reload);

  async function handleSync() {
    setMessage(null);
    const result = await runSync();
    if (result.status === 'skipped-no-session') {
      setMessage('Inicia sesión para sincronizar.');
    } else if (result.status === 'error') {
      setMessage(`No se pudo completar (${result.stage === 'push' ? 'al enviar' : 'al recibir'}): ${result.error}`);
    } else {
      setMessage(`Listo — ${result.pushed} enviadas, ${result.rejected} rechazadas, ${result.pulledPages} página(s) recibidas.`);
    }
    reload();
  }

  async function handleDismiss(id: number) {
    await dismissRejection(id);
    reload();
  }

  // Un rechazo de antes de un fix de código no se reenvía solo — su opId
  // original ya quedó consumido. Esto lo reencola bajo uno nuevo (con el
  // único arreglo conocido, el bug de formato de fecha) y sincroniza de una.
  async function handleRetry(id: number) {
    await retryRejection(id);
    await handleSync();
  }

  // Herramienta de rescate (bug real encontrado en vivo, sesión 2026-10-03):
  // un dispositivo que ya había sincronizado antes (aunque fuera parcial)
  // conserva su cursor aunque se borren los datos locales — esto fuerza un
  // pull completo desde cero sin tocar nada local (upsert por uuid, no
  // destructivo), para cuando algo que debería haber llegado no llegó.
  function handleForceResync() {
    Alert.alert(
      'Resincronización completa',
      'Vuelve a descargar todos los datos del servidor desde cero. No borra nada de este celular — solo puede tardar más de lo normal.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Resincronizar',
          onPress: async () => {
            resetCursor();
            await handleSync();
          },
        },
      ],
    );
  }

  return (
    <>
      <ThemedText type="small">Sincronización</ThemedText>
      <ThemedText themeColor="textSecondary" type="small" style={styles.syncStatus}>
        {pending > 0 ? `${pending} pendiente(s)` : 'Sin pendientes'}
        {lastSyncAt ? ` · última sincronización: ${formatRelativeTime(lastSyncAt)}` : ' · todavía no ha sincronizado'}
      </ThemedText>
      <Pressable onPress={handleSync} disabled={running} style={styles.syncButton}>
        <ThemedView type="backgroundSelected" style={styles.optionButton}>
          {running ? <ActivityIndicator /> : <ThemedText type="linkPrimary">Sincronizar ahora</ThemedText>}
        </ThemedView>
      </Pressable>
      <Pressable onPress={handleForceResync} disabled={running} style={styles.syncButton}>
        <ThemedView type="backgroundElement" style={styles.optionButton}>
          <ThemedText>Forzar resincronización completa</ThemedText>
        </ThemedView>
      </Pressable>
      {message && <ThemedText style={styles.syncMessage}>{message}</ThemedText>}

      {rejections.length > 0 && (
        <ThemedView type="backgroundElement" style={styles.rejectionsCard}>
          <ThemedText type="small" themeColor="textSecondary">
            El servidor rechazó {rejections.length} operación(es):
          </ThemedText>
          {rejections.map((r) => (
            <ThemedView key={r.id} style={styles.rejectionRow}>
              <ThemedView style={styles.rejectionText}>
                <ThemedText type="small">{r.type}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{r.error}</ThemedText>
              </ThemedView>
              <Pressable onPress={() => handleRetry(r.id)}>
                <ThemedText type="small" themeColor="textSecondary">Reintentar</ThemedText>
              </Pressable>
              <Pressable onPress={() => handleDismiss(r.id)}>
                <ThemedText type="small" themeColor="textSecondary">Descartar</ThemedText>
              </Pressable>
            </ThemedView>
          ))}
        </ThemedView>
      )}
    </>
  );
}

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
        <ScrollView contentContainerStyle={styles.scrollContent}>
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

              <SyncSection />
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
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { padding: Spacing.four, gap: Spacing.two },
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
  syncStatus: {
    marginBottom: Spacing.one,
  },
  syncButton: {
    marginBottom: Spacing.two,
  },
  syncMessage: {
    marginBottom: Spacing.two,
  },
  rejectionsCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    marginBottom: Spacing.four,
    gap: Spacing.two,
  },
  rejectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rejectionText: {
    flex: 1,
    gap: Spacing.half,
  },
});
