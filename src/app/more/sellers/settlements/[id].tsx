import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useMySeller } from '@/hooks/use-my-seller';
import { cashAccountsRepo, sellersRepo, settlementsRepo, type CashAccount, type Seller, type Settlement } from '@/lib/data';
import { formatCOP } from '@/lib/format';

export default function SettlementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const settlementId = Number(id);
  // Only the owner settles: a seller just sees what they owe.
  const { isSeller } = useMySeller();

  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
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
    try {
      await settlementsRepo.resyncSettled(settlementId);
      setError('Reenviada — ve a Configuración y toca "Sincronizar ahora".');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo reenviar');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settlement) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText themeColor="textSecondary">{loading ? 'Cargando…' : 'Liquidación no encontrada'}</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ThemedText type="small">Vendedor</ThemedText>
        <ThemedText type="default" style={styles.value}>
          {seller?.name ?? `Vendedor #${settlement.sellerId}`}
        </ThemedText>

        <ThemedText type="small">Período</ThemedText>
        <ThemedText type="default" style={styles.value}>
          {settlement.periodDate}
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.totalsBlock}>
          <ThemedView style={styles.totalsRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Ventas
            </ThemedText>
            <ThemedText type="small">{formatCOP(settlement.totalSales)}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.totalsRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Comisión
            </ThemedText>
            <ThemedText type="small">-{formatCOP(settlement.totalCommission)}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.totalsRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Pérdidas
            </ThemedText>
            <ThemedText type="small">+{formatCOP(settlement.totalLosses)}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.totalsRow}>
            <ThemedText type="smallBold">A entregar</ThemedText>
            <ThemedText type="linkPrimary">{formatCOP(settlement.amountDue)}</ThemedText>
          </ThemedView>
        </ThemedView>

        <ThemedText type="small" style={styles.status}>
          Estado: {settlement.status === 'liquidada' ? `liquidada (${settlement.settledAt ?? ''})` : 'pendiente'}
        </ThemedText>

        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

        {settlement.status === 'pendiente' && !isSeller ? (
          <>
            <ThemedText type="small" style={styles.status}>
              Cuenta que recibe el pago
            </ThemedText>
            <ThemedView style={styles.typeRow}>
              {accounts.map((account) => (
                <Pressable key={account.id} style={styles.typeFlex} onPress={() => setAccountId(account.id)}>
                  <ThemedView type={accountId === account.id ? 'backgroundSelected' : 'backgroundElement'} style={styles.typeButton}>
                    <ThemedText type={accountId === account.id ? 'linkPrimary' : undefined}>{account.name}</ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
            </ThemedView>

            <Pressable onPress={handleMarkSettled} disabled={saving || accountId === null}>
              <ThemedView type="backgroundSelected" style={styles.submitButton}>
                <ThemedText type="linkPrimary">{saving ? 'Liquidando…' : 'Marcar como liquidada'}</ThemedText>
              </ThemedView>
            </Pressable>
          </>
        ) : null}

        {settlement.status === 'liquidada' && !isSeller ? (
          <Pressable onPress={handleResync} disabled={saving}>
            <ThemedView type="backgroundElement" style={styles.submitButton}>
              <ThemedText themeColor="textSecondary">
                {saving ? 'Reenviando…' : '¿No se refleja en la web? Reenviar sincronización'}
              </ThemedText>
            </ThemedView>
          </Pressable>
        ) : null}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.two },
  value: { marginBottom: Spacing.two },
  totalsBlock: {
    marginTop: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  status: { marginTop: Spacing.two },
  typeRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one, marginBottom: Spacing.two },
  typeFlex: { flex: 1 },
  typeButton: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  error: { color: '#d9534f' },
  submitButton: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
