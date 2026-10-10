import { router } from 'expo-router';
import { ArrowDown, Banknote, Landmark } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormInput, FormSection } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { cashAccountsRepo, cashRepo, type CashAccountWithBalance } from '@/lib/data';
import { formatCOP } from '@/lib/format';
import { cashTransferSchema } from '@/lib/validations';

// Moving money between two accounts: a gasto in one and an ingreso in the
// other (cashRepo.transfer). Each balance changes; the total doesn't, and it
// never counts as business income/expense.
export default function TransferScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [accounts, setAccounts] = useState<CashAccountWithBalance[]>([]);
  const [fromId, setFromId] = useState<number | null>(null);
  const [toId, setToId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    cashAccountsRepo.listWithBalances().then((rows) => {
      const active = rows.filter((a) => a.active);
      setAccounts(active);
      setFromId(active[0]?.id ?? null);
      setToId(active[1]?.id ?? null);
    });
  }, []);

  // Picking as origin the account that was the destination swaps them, so the
  // two can never end up the same.
  function chooseFrom(id: number) {
    if (id === toId) setToId(fromId);
    setFromId(id);
  }
  function chooseTo(id: number) {
    if (id === fromId) setFromId(toId);
    setToId(id);
  }

  const from = accounts.find((a) => a.id === fromId) ?? null;
  const to = accounts.find((a) => a.id === toId) ?? null;
  const value = Number(amount) || 0;
  const canSave = from !== null && to !== null && from.id !== to.id && value > 0 && !saving;

  async function handleSubmit() {
    const parsed = cashTransferSchema.safeParse({ fromAccountId: fromId, toAccountId: toId, amount: value, notes: notes.trim() || undefined });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await cashRepo.transfer(parsed.data);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar la transferencia');
    } finally {
      setSaving(false);
    }
  }

  if (accounts.length < 2 && accounts.length > 0) {
    return (
      <ThemedView style={[styles.container, styles.padded]}>
        <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
          <ThemedText type="cardTitle">Necesitas dos cuentas</ThemedText>
          <ThemedText type="secondary" themeColor="textSecondary">
            Para mover dinero hace falta al menos otra cuenta activa. Créala en Caja → Gestionar cuentas.
          </ThemedText>
        </ThemedView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={[]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
              <ThemedText type="secondary" themeColor="textSecondary">
                ¿Cuánto vas a mover?
              </ThemedText>
              <View style={styles.amountRow}>
                <ThemedText type="bigNumber" style={{ color: theme.info }}>
                  $
                </ThemedText>
                <TextInput
                  value={amount}
                  onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={withAlpha(theme.info, 0.35)}
                  autoFocus
                  style={[styles.amountInput, { color: theme.info }]}
                />
              </View>
              {value > 0 ? (
                <ThemedText type="caption" themeColor="textSecondary">
                  {formatCOP(value)}
                </ThemedText>
              ) : null}
            </ThemedView>

            <FormSection title="Sale de">
              <AccountChoices accounts={accounts} selectedId={fromId} onSelect={chooseFrom} />
            </FormSection>

            <View style={styles.arrow}>
              <View style={[styles.arrowDot, { backgroundColor: withAlpha(theme.info, 0.12) }]}>
                <ArrowDown color={theme.info} size={20} />
              </View>
            </View>

            <FormSection title="Entra a">
              <AccountChoices accounts={accounts} selectedId={toId} onSelect={chooseTo} />
            </FormSection>

            {from && to && value > 0 ? (
              <View style={[styles.preview, { backgroundColor: withAlpha(theme.info, 0.08) }]}>
                <PreviewLine name={from.name} before={from.balance} after={from.balance - value} />
                <PreviewLine name={to.name} before={to.balance} after={to.balance + value} />
                <ThemedText type="caption" themeColor="textSecondary">
                  El saldo total no cambia y no cuenta como ingreso ni gasto.
                </ThemedText>
              </View>
            ) : null}

            <FormSection title="Nota">
              <FormInput value={notes} onChangeText={setNotes} placeholder="Opcional. Ej. Consignación al banco" />
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
              <View style={[styles.primaryButton, { backgroundColor: theme.info }, !canSave && styles.disabled]}>
                <ThemedText type="cardTitle" style={styles.onPrimary}>
                  {saving ? 'Guardando…' : value > 0 ? `Transferir ${formatCOP(value)}` : 'Transferir'}
                </ThemedText>
              </View>
            </Pressable>
          </ThemedView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function AccountChoices({
  accounts,
  selectedId,
  onSelect,
}: {
  accounts: CashAccountWithBalance[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.choices}>
      {accounts.map((account) => {
        const selected = account.id === selectedId;
        const Icon = account.type === 'banco' ? Landmark : Banknote;
        return (
          <Pressable key={account.id} style={styles.choiceFlex} onPress={() => onSelect(account.id)}>
            <View
              style={[
                styles.choice,
                selected
                  ? { backgroundColor: withAlpha(theme.info, 0.1), borderColor: theme.info }
                  : { backgroundColor: theme.background, borderColor: theme.border },
              ]}>
              <Icon color={selected ? theme.info : theme.textSecondary} size={18} />
              <View style={styles.flex}>
                <ThemedText type={selected ? 'smallBold' : 'small'} numberOfLines={1} style={{ color: selected ? theme.info : theme.text }}>
                  {account.name}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {formatCOP(account.balance)}
                </ThemedText>
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function PreviewLine({ name, before, after }: { name: string; before: number; after: number }) {
  const theme = useTheme();
  return (
    <View style={styles.previewLine}>
      <ThemedText type="small" style={styles.flex} numberOfLines={1}>
        {name}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {formatCOP(before)} →{' '}
      </ThemedText>
      <ThemedText type="smallBold" style={after < 0 ? { color: theme.error } : undefined}>
        {formatCOP(after)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  padded: { padding: Layout.screenPadding },
  flex: { flex: 1 },
  scrollContent: { padding: Layout.screenPadding, gap: Layout.cardGap, paddingBottom: Spacing.five },
  card: { borderRadius: Radii.card, padding: Spacing.four, gap: Spacing.one },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  amountInput: { flex: 1, fontSize: 42, fontFamily: Fonts.inter.bold, paddingVertical: 0 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  choiceFlex: { flexGrow: 1, flexBasis: '45%' },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderRadius: Radii.button,
    padding: Spacing.three,
  },
  arrow: { alignItems: 'center', marginVertical: -Spacing.two },
  arrowDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  preview: { borderRadius: Radii.card, padding: Spacing.three, gap: Spacing.two },
  previewLine: { flexDirection: 'row', alignItems: 'center' },
  errorBox: { borderRadius: Spacing.three, padding: Spacing.three },
  bottomBar: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.three, borderTopWidth: 1 },
  primaryButton: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Radii.buttonPrimary },
  onPrimary: { color: '#FFFFFF' },
  disabled: { opacity: 0.5 },
});
