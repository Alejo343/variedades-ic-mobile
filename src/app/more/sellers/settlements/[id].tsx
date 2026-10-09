import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useMySeller } from '@/hooks/use-my-seller';
import { useTheme } from '@/hooks/use-theme';
import { cashAccountsRepo, sellersRepo, settlementsRepo, type CashAccount, type Seller, type Settlement } from '@/lib/data';
import { formatCOP, formatDateTime } from '@/lib/format';

export default function SettlementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const settlementId = Number(id);
  const theme = useTheme();
  // Only the owner settles: a seller just sees what they owe.
  const { isSeller } = useMySeller();

  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([settlementsRepo.getById(settlementId), cashAccountsRepo.list()]).then(([found, accountRows]) => {
        if (cancelled) return;
        setSettlement(found);
        const active = accountRows.filter((a) => a.active);
        setAccounts(active);
        setAccountId((current) => current ?? active[0]?.id ?? null);
        if (found) {
          sellersRepo.getById(found.sellerId).then((s) => {
            if (!cancelled) setSeller(s);
          });
        }
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [settlementId]),
  );

  async function handleMarkSettled() {
    if (accountId === null) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await settlementsRepo.markSettled(settlementId, accountId);
      setSettlement(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo liquidar');
    } finally {
      setSaving(false);
    }
  }

  // Recuperación (bug real, sesión 2026-10-03): si el primer intento de
  // marcar como liquidada se rechazó por algo ya corregido (ej. el formato
  // de fecha) y el rechazo ya se descartó, no queda nada en la cola para
  // reintentar — el estado local ya pasó a "liquidada" de todas formas. Esto
  // reconstruye y reencola la misma operación desde los datos que ya existen.
  async function handleResync() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await settlementsRepo.resyncSettled(settlementId);
      setNotice('Reenviada — ve a Configuración y toca "Sincronizar ahora".');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo reenviar');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settlement) {
    return (
      <ThemedView style={[styles.container, styles.padded]}>
        <ThemedText themeColor="textSecondary">{loading ? 'Cargando…' : 'Liquidación no encontrada'}</ThemedText>
      </ThemedView>
    );
  }

  const settled = settlement.status === 'liquidada';
  const statusColor = settled ? theme.primary : theme.warning;

  return (
    <ThemedView style={styles.container}>
      {isSeller ? <Stack.Screen options={{ title: 'Mi liquidación' }} /> : null}
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
            <View style={styles.heroHeader}>
              <ThemedText type="secondary" themeColor="textSecondary" style={styles.flex}>
                {isSeller ? 'Lo que entregas' : `A entregar · ${seller?.name ?? `Vendedor #${settlement.sellerId}`}`}
              </ThemedText>
              <View style={[styles.chip, { backgroundColor: withAlpha(statusColor, 0.12) }]}>
                <ThemedText type="caption" style={{ color: statusColor }}>
                  {settled ? 'Liquidada' : 'Pendiente'}
                </ThemedText>
              </View>
            </View>
            <ThemedText type="bigNumber" style={{ color: theme.primary }} adjustsFontSizeToFit numberOfLines={1}>
              {formatCOP(settlement.amountDue)}
            </ThemedText>
            <ThemedText type="secondary" themeColor="textSecondary">
              Ventas hasta el {settlement.periodDate}
              {settled && settlement.settledAt ? ` · cerrada el ${formatDateTime(settlement.settledAt)}` : ''}
            </ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
            <Line label="Ventas" value={formatCOP(settlement.totalSales)} />
            <Line label={isSeller ? 'Tu comisión' : 'Comisión del vendedor'} value={`−${formatCOP(settlement.totalCommission)}`} color={theme.primary} />
            <Line label="Pérdidas a cargo" value={`+${formatCOP(settlement.totalLosses)}`} color={settlement.totalLosses > 0 ? theme.error : undefined} />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <View style={styles.line}>
              <ThemedText type="cardTitle">A entregar</ThemedText>
              <ThemedText type="cardTitle">{formatCOP(settlement.amountDue)}</ThemedText>
            </View>
          </ThemedView>

          {isSeller ? (
            <ThemedText type="caption" themeColor="textSecondary">
              Se calcula como tus ventas menos tu comisión, más el costo de la mercancía perdida o dañada.
            </ThemedText>
          ) : null}

          {error ? <ThemedText style={{ color: theme.error }}>{error}</ThemedText> : null}
          {notice ? <ThemedText themeColor="textSecondary">{notice}</ThemedText> : null}

          {!settled && !isSeller ? (
            <ThemedView type="backgroundElement" style={[styles.card, styles.actionCard, Shadow.subtle]}>
              <ThemedText type="smallBold">Cuenta que recibe el pago</ThemedText>
              <View style={styles.accountRow}>
                {accounts.map((account) => {
                  const selected = accountId === account.id;
                  return (
                    <Pressable key={account.id} style={styles.flex} onPress={() => setAccountId(account.id)}>
                      <ThemedView type={selected ? 'backgroundSelected' : 'background'} style={styles.accountButton}>
                        <ThemedText type={selected ? 'linkPrimary' : undefined}>{account.name}</ThemedText>
                      </ThemedView>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable onPress={handleMarkSettled} disabled={saving || accountId === null}>
                <View style={[styles.primaryButton, { backgroundColor: theme.primary }, (saving || accountId === null) && styles.disabled]}>
                  <ThemedText type="cardTitle" style={styles.primaryLabel}>
                    {saving ? 'Liquidando…' : 'Marcar como liquidada'}
                  </ThemedText>
                </View>
              </Pressable>
            </ThemedView>
          ) : null}

          {settled && !isSeller ? (
            <Pressable onPress={handleResync} disabled={saving} style={styles.resync}>
              <ThemedText type="small" themeColor="textSecondary">
                {saving ? 'Reenviando…' : '¿No se refleja en la web? Reenviar sincronización'}
              </ThemedText>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Line({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.line}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small" style={color ? { color } : undefined}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  padded: { padding: Layout.screenPadding },
  safeArea: { flex: 1 },
  scrollContent: { padding: Layout.screenPadding, gap: Layout.cardGap, paddingBottom: Spacing.six },
  flex: { flex: 1 },
  card: { borderRadius: Radii.card, padding: Spacing.four, gap: Spacing.one },
  heroHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  chip: { borderRadius: Radii.chip, paddingHorizontal: Spacing.two, paddingVertical: 2 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.one },
  divider: { height: 1, marginVertical: Spacing.two },
  actionCard: { gap: Spacing.three },
  accountRow: { flexDirection: 'row', gap: Spacing.two },
  accountButton: { padding: Spacing.three, borderRadius: Radii.button, alignItems: 'center' },
  primaryButton: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Radii.buttonPrimary },
  primaryLabel: { color: '#FFFFFF' },
  disabled: { opacity: 0.5 },
  resync: { alignItems: 'center', paddingVertical: Spacing.two },
});
