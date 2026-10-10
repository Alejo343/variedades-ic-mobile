import { Link, router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Plus, Power, ReceiptText } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormField, FormInput, FormRow, FormSection } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useTheme } from '@/hooks/use-theme';
import { distributorsRepo, purchaseOrdersRepo, purchasePaymentsRepo } from '@/lib/data';
import { formatCOP } from '@/lib/format';
import { distributorSchema } from '@/lib/validations';

type FormValues = { name: string; city: string; phone: string; notes: string };

// A distributor: what's bought from them and owed, shortcuts to their orders
// and a new one, and the edit form.
export default function EditDistributorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const distributorId = Number(id);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [values, setValues] = useState<FormValues | null>(null);
  const [saved, setSaved] = useState<FormValues | null>(null);
  const [active, setActive] = useState(true);
  const [stats, setStats] = useState({ orders: 0, bought: 0, owed: 0 });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit form: plain useFocusEffect on purpose, not useDataFocusEffect — a
  // background sync must not overwrite what the user is typing.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      distributorsRepo.getById(distributorId).then((d) => {
        if (cancelled || !d) return;
        const loaded = { name: d.name, city: d.city ?? '', phone: d.phone ?? '', notes: d.notes ?? '' };
        setValues(loaded);
        setSaved(loaded);
        setActive(d.active);
      });
      return () => {
        cancelled = true;
      };
    }, [distributorId]),
  );

  // Read-only numbers: these do follow background syncs.
  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([purchaseOrdersRepo.list(), purchasePaymentsRepo.getAccountsPayableSummary()]).then(([orders, payable]) => {
        if (cancelled) return;
        const own = orders.filter((o) => o.distributorId === distributorId && o.status !== 'cancelado');
        setStats({
          orders: own.length,
          bought: own.filter((o) => o.status === 'recibido').reduce((sum, o) => sum + o.totalCost, 0),
          owed: payable.find((p) => p.distributorId === distributorId)?.pending ?? 0,
        });
      });
      return () => {
        cancelled = true;
      };
    }, [distributorId]),
  );

  if (!values) {
    return (
      <ThemedView style={[styles.container, styles.padded]}>
        <ThemedText themeColor="textSecondary">Cargando…</ThemedText>
      </ThemedView>
    );
  }

  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  const canSave = dirty && values.name.trim().length > 0 && !saving;
  const set = (key: keyof FormValues, value: string) => setValues({ ...values, [key]: value });

  async function handleSubmit() {
    if (!values) return;
    const parsed = distributorSchema.safeParse({
      name: values.name.trim(),
      city: values.city.trim() || undefined,
      phone: values.phone.trim() || undefined,
      notes: values.notes.trim() || undefined,
      active,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await distributorsRepo.update(distributorId, parsed.data);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el distribuidor');
    } finally {
      setSaving(false);
    }
  }

  async function handleSetActive(next: boolean) {
    setSaving(true);
    setError(null);
    try {
      if (next) await distributorsRepo.update(distributorId, { active: true });
      else await distributorsRepo.deactivate(distributorId);
      setActive(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el estado');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: saved?.name || 'Distribuidor' }} />
      <SafeAreaView style={styles.flex} edges={[]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.tiles}>
              <ThemedView type="backgroundElement" style={[styles.tile, Shadow.subtle]}>
                <ThemedText type="caption" themeColor="textSecondary">
                  Por pagar
                </ThemedText>
                <ThemedText type="cardTitle" style={stats.owed > 0 ? { color: theme.error } : undefined} adjustsFontSizeToFit numberOfLines={1}>
                  {formatCOP(stats.owed)}
                </ThemedText>
              </ThemedView>
              <ThemedView type="backgroundElement" style={[styles.tile, Shadow.subtle]}>
                <ThemedText type="caption" themeColor="textSecondary">
                  Comprado (recibido)
                </ThemedText>
                <ThemedText type="cardTitle" adjustsFontSizeToFit numberOfLines={1}>
                  {formatCOP(stats.bought)}
                </ThemedText>
              </ThemedView>
            </View>

            <View style={styles.buttons}>
              <Link href={`/more/purchases?distributorId=${distributorId}`} asChild>
                <Pressable style={styles.flex}>
                  <View style={[styles.outlineButton, { borderColor: theme.border }]}>
                    <ReceiptText color={theme.text} size={16} />
                    <ThemedText type="small">
                      {stats.orders} {stats.orders === 1 ? 'pedido' : 'pedidos'}
                    </ThemedText>
                  </View>
                </Pressable>
              </Link>
              {active ? (
                <Link href={`/more/purchases/new?distributorId=${distributorId}`} asChild>
                  <Pressable style={styles.flex}>
                    <View style={[styles.outlineButton, { borderColor: theme.primary, backgroundColor: theme.primaryLight }]}>
                      <Plus color={theme.primary} size={16} />
                      <ThemedText type="smallBold" style={{ color: theme.primary }}>
                        Nuevo pedido
                      </ThemedText>
                    </View>
                  </Pressable>
                </Link>
              ) : null}
            </View>

            <FormSection title="Datos">
              <FormField label="Nombre">
                <FormInput value={values.name} onChangeText={(v) => set('name', v)} />
              </FormField>
              <FormRow>
                <FormField label="Teléfono (opcional)" style={styles.flex}>
                  <FormInput value={values.phone} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" />
                </FormField>
                <FormField label="Ciudad (opcional)" style={styles.flex}>
                  <FormInput value={values.city} onChangeText={(v) => set('city', v)} />
                </FormField>
              </FormRow>
              <FormField label="Notas (opcional)">
                <FormInput value={values.notes} onChangeText={(v) => set('notes', v)} multiline />
              </FormField>
            </FormSection>

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
                  {active ? 'Desactivar distribuidor' : 'Reactivar distribuidor'}
                </ThemedText>
              </View>
            </Pressable>
            <ThemedText type="caption" themeColor="textSecondary" style={styles.center}>
              {active ? 'Un distribuidor desactivado no aparece al crear pedidos. Sus pedidos se conservan.' : 'Está desactivado: no aparece al crear pedidos.'}
            </ThemedText>
          </ScrollView>

          <ThemedView
            type="backgroundElement"
            style={[styles.bottomBar, { borderTopColor: theme.border, paddingBottom: Spacing.three + insets.bottom }]}>
            <Pressable onPress={handleSubmit} disabled={!canSave}>
              <View style={[styles.primaryButton, { backgroundColor: theme.primary }, !canSave && styles.disabled]}>
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
  tiles: { flexDirection: 'row', gap: Layout.cardGap },
  tile: { flex: 1, borderRadius: Radii.card, padding: Spacing.three, gap: Spacing.half },
  buttons: { flexDirection: 'row', gap: Spacing.two },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderWidth: 1.5,
    borderRadius: Radii.button,
    paddingVertical: Spacing.three,
  },
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
