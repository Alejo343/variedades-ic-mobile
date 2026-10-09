import { CloudCheck, CloudUpload, RefreshCw } from 'lucide-react-native';
import { useCallback, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, withAlpha } from '@/constants/theme';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useTheme } from '@/hooks/use-theme';
import { formatRelativeTime } from '@/lib/format';
import { getLastSyncAt } from '@/lib/sync/cursor';
import { syncEngineStore } from '@/lib/sync/engine';
import { pendingStore, refreshPendingCount } from '@/lib/sync/pending';

// Where this phone stands against the server: syncing now, N operations
// waiting to go up, or up to date as of some time ago. Matters most to a
// seller working offline, who needs to know their sales actually left the
// phone.
export function useSyncStatus() {
  const running = useSyncExternalStore(syncEngineStore.subscribe, syncEngineStore.isRunning);
  const pending = useSyncExternalStore(pendingStore.subscribe, pendingStore.getSnapshot);
  // getLastSyncAt() is a cheap synchronous read but not reactive — reading it
  // on every render is enough: a run ending flips `running`, and the focus
  // refresh below updates `pending`, both of which re-render.
  const lastSyncAt = getLastSyncAt();

  useDataFocusEffect(
    useCallback(() => {
      refreshPendingCount();
    }, []),
  );

  return { running, pending, lastSyncAt };
}

export function syncStatusLabel({ running, pending, lastSyncAt }: ReturnType<typeof useSyncStatus>): string {
  if (running) return 'Sincronizando…';
  if (pending > 0) return `${pending} ${pending === 1 ? 'cambio' : 'cambios'} por enviar`;
  if (lastSyncAt) return `Al día · ${formatRelativeTime(lastSyncAt).toLowerCase()}`;
  return 'Todavía no ha sincronizado';
}

export function SyncStatusPill() {
  const theme = useTheme();
  const status = useSyncStatus();
  const color = status.running ? theme.info : status.pending > 0 ? theme.warning : theme.primary;
  const Icon = status.running ? RefreshCw : status.pending > 0 ? CloudUpload : CloudCheck;

  return (
    <View style={[styles.pill, { backgroundColor: withAlpha(color, 0.12) }]}>
      <Icon color={color} size={14} />
      <ThemedText type="caption" style={{ color }}>
        {syncStatusLabel(status)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    borderRadius: Radii.chip,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
});
