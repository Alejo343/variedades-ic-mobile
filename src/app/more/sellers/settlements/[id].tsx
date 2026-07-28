import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { sellersRepo, settlementsRepo, type Seller, type Settlement } from '@/lib/data';
import { formatCOP } from '@/lib/format';

export default function SettlementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const settlementId = Number(id);

  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      settlementsRepo.getById(settlementId).then((found) => {
        if (cancelled) return;
        setSettlement(found);
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
    setSaving(true);
    try {
      const updated = await settlementsRepo.markSettled(settlementId);
      setSettlement(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo liquidar');
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
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
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

        {settlement.status === 'pendiente' ? (
          <Pressable onPress={handleMarkSettled} disabled={saving}>
            <ThemedView type="backgroundSelected" style={styles.submitButton}>
              <ThemedText type="linkPrimary">{saving ? 'Liquidando…' : 'Marcar como liquidada'}</ThemedText>
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
  error: { color: '#d9534f' },
  submitButton: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
