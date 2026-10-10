import { Store, Truck, type LucideProps } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FormChip, FormField, FormInput, FormRow, FormSection } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { describeCommission, parseCommissionInput, type CommissionType } from '@/lib/seller-commission';
import type { SellerInventoryMode } from '@/lib/validations';

export type SellerFormValues = {
  name: string;
  phone: string;
  city: string;
  inventoryMode: SellerInventoryMode;
  commissionType: CommissionType;
  // As typed: a percent ("15", "12,5") or pesos per unit — see seller-commission.ts.
  commission: string;
  notes: string;
};

export const EMPTY_SELLER_FORM: SellerFormValues = {
  name: '',
  phone: '',
  city: '',
  inventoryMode: 'consignment',
  commissionType: 'percentage',
  commission: '',
  notes: '',
};

const MODES: { value: SellerInventoryMode; title: string; text: string; icon: ComponentType<LucideProps> }[] = [
  {
    value: 'consignment',
    title: 'Consignación',
    text: 'Se le entrega mercancía, la vende por su cuenta y entrega el dinero al liquidar.',
    icon: Truck,
  },
  {
    value: 'store',
    title: 'Tienda',
    text: 'Vende en la tienda del inventario principal; el dinero entra a caja al momento.',
    icon: Store,
  },
];

// Fields shared by "Nuevo vendedor" and "Editar vendedor". The screens own the
// values, the save button and the repo call.
export function SellerForm({ values, onChange }: { values: SellerFormValues; onChange: (v: SellerFormValues) => void }) {
  const theme = useTheme();
  const set = <K extends keyof SellerFormValues>(key: K, value: SellerFormValues[K]) => onChange({ ...values, [key]: value });
  const parsed = parseCommissionInput(values.commissionType, values.commission);

  return (
    <>
      <FormSection title="Datos">
        <FormField label="Nombre">
          <FormInput value={values.name} onChangeText={(v) => set('name', v)} placeholder="Ej. María Gómez" />
        </FormField>
        <FormRow>
          <FormField label="Teléfono (opcional)" style={styles.flex}>
            <FormInput value={values.phone} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" />
          </FormField>
          <FormField label="Ciudad (opcional)" style={styles.flex}>
            <FormInput value={values.city} onChangeText={(v) => set('city', v)} />
          </FormField>
        </FormRow>
      </FormSection>

      <FormSection title="Cómo vende">
        {MODES.map(({ value, title, text, icon: Icon }) => {
          const selected = values.inventoryMode === value;
          return (
            <Pressable key={value} onPress={() => set('inventoryMode', value)}>
              <View
                style={[
                  styles.mode,
                  selected
                    ? { backgroundColor: theme.primaryLight, borderColor: theme.primary }
                    : { backgroundColor: theme.background, borderColor: theme.border },
                ]}>
                <View style={[styles.modeIcon, { backgroundColor: withAlpha(selected ? theme.primary : theme.textSecondary, 0.12) }]}>
                  <Icon color={selected ? theme.primary : theme.textSecondary} size={20} />
                </View>
                <View style={styles.flex}>
                  <ThemedText type="smallBold" style={{ color: selected ? theme.primary : theme.text }}>
                    {title}
                  </ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {text}
                  </ThemedText>
                </View>
              </View>
            </Pressable>
          );
        })}
      </FormSection>

      <FormSection title="Comisión">
        <View style={styles.chips}>
          <FormChip
            label="% por venta"
            selected={values.commissionType === 'percentage'}
            onPress={() => onChange({ ...values, commissionType: 'percentage', commission: '' })}
          />
          <FormChip
            label="Fija por unidad"
            selected={values.commissionType === 'fixed_per_unit'}
            onPress={() => onChange({ ...values, commissionType: 'fixed_per_unit', commission: '' })}
          />
        </View>
        <FormField
          label={values.commissionType === 'percentage' ? 'Porcentaje de cada venta' : 'Pesos por cada unidad vendida'}
          hint={
            values.commission.trim() === ''
              ? undefined
              : parsed === null
                ? values.commissionType === 'percentage'
                  ? 'Escribe un porcentaje entre 0 y 100, ej. 15 o 12,5.'
                  : 'Escribe un valor en pesos, ej. 2000.'
                : `Gana ${describeCommission(values.commissionType, parsed)}.`
          }>
          <FormInput
            value={values.commission}
            onChangeText={(v) => set('commission', v)}
            keyboardType={values.commissionType === 'percentage' ? 'decimal-pad' : 'numeric'}
            prefix={values.commissionType === 'fixed_per_unit' ? '$' : undefined}
            placeholder={values.commissionType === 'percentage' ? 'Ej. 15' : 'Ej. 2000'}
          />
        </FormField>
      </FormSection>

      <FormSection title="Notas">
        <FormInput value={values.notes} onChangeText={(v) => set('notes', v)} placeholder="Opcional" multiline />
      </FormSection>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chips: { flexDirection: 'row', gap: Spacing.two },
  mode: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1.5, borderRadius: Radii.button, padding: Spacing.three },
  modeIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
