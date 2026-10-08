import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { sellersRepo } from '@/lib/data';
import { sellerSchema, type SellerInventoryMode } from '@/lib/validations';

export default function NewSellerScreen() {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [commissionType, setCommissionType] = useState<'percentage' | 'fixed_per_unit'>('percentage');
  const [inventoryMode, setInventoryMode] = useState<SellerInventoryMode>('consignment');
  const [commissionValue, setCommissionValue] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    const parsed = sellerSchema.safeParse({
      name,
      phone: phone || undefined,
      city: city || undefined,
      commissionType,
      commissionValue: Number(commissionValue),
      inventoryMode,
      notes: notes || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await sellersRepo.create(parsed.data);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el vendedor');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="small">Nombre</ThemedText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ej. Juan Pérez"
            placeholderTextColor={theme.textSecondary}
            style={inputStyle}
          />

          <ThemedText type="small">Teléfono (opcional)</ThemedText>
          <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={inputStyle} />

          <ThemedText type="small">Ciudad (opcional)</ThemedText>
          <TextInput value={city} onChangeText={setCity} style={inputStyle} />

          <ThemedText type="small">Tipo de vendedor</ThemedText>
          <ThemedView style={styles.typeRow}>
            <Pressable style={styles.typeFlex} onPress={() => setInventoryMode('consignment')}>
              <ThemedView type={inventoryMode === 'consignment' ? 'backgroundSelected' : 'backgroundElement'} style={styles.typeButton}>
                <ThemedText type={inventoryMode === 'consignment' ? 'linkPrimary' : undefined}>Consignación</ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable style={styles.typeFlex} onPress={() => setInventoryMode('store')}>
              <ThemedView type={inventoryMode === 'store' ? 'backgroundSelected' : 'backgroundElement'} style={styles.typeButton}>
                <ThemedText type={inventoryMode === 'store' ? 'linkPrimary' : undefined}>Tienda principal</ThemedText>
              </ThemedView>
            </Pressable>
          </ThemedView>
          <ThemedText type="small" themeColor="textSecondary">
            {inventoryMode === 'store'
              ? 'Vende del inventario principal y el dinero entra a caja al momento. No recibe entregas ni se liquida.'
              : 'Vende solo la mercancía que se le entrega y entrega el dinero al liquidar.'}
          </ThemedText>

          <ThemedText type="small">Tipo de comisión</ThemedText>
          <ThemedView style={styles.typeRow}>
            <Pressable style={styles.typeFlex} onPress={() => setCommissionType('percentage')}>
              <ThemedView type={commissionType === 'percentage' ? 'backgroundSelected' : 'backgroundElement'} style={styles.typeButton}>
                <ThemedText type={commissionType === 'percentage' ? 'linkPrimary' : undefined}>% por venta</ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable style={styles.typeFlex} onPress={() => setCommissionType('fixed_per_unit')}>
              <ThemedView type={commissionType === 'fixed_per_unit' ? 'backgroundSelected' : 'backgroundElement'} style={styles.typeButton}>
                <ThemedText type={commissionType === 'fixed_per_unit' ? 'linkPrimary' : undefined}>Fija por unidad</ThemedText>
              </ThemedView>
            </Pressable>
          </ThemedView>

          <ThemedText type="small">
            {commissionType === 'percentage' ? 'Comisión en puntos base (ej. 1000 = 10%)' : 'Comisión fija por unidad vendida, en pesos'}
          </ThemedText>
          <TextInput value={commissionValue} onChangeText={setCommissionValue} keyboardType="numeric" style={inputStyle} />

          <ThemedText type="small">Notas (opcional)</ThemedText>
          <TextInput value={notes} onChangeText={setNotes} style={inputStyle} multiline />

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <Pressable onPress={handleSubmit} disabled={saving}>
            <ThemedView type="backgroundSelected" style={styles.submitButton}>
              <ThemedText type="linkPrimary">{saving ? 'Guardando…' : 'Guardar vendedor'}</ThemedText>
            </ThemedView>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { padding: Spacing.four, gap: Spacing.two },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  typeRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.two },
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
