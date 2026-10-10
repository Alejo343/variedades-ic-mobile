import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Banknote, Landmark, Minus, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormChip, FormField, FormInput, FormSection } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { cashAccountsRepo, cashRepo, type CashAccount } from '@/lib/data';
import { formatCOP } from '@/lib/format';
import { cashMovementSchema } from '@/lib/validations';

type MovementType = 'ingreso' | 'gasto';

// One-tap concepts for the usual manual movements; anything else is typed.
const QUICK_CONCEPTS: Record<MovementType, string[]> = {
  gasto: ['Arriendo', 'Servicios', 'Transporte', 'Nómina', 'Insumos'],
  ingreso: ['Aporte de capital', 'Préstamo', 'Otro ingreso'],
};

export default function NewCashMovementScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Opened from Caja's "Ingreso" / "Gasto" buttons with the type chosen.
  const params = useLocalSearchParams<{ type?: string }>();
  const [type, setType] = useState<MovementType>(params.type === 'ingreso' ? 'ingreso' : 'gasto');
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('');
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    cashAccountsRepo.list().then((rows) => {
      const active = rows.filter((a) => a.active);
      setAccounts(active);
      setAccountId((current) => current ?? active[0]?.id ?? null);
    });
  }, []);

  async function handleSubmit() {
    const parsed = cashMovementSchema.safeParse({
      type,
      amount: Number(amount),
      concept,
      accountId,
      notes: notes || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await cashRepo.recordMovement(parsed.data);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el movimiento');
    } finally {
      setSaving(false);
    }
  }

  const color = type === 'ingreso' ? theme.primary : theme.error;
  const amountValue = Number(amount) || 0;
  const canSave = amountValue > 0 && concept.trim().length > 0 && accountId !== null && !saving;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: type === 'ingreso' ? 'Registrar ingreso' : 'Registrar gasto' }} />
      <SafeAreaView style={styles.flex} edges={[]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.segmented}>
              <TypeButton label="Ingreso" icon={Plus} selected={type === 'ingreso'} color={theme.primary} onPress={() => setType('ingreso')} />
              <TypeButton label="Gasto" icon={Minus} selected={type === 'gasto'} color={theme.error} onPress={() => setType('gasto')} />
            </View>

            <ThemedView type="backgroundElement" style={[styles.amountCard, Shadow.subtle]}>
              <ThemedText type="secondary" themeColor="textSecondary">
                {type === 'ingreso' ? '¿Cuánto entró?' : '¿Cuánto salió?'}
              </ThemedText>
              <View style={styles.amountRow}>
                <ThemedText type="bigNumber" style={{ color }}>
                  $
                </ThemedText>
                <TextInput
                  value={amount}
                  onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={withAlpha(color, 0.35)}
                  autoFocus
                  style={[styles.amountInput, { color }]}
                />
              </View>
              {amountValue > 0 ? (
                <ThemedText type="caption" themeColor="textSecondary">
                  {formatCOP(amountValue)}
                </ThemedText>
              ) : null}
            </ThemedView>

            <FormSection title="Concepto">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
                {QUICK_CONCEPTS[type].map((c) => (
                  <FormChip key={c} label={c} selected={concept === c} onPress={() => setConcept(c)} />
                ))}
              </ScrollView>
              <FormInput value={concept} onChangeText={setConcept} placeholder="O escribe el concepto" />
            </FormSection>

            <FormSection title={type === 'ingreso' ? 'Entra a' : 'Sale de'}>
              <View style={styles.accountRow}>
                {accounts.map((account) => {
                  const selected = accountId === account.id;
                  const Icon = account.type === 'banco' ? Landmark : Banknote;
                  return (
                    <Pressable key={account.id} style={styles.accountFlex} onPress={() => setAccountId(account.id)}>
                      <View
                        style={[
                          styles.accountButton,
                          selected
                            ? { backgroundColor: theme.primaryLight, borderColor: theme.primary }
                            : { backgroundColor: theme.background, borderColor: theme.border },
                        ]}>
                        <Icon color={selected ? theme.primary : theme.textSecondary} size={18} />
                        <ThemedText type={selected ? 'smallBold' : 'small'} style={{ color: selected ? theme.primary : theme.text }}>
                          {account.name}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              {accounts.length === 0 ? (
                <ThemedText type="caption" themeColor="textSecondary">
                  No hay cuentas activas. Crea una en Caja → Gestionar cuentas.
                </ThemedText>
              ) : null}
            </FormSection>

            <FormSection title="Notas">
              <FormField label="Opcional">
                <FormInput value={notes} onChangeText={setNotes} multiline />
              </FormField>
            </FormSection>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: withAlpha(theme.error, 0.08) }]}>
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
              <View style={[styles.primaryButton, { backgroundColor: color }, !canSave && styles.disabled]}>
                <ThemedText type="cardTitle" style={styles.onPrimary}>
                  {saving
                    ? 'Guardando…'
                    : `Registrar ${type === 'ingreso' ? 'ingreso' : 'gasto'}${amountValue > 0 ? ` de ${formatCOP(amountValue)}` : ''}`}
                </ThemedText>
              </View>
            </Pressable>
          </ThemedView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function TypeButton({
  label,
  icon: Icon,
  selected,
  color,
  onPress,
}: {
  label: string;
  icon: typeof Plus;
  selected: boolean;
  color: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable style={styles.flex} onPress={onPress}>
      <View
        style={[
          styles.typeButton,
          selected ? { backgroundColor: withAlpha(color, 0.12), borderColor: color } : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}>
        <Icon color={selected ? color : theme.textSecondary} size={18} />
        <ThemedText type={selected ? 'smallBold' : 'small'} style={{ color: selected ? color : theme.text }}>
          {label}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { padding: Layout.screenPadding, gap: Layout.cardGap, paddingBottom: Spacing.five },
  segmented: { flexDirection: 'row', gap: Spacing.two },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderRadius: Radii.button,
    paddingVertical: Spacing.three,
  },
  amountCard: { borderRadius: Radii.card, padding: Spacing.four, gap: Spacing.one },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  amountInput: { flex: 1, fontSize: 42, fontFamily: Fonts.inter.bold, paddingVertical: 0 },
  chips: { gap: Spacing.two },
  accountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  accountFlex: { flexGrow: 1, flexBasis: '45%' },
  accountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderRadius: Radii.button,
    paddingVertical: Spacing.three,
  },
  errorBox: { borderRadius: Spacing.three, padding: Spacing.three },
  bottomBar: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.three, borderTopWidth: 1 },
  primaryButton: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Radii.buttonPrimary },
  onPrimary: { color: '#FFFFFF' },
  disabled: { opacity: 0.5 },
});
