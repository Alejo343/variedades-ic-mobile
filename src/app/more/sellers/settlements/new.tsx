import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { sellersRepo, settlementsRepo, type Seller, type SettlementPreview } from '@/lib/data';
import { formatCOP } from '@/lib/format';
import { settlementSchema } from '@/lib/validations';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NewSettlementScreen() {
  const { sellerId: sellerIdParam } = useLocalSearchParams<{ sellerId: string }>();
  const sellerId = Number(sellerIdParam);
  const theme = useTheme();

  const [seller, setSeller] = useState<Seller | null>(null);
  const [periodDate, setPeriodDate] = useState(today());
  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    sellersRepo.getById(sellerId).then(setSeller);
  }, [sellerId]);

  const isValidPeriodDate = /^\d{4}-\d{2}-\d{2}$/.test(periodDate);

  useEffect(() => {
    if (!isValidPeriodDate) return;
    let cancelled = false;
    settlementsRepo.preview(sellerId, periodDate).then((result) => {
      if (!cancelled) setPreview(result);
    });
    return () => {
      cancelled = true;
    };
  }, [sellerId, periodDate, isValidPeriodDate]);

  async function handleSubmit() {
    const parsed = settlementSchema.safeParse({ sellerId, periodDate });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await settlementsRepo.create(parsed.data);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la liquidación');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ThemedText type="small">Vendedor</ThemedText>
        <ThemedText type="default" style={styles.sellerName}>
          {seller?.name ?? `Vendedor #${sellerId}`}
        </ThemedText>

        <ThemedText type="small">Fecha del período (YYYY-MM-DD)</ThemedText>
        <TextInput
          value={periodDate}
          onChangeText={setPeriodDate}
          placeholder="2026-07-20"
          placeholderTextColor={theme.textSecondary}
          style={inputStyle}
        />
        <ThemedText type="small" themeColor="textSecondary">
          Incluye todas las ventas y pérdidas del vendedor hasta esta fecha que todavía no se hayan liquidado.
        </ThemedText>

        {isValidPeriodDate && preview ? (
          <ThemedView type="backgroundElement" style={styles.previewBlock}>
            <ThemedView style={styles.previewRow}>
              <ThemedText type="small" themeColor="textSecondary">
                Ventas
              </ThemedText>
              <ThemedText type="small">{formatCOP(preview.totalSales)}</ThemedText>
            </ThemedView>
            <ThemedView style={styles.previewRow}>
              <ThemedText type="small" themeColor="textSecondary">
                Comisión
              </ThemedText>
              <ThemedText type="small">-{formatCOP(preview.totalCommission)}</ThemedText>
            </ThemedView>
            <ThemedView style={styles.previewRow}>
              <ThemedText type="small" themeColor="textSecondary">
                Pérdidas
              </ThemedText>
              <ThemedText type="small">+{formatCOP(preview.totalLosses)}</ThemedText>
            </ThemedView>
            <ThemedView style={styles.previewRow}>
              <ThemedText type="smallBold">A entregar</ThemedText>
              <ThemedText type="linkPrimary">{formatCOP(preview.amountDue)}</ThemedText>
            </ThemedView>
          </ThemedView>
        ) : (
          <ThemedText themeColor="textSecondary" type="small" style={styles.previewBlock}>
            Escribe una fecha válida para ver los totales del período.
          </ThemedText>
        )}

        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

        <Pressable onPress={handleSubmit} disabled={saving || !isValidPeriodDate || !preview}>
          <ThemedView type="backgroundSelected" style={styles.submitButton}>
            <ThemedText type="linkPrimary">{saving ? 'Creando…' : 'Crear liquidación'}</ThemedText>
          </ThemedView>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.two },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  sellerName: { marginBottom: Spacing.two },
  previewBlock: {
    marginTop: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between' },
  error: { color: '#d9534f' },
  submitButton: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
