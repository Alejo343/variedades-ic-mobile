import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useSyncSession } from '@/hooks/use-sync-session';
import { closeDb, reopenDb, sqliteDb } from '@/lib/data/local/db';

const DB_NAME = 'variedades-ic.db';

function liveDbFile(): File {
  return new File(Paths.join(SQLite.defaultDatabaseDirectory, DB_NAME));
}

export default function BackupScreen() {
  const importBlocked = useSyncSession().status === 'authenticated';
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleExport() {
    setBusy(true);
    setMessage(null);
    try {
      const backupFile = new File(Paths.cache, `variedades-ic-backup-${Date.now()}.db`);
      if (backupFile.exists) backupFile.delete();
      // VACUUM INTO writes a single self-contained snapshot regardless of the
      // live connection's journal mode — safer than copying the raw .db file,
      // which could miss writes still sitting in a -wal file. The uri is
      // percent-encoded (Expo Go's sandboxed cache path includes `@`/`/`
      // encoded as %2540/%252F) and must be decoded — SQLite wants a literal
      // filesystem path, not a URI.
      const rawPath = decodeURIComponent(backupFile.uri.replace(/^file:\/\//, ''));
      await sqliteDb.execAsync(`VACUUM INTO '${rawPath}'`);

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Compartir no está disponible en este dispositivo');
      }
      await Sharing.shareAsync(backupFile.uri);
      setMessage('Respaldo exportado.');
    } catch (e) {
      setMessage(e instanceof Error ? `Error: ${e.message}` : 'No se pudo exportar el respaldo');
    } finally {
      setBusy(false);
    }
  }

  async function performImport() {
    setBusy(true);
    setMessage(null);
    try {
      const picked = await File.pickFileAsync();
      if (picked.canceled) {
        setBusy(false);
        return;
      }

      await closeDb();
      const destination = liveDbFile();
      if (destination.exists) destination.delete();
      picked.result.copy(destination);
      // Opens a fresh connection to the just-replaced file and bumps db.ts's
      // generation counter, which app/_layout.tsx uses to remount and re-run
      // migrations — no need to ask the user to close and reopen the app.
      await reopenDb();

      setMessage('Respaldo importado.');
    } catch (e) {
      setMessage(e instanceof Error ? `Error: ${e.message}` : 'No se pudo importar el respaldo');
    } finally {
      setBusy(false);
    }
  }

  function handleImport() {
    Alert.alert(
      'Importar respaldo',
      'Esto reemplaza todos los datos actuales de la app (productos, inventario) por los del respaldo. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Reemplazar', style: 'destructive', onPress: performImport },
      ],
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ThemedText themeColor="textSecondary" type="small">
          Todos los datos viven solo en este teléfono. Exporta un respaldo de vez en cuando (a
          Drive, correo, etc.) para no perderlo si el teléfono se daña o se pierde.
        </ThemedText>

        <Pressable onPress={handleExport} disabled={busy}>
          <ThemedView type="backgroundSelected" style={styles.button}>
            <ThemedText type="linkPrimary">{busy ? 'Procesando…' : 'Exportar respaldo'}</ThemedText>
          </ThemedView>
        </Pressable>

        {importBlocked ? (
          // Replacing the file under a live session would leave the sync
          // cursor and outbox pointing at data that no longer exists.
          <ThemedText themeColor="textSecondary" type="small">
            Importar un respaldo está desactivado mientras hay una sesión iniciada: los datos se recuperan
            sincronizando con el servidor.
          </ThemedText>
        ) : (
          <Pressable onPress={handleImport} disabled={busy}>
            <ThemedView type="backgroundElement" style={styles.button}>
              <ThemedText>Importar respaldo</ThemedText>
            </ThemedView>
          </Pressable>
        )}

        {message ? <ThemedText style={styles.message}>{message}</ThemedText> : null}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  button: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  message: { marginTop: Spacing.two },
});
