import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateChoice } from '@/components/date-choice';
import { FormSection } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { sellersRepo, settlementsRepo, type Seller, type SettlementPreview } from '@/lib/data';
import { formatCOP, todayLocalDateString } from '@/lib/format';
import { settlementSchema } from '@/lib/validations';

// Creates a settlement for everything the seller has pending up to a date
// (settlements-repo.ts). Marking it as settled — the money into an account —
// happens on its detail screen.
export default function NewSettlementScreen() {
  const { sellerId: sellerIdParam } = useLocalSearchParams<{ sellerId: string }>();
  const sellerId = Number(sellerIdParam);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [seller, setSeller] = useState<Seller | null>(null);
  // Local date, not toISOString(): that one is UTC and after 7 p. m. in
  // Colombia it already reads tomorrow.
  const [periodDate, setPeriodDate] = useState(todayLocalDateString());
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

  const nothingPending = preview !== null && preview.totalSales === 0 && preview.totalLosses === 0;
  const canSave = isValidPeriodDate && preview !== null && !nothingPending && !saving;

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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={[]}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <ThemedText type="cardTitle">{seller?.name ?? 'Vendedor'}</ThemedText>

          <FormSection title="Hasta">
            <DateChoice value={periodDate} onChange={setPeriodDate} />
            <ThemedText type="caption" themeColor="textSecondary">
              Incluye todas sus ventas y pérdidas hasta esta fecha que todavía no se hayan liquidado.
            </ThemedText>
          </FormSection>

          {isValidPeriodDate && preview ? (
            <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
              <ThemedText type="secondary" themeColor="textSecondary">
                A entregar
              </ThemedText>
              <ThemedText type="bigNumber" style={{ color: theme.primary }} adjustsFontSizeToFit numberOfLines={1}>
                {formatCOP(preview.amountDue)}
              </ThemedText>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <Line label="Ventas" value={formatCOP(preview.totalSales)} />
              <Line label="Su comisión" value={`−${formatCOP(preview.totalCommission)}`} color={theme.primary} />
              <Line label="Pérdidas a su cargo" value={`+${formatCOP(preview.totalLosses)}`} color={preview.totalLosses > 0 ? theme.error : undefined} />
            </ThemedView>
          ) : null}

          {nothingPending ? (
            <View style={[styles.note, { backgroundColor: withAlpha(theme.info, 0.08) }]}>
              <ThemedText type="small" style={{ color: theme.info }}>
                No tiene ventas ni pérdidas pendientes hasta esa fecha.
              </ThemedText>
            </View>
          ) : null}

          {error ? (
            <View style={[styles.note, { backgroundColor: withAlpha(theme.error, 0.08) }]}>
              <ThemedText type="small" style={{ color: theme.error }}>
                {error}
              </ThemedText>
            </View>
          ) : null}
        </ScrollView>

        <ThemedView
          type="backgroundElement"
          style={[styles.bottomBar, { borderTopColor: theme.border, paddingBottom: Spacing.three + insets.bottom }]}>
          <Pressable onPress={handleSubmit} disabled={!canSave}>
            <View style={[styles.primaryButton, { backgroundColor: theme.primary }, !canSave && styles.disabled]}>
              <ThemedText type="cardTitle" style={styles.onPrimary}>
                {saving ? 'Creando…' : 'Crear liquidación'}
              </ThemedText>
            </View>
          </Pressable>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.center}>
            Después la marcas como liquidada cuando recibas el dinero.
          </ThemedText>
        </ThemedView>
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
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  scrollContent: { padding: Layout.screenPadding, gap: Layout.cardGap, paddingBottom: Spacing.five },
  card: { borderRadius: Radii.card, padding: Spacing.four, gap: Spacing.one },
  divider: { height: 1, marginVertical: Spacing.two },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  note: { borderRadius: Spacing.three, padding: Spacing.three },
  bottomBar: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.three, borderTopWidth: 1, gap: Spacing.two },
  primaryButton: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Radii.buttonPrimary },
  onPrimary: { color: '#FFFFFF' },
  disabled: { opacity: 0.5 },
});
