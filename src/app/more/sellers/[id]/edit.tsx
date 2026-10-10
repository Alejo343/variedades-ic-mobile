import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Power } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SellerForm, type SellerFormValues } from '@/components/seller-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { sellersRepo } from '@/lib/data';
import { commissionToInput, parseCommissionInput } from '@/lib/seller-commission';
import { sellerSchema } from '@/lib/validations';

// The owner's edit form for a seller (data, mode, commission) plus
// deactivate/reactivate. The seller's profile is [id]/index.tsx.
export default function EditSellerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sellerId = Number(id);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [values, setValues] = useState<SellerFormValues | null>(null);
  const [saved, setSaved] = useState<SellerFormValues | null>(null);
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Prefills the form: focus only, never on a background sync — that would
  // overwrite what the owner is typing (see use-data-focus-effect.ts).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      sellersRepo.getById(sellerId).then((seller) => {
        if (cancelled || !seller) return;
        const loaded: SellerFormValues = {
          name: seller.name,
          phone: seller.phone ?? '',
          city: seller.city ?? '',
          inventoryMode: seller.inventoryMode,
          commissionType: seller.commissionType,
          commission: commissionToInput(seller.commissionType, seller.commissionValue),
          notes: seller.notes ?? '',
        };
        setValues(loaded);
        setSaved(loaded);
        setActive(seller.active);
      });
      return () => {
        cancelled = true;
      };
    }, [sellerId]),
  );

  if (!values) {
    return (
      <ThemedView style={[styles.container, styles.padded]}>
        <ThemedText themeColor="textSecondary">Cargando…</ThemedText>
      </ThemedView>
    );
  }

  const commissionValue = parseCommissionInput(values.commissionType, values.commission);
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  const canSave = dirty && values.name.trim().length > 0 && commissionValue !== null && !saving;

  async function handleSubmit() {
    if (!values) return;
    const parsed = sellerSchema.safeParse({
      name: values.name.trim(),
      phone: values.phone.trim() || undefined,
      city: values.city.trim() || undefined,
      commissionType: values.commissionType,
      commissionValue,
      inventoryMode: values.inventoryMode,
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
      await sellersRepo.update(sellerId, parsed.data);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el vendedor');
    } finally {
      setSaving(false);
    }
  }

  async function handleSetActive(next: boolean) {
    setSaving(true);
    setError(null);
    try {
      if (next) {
        await sellersRepo.update(sellerId, { active: true });
        setActive(true);
      } else {
        await sellersRepo.deactivate(sellerId);
        setActive(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el estado del vendedor');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={[]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <SellerForm values={values} onChange={setValues} />

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
                  {active ? 'Desactivar vendedor' : 'Reactivar vendedor'}
                </ThemedText>
              </View>
            </Pressable>
            <ThemedText type="caption" themeColor="textSecondary" style={styles.center}>
              {active
                ? 'Un vendedor desactivado no aparece para entregas y no puede sincronizar. Su historial se conserva.'
                : 'Está desactivado: no recibe entregas ni puede sincronizar.'}
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
