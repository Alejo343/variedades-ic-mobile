import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Power } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountTypePicker } from '@/components/account-type-picker';
import { FormField, FormInput, FormSection } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { cashAccountsRepo, cashRepo, type CashMovement } from '@/lib/data';
import { formatCOP, formatDateTime } from '@/lib/format';
import { cashAccountSchema } from '@/lib/validations';

type FormValues = { name: string; type: 'efectivo' | 'banco'; notes: string };

const RECENT_LIMIT = 10;

export default function EditCashAccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accountId = Number(id);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<FormValues | null>(null);
  const [saved, setSaved] = useState<FormValues | null>(null);
  const [active, setActive] = useState(true);
  const [balance, setBalance] = useState(0);
  const [recent, setRecent] = useState<CashMovement[]>([]);
  const [movementCount, setMovementCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit form: plain useFocusEffect on purpose, not useDataFocusEffect — a
  // background sync must not overwrite what the user is typing.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([cashAccountsRepo.getById(accountId), cashAccountsRepo.listWithBalances(), cashRepo.list()]).then(
        ([account, withBalances, movements]) => {
          if (cancelled) return;
          if (account) {
            const loaded: FormValues = { name: account.name, type: account.type, notes: account.notes ?? '' };
            setValues(loaded);
            setSaved(loaded);
            setActive(account.active);
          }
          setBalance(withBalances.find((a) => a.id === accountId)?.balance ?? 0);
          const own = movements
            .filter((m) => m.accountId === accountId)
            .sort((a, b) => (a.movementDate < b.movementDate ? 1 : -1));
          setMovementCount(own.length);
          setRecent(own.slice(0, RECENT_LIMIT));
          setLoading(false);
        },
      );
      return () => {
        cancelled = true;
      };
    }, [accountId]),
  );

  const dirty = values !== null && saved !== null && JSON.stringify(values) !== JSON.stringify(saved);

  async function handleSubmit() {
    if (!values) return;
    const parsed = cashAccountSchema.safeParse({ name: values.name, type: values.type, notes: values.notes || undefined, active });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await cashAccountsRepo.update(accountId, parsed.data);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la cuenta');
    } finally {
      setSaving(false);
    }
  }

  async function handleSetActive(next: boolean) {
    setSaving(true);
    setError(null);
    try {
      if (next) {
        await cashAccountsRepo.update(accountId, { active: true });
        setActive(true);
      } else {
        await cashAccountsRepo.deactivate(accountId);
        router.back();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el estado de la cuenta');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !values) {
    return (
      <ThemedView style={[styles.container, styles.padded]}>
        <ThemedText themeColor="textSecondary">{loading ? 'Cargando…' : 'Cuenta no encontrada'}</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: saved?.name || 'Cuenta' }} />
      <SafeAreaView style={styles.flex} edges={[]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
              <View style={styles.heroHeader}>
                <ThemedText type="secondary" themeColor="textSecondary" style={styles.flex}>
                  Saldo actual
                </ThemedText>
                <View style={[styles.badge, { backgroundColor: withAlpha(active ? theme.primary : theme.error, 0.12) }]}>
                  <ThemedText type="caption" style={{ color: active ? theme.primary : theme.error }}>
                    {active ? 'Activa' : 'Inactiva'}
                  </ThemedText>
                </View>
              </View>
              <ThemedText
                type="bigNumber"
                style={{ color: balance < 0 ? theme.error : theme.text }}
                adjustsFontSizeToFit
                numberOfLines={1}>
                {formatCOP(balance)}
              </ThemedText>
              <ThemedText type="secondary" themeColor="textSecondary">
                {movementCount} {movementCount === 1 ? 'movimiento' : 'movimientos'}
              </ThemedText>
            </ThemedView>

            <FormSection title="Datos">
              <FormField label="Nombre">
                <FormInput value={values.name} onChangeText={(v) => setValues({ ...values, name: v })} />
              </FormField>
              <FormField label="Tipo">
                <AccountTypePicker value={values.type} onChange={(v) => setValues({ ...values, type: v })} />
              </FormField>
              <FormField label="Notas (opcional)">
                <FormInput value={values.notes} onChangeText={(v) => setValues({ ...values, notes: v })} multiline />
              </FormField>
            </FormSection>

            {recent.length > 0 ? (
              <View style={styles.section}>
                <ThemedText type="sectionTitle">Últimos movimientos</ThemedText>
                <ThemedView type="backgroundElement" style={[styles.listCard, Shadow.subtle]}>
                  {recent.map((movement, i) => {
                    const income = movement.type === 'ingreso';
                    return (
                      <View key={movement.id} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                        <View style={styles.flex}>
                          <ThemedText type="small" numberOfLines={1}>
                            {movement.concept}
                          </ThemedText>
                          <ThemedText type="caption" themeColor="textSecondary">
                            {formatDateTime(movement.movementDate)}
                          </ThemedText>
                        </View>
                        <ThemedText type="smallBold" style={{ color: income ? theme.primary : theme.error }}>
                          {income ? '+' : '−'}
                          {formatCOP(movement.amount)}
                        </ThemedText>
                      </View>
                    );
                  })}
                </ThemedView>
              </View>
            ) : null}

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: withAlpha(theme.error, 0.08) }]}>
                <ThemedText type="small" style={{ color: theme.error }}>
                  {error}
                </ThemedText>
              </View>
            ) : null}

            <Pressable onPress={() => handleSetActive(!active)} disabled={saving}>
              <View style={[styles.stateButton, { borderColor: withAlpha(active ? theme.error : theme.primary, 0.4) }]}>
                <Power color={active ? theme.error : theme.primary} size={18} />
                <ThemedText type="default" style={{ color: active ? theme.error : theme.primary }}>
                  {active ? 'Desactivar cuenta' : 'Reactivar cuenta'}
                </ThemedText>
              </View>
            </Pressable>
            <ThemedText type="caption" themeColor="textSecondary" style={styles.center}>
              {active
                ? 'Una cuenta desactivada deja de aparecer al cobrar o registrar movimientos. Su historial y su saldo se conservan.'
                : 'Está desactivada: no aparece al cobrar ni al registrar movimientos.'}
            </ThemedText>
          </ScrollView>

          <ThemedView
            type="backgroundElement"
            style={[styles.bottomBar, { borderTopColor: theme.border, paddingBottom: Spacing.three + insets.bottom }]}>
            <Pressable onPress={handleSubmit} disabled={saving || !dirty}>
              <View style={[styles.primaryButton, { backgroundColor: theme.primary }, (saving || !dirty) && styles.disabled]}>
                <ThemedText type="cardTitle" style={styles.onPrimary}>
                  {saving ? 'Guardando…' : dirty ? 'Guardar cambios' : 'Sin cambios'}
                </ThemedText>
              </View>
            </Pressable>
          </ThemedView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  padded: { padding: Layout.screenPadding },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  scrollContent: { padding: Layout.screenPadding, gap: Layout.cardGap, paddingBottom: Spacing.five },
  card: { borderRadius: Radii.card, padding: Spacing.four, gap: Spacing.one },
  heroHeader: { flexDirection: 'row', alignItems: 'center' },
  badge: { borderRadius: Radii.chip, paddingHorizontal: Spacing.two, paddingVertical: 2 },
  section: { gap: Spacing.two },
  listCard: { borderRadius: Radii.card, paddingHorizontal: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  errorBox: { borderRadius: Spacing.three, padding: Spacing.three },
  stateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderRadius: Radii.buttonPrimary,
    paddingVertical: Spacing.three,
  },
  bottomBar: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.three, borderTopWidth: 1 },
  primaryButton: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Radii.buttonPrimary },
  onPrimary: { color: '#FFFFFF' },
  disabled: { opacity: 0.5 },
});
