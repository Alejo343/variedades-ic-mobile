import { Store, Truck, type LucideProps } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FormField, FormInput, FormRow, FormSection } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { SellerInventoryMode } from '@/lib/validations';

export type SellerFormValues = {
  name: string;
  phone: string;
  city: string;
  inventoryMode: SellerInventoryMode;
  notes: string;
};

export const EMPTY_SELLER_FORM: SellerFormValues = {
  name: '',
  phone: '',
  city: '',
  inventoryMode: 'consignment',
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

      <ThemedText type="caption" themeColor="textSecondary">
        La comisión no se configura por vendedor: cada producto tiene su porcentaje y vale para todos.
      </ThemedText>

      <FormSection title="Notas">
        <FormInput value={values.notes} onChangeText={(v) => set('notes', v)} placeholder="Opcional" multiline />
      </FormSection>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mode: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1.5, borderRadius: Radii.button, padding: Spacing.three },
  modeIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
