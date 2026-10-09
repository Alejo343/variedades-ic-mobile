import { CircleAlert, LogOut, Moon, RefreshCw, Smartphone, Sun, type LucideProps } from 'lucide-react-native';
import { useCallback, useState, type ComponentType, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SyncStatusPill, useSyncStatus } from '@/components/sync-status';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useThemePreference } from '@/hooks/use-app-color-scheme';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useSyncSession } from '@/hooks/use-sync-session';
import { useTheme } from '@/hooks/use-theme';
import { resetCursor } from '@/lib/sync/cursor';
import { runSync } from '@/lib/sync/engine';
import { dismissRejection, listRejections, retryRejection } from '@/lib/sync/push-engine';
import type { SyncOperationType } from '@/lib/sync/operation-types';
import { sessionStore } from '@/lib/sync/session';
import type { ThemePreference } from '@/lib/theme-preference';

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: ComponentType<LucideProps> }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Smartphone },
];

const ROLE_LABEL = { owner: 'Dueño', seller: 'Vendedor' } as const;

// What a rejected operation was, in words the person recognizes — the raw
// type names are the sync protocol's, not theirs.
const OPERATION_LABEL: Record<SyncOperationType, string> = {
  upsertCategory: 'Guardar categoría',
  upsertProduct: 'Guardar producto',
  upsertSeller: 'Guardar vendedor',
  upsertDistributor: 'Guardar distribuidor',
  upsertCashAccount: 'Guardar cuenta',
  createInventoryAdjustment: 'Ajuste de inventario',
  createCashMovement: 'Movimiento de caja',
  createDirectSale: 'Venta en la tienda',
  createSellerDelivery: 'Entrega a vendedor',
  createSellerSale: 'Venta de vendedor',
  createSellerReturn: 'Devolución',
  createSellerLoss: 'Pérdida',
  createPurchaseOrder: 'Pedido de compra',
  transitionPurchaseOrder: 'Cambio de estado de un pedido',
  createPurchasePayment: 'Pago a distribuidor',
  createSettlement: 'Liquidación',
  markSettlementSettled: 'Cerrar liquidación',
  createCommissionPayment: 'Pago de comisiones',
};

type Rejection = { id: number; type: string; error: string; createdAt: string };

// Sync card: where things stand, the manual button, operations the server
// rejected (sub-paso 11) and the full-resync rescue tool. hooks/use-auto-sync.ts
// is what actually triggers automatic syncs.
function SyncSection() {
  const theme = useTheme();
  const status = useSyncStatus();
  const [message, setMessage] = useState<string | null>(null);
  const [rejections, setRejections] = useState<Rejection[]>([]);

  const reload = useCallback(() => {
    listRejections().then(setRejections);
  }, []);

  useDataFocusEffect(reload);

  async function handleSync() {
    setMessage(null);
    const result = await runSync();
    if (result.status === 'skipped-no-session') {
      setMessage('Inicia sesión para sincronizar.');
    } else if (result.status === 'error') {
      setMessage(`No se pudo completar (${result.stage === 'push' ? 'al enviar' : 'al recibir'}): ${result.error}`);
    } else {
      setMessage(
        result.rejected > 0
          ? `Listo, pero el servidor rechazó ${result.rejected} ${result.rejected === 1 ? 'cambio' : 'cambios'}.`
          : 'Todo sincronizado.',
      );
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
    <Section title="Sincronización">
      <Card>
        <SyncStatusPill />
        <ThemedText type="secondary" themeColor="textSecondary">
          La app sincroniza sola cuando hay internet. Usa el botón si quieres asegurarte ahora mismo.
        </ThemedText>

        <Pressable onPress={handleSync} disabled={status.running}>
          <View style={[styles.primaryButton, { backgroundColor: theme.primary }, status.running && styles.disabled]}>
            {status.running ? <ActivityIndicator color="#FFFFFF" /> : <RefreshCw color="#FFFFFF" size={18} />}
            <ThemedText type="cardTitle" style={styles.onPrimary}>
              {status.running ? 'Sincronizando…' : 'Sincronizar ahora'}
            </ThemedText>
          </View>
        </Pressable>
        {message ? <ThemedText type="small">{message}</ThemedText> : null}

        {rejections.length > 0 ? (
          <View style={[styles.rejections, { backgroundColor: withAlpha(theme.error, 0.06), borderColor: withAlpha(theme.error, 0.2) }]}>
            <View style={styles.rejectionsHeader}>
              <CircleAlert color={theme.error} size={16} />
              <ThemedText type="smallBold" style={{ color: theme.error }}>
                El servidor rechazó {rejections.length} {rejections.length === 1 ? 'cambio' : 'cambios'}
              </ThemedText>
            </View>
            {rejections.map((r, i) => (
              <View key={r.id} style={[styles.rejectionRow, i > 0 && { borderTopWidth: 1, borderTopColor: withAlpha(theme.error, 0.15) }]}>
                <ThemedText type="small">{OPERATION_LABEL[r.type as SyncOperationType] ?? r.type}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {r.error}
                </ThemedText>
                <View style={styles.rejectionActions}>
                  <Pressable onPress={() => handleRetry(r.id)} hitSlop={6}>
                    <ThemedText type="smallBold" style={{ color: theme.primary }}>
                      Reintentar
                    </ThemedText>
                  </Pressable>
                  <Pressable onPress={() => handleDismiss(r.id)} hitSlop={6}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Descartar
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <Pressable onPress={handleForceResync} disabled={status.running} style={styles.textButton}>
          <ThemedText type="small" themeColor="textSecondary">
            ¿Falta algo? Forzar resincronización completa
          </ThemedText>
        </Pressable>
      </Card>
    </Section>
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

  const user = session.status === 'authenticated' ? session.session.user : null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {user ? (
            <Card>
              <View style={styles.account}>
                <View style={[styles.avatar, { backgroundColor: theme.primaryLight }]}>
                  <ThemedText type="sectionTitle" style={{ color: theme.primary }}>
                    {user.name.trim().charAt(0).toUpperCase() || '?'}
                  </ThemedText>
                </View>
                <View style={styles.flex}>
                  <ThemedText type="cardTitle">{user.name}</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {user.username} · {ROLE_LABEL[user.role]}
                  </ThemedText>
                </View>
              </View>
            </Card>
          ) : null}

          {user ? <SyncSection /> : null}

          <Section title="Apariencia">
            <Card>
              <View style={styles.segmented}>
                {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
                  const selected = preference === value;
                  return (
                    <Pressable key={value} style={styles.flex} onPress={() => setPreference(value)}>
                      <ThemedView type={selected ? 'backgroundSelected' : 'background'} style={styles.segment}>
                        <Icon color={selected ? theme.primary : theme.textSecondary} size={20} />
                        <ThemedText type={selected ? 'smallBold' : 'small'} style={{ color: selected ? theme.primary : theme.text }}>
                          {label}
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                  );
                })}
              </View>
              <ThemedText type="caption" themeColor="textSecondary">
                &quot;Sistema&quot; sigue el modo claro u oscuro del teléfono.
              </ThemedText>
            </Card>
          </Section>

          {user ? (
            <Pressable onPress={handleLogout}>
              <View style={[styles.logout, { borderColor: withAlpha(theme.error, 0.4) }]}>
                <LogOut color={theme.error} size={18} />
                <ThemedText type="default" style={{ color: theme.error }}>
                  Cerrar sesión
                </ThemedText>
              </View>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="sectionTitle">{title}</ThemedText>
      {children}
    </View>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
      {children}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { padding: Layout.screenPadding, gap: Layout.cardGap, paddingBottom: Spacing.six },
  flex: { flex: 1 },
  section: { gap: Spacing.two },
  card: { borderRadius: Radii.card, padding: Spacing.four, gap: Spacing.three },
  account: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Radii.buttonPrimary,
  },
  onPrimary: { color: '#FFFFFF' },
  disabled: { opacity: 0.6 },
  textButton: { alignItems: 'center', paddingVertical: Spacing.one },
  rejections: { borderWidth: 1, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  rejectionsHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rejectionRow: { gap: Spacing.half, paddingTop: Spacing.two },
  rejectionActions: { flexDirection: 'row', gap: Spacing.four, marginTop: Spacing.one },
  segmented: { flexDirection: 'row', gap: Spacing.two },
  segment: { alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.three, borderRadius: Radii.button },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderRadius: Radii.buttonPrimary,
    paddingVertical: Spacing.three,
  },
});
