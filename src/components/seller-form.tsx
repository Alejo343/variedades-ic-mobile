import { HandCoins, Percent, Store, Truck, type LucideProps } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FormChip, FormField, FormInput, FormRow, FormSection } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { SalaryPeriod, SellerPayType } from '@/lib/domain/salary';
import { formatCOP } from '@/lib/format';
import type { SellerInventoryMode } from '@/lib/validations';

export type SellerFormValues = {
  name: string;
  phone: string;
  city: string;
  inventoryMode: SellerInventoryMode;
  payType: SellerPayType;
  // Digits only, as typed.
  salaryAmount: string;
  salaryPeriod: SalaryPeriod;
  notes: string;
};

export const EMPTY_SELLER_FORM: SellerFormValues = {
  name: '',
  phone: '',
  city: '',
  inventoryMode: 'consignment',
  payType: 'commission',
  salaryAmount: '',
  salaryPeriod: 'weekly',
  notes: '',
};

// The pay fields the repo receives: a salary only for a store seller
// (lib/domain/salary.ts), so switching to consignment drops it.
export function sellerPayInput(values: SellerFormValues) {
  const salaried = values.inventoryMode === 'store' && values.payType === 'salary';
  return {
    payType: salaried ? ('salary' as const) : ('commission' as const),
    salaryAmount: salaried ? Number(values.salaryAmount) || null : null,
    salaryPeriod: salaried ? values.salaryPeriod : null,
  };
}

type Option<T> = { value: T; title: string; text: string; icon: ComponentType<LucideProps> };

const MODES: Option<SellerInventoryMode>[] = [
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

const PAY_TYPES: Option<SellerPayType>[] = [
  {
    value: 'commission',
    title: 'Comisión por venta',
    text: 'Gana el porcentaje de cada producto que vende.',
    icon: Percent,
  },
  {
    value: 'salary',
    title: 'Sueldo fijo',
    text: 'Cobra lo mismo cada semana o cada mes; sus ventas no generan comisión.',
    icon: HandCoins,
  },
];

// Fields shared by "Nuevo vendedor" and "Editar vendedor". The screens own the
// values, the save button and the repo call.
export function SellerForm({ values, onChange }: { values: SellerFormValues; onChange: (v: SellerFormValues) => void }) {
  const set = <K extends keyof SellerFormValues>(key: K, value: SellerFormValues[K]) => onChange({ ...values, [key]: value });
  const isStore = values.inventoryMode === 'store';
  const salaried = isStore && values.payType === 'salary';
  const amount = Number(values.salaryAmount) || 0;

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
        {MODES.map((option) => (
          <OptionCard key={option.value} option={option} selected={values.inventoryMode === option.value} onPress={() => set('inventoryMode', option.value)} />
        ))}
      </FormSection>

      {isStore ? (
        <FormSection title="Cómo se le paga">
          {PAY_TYPES.map((option) => (
            <OptionCard key={option.value} option={option} selected={values.payType === option.value} onPress={() => set('payType', option.value)} />
          ))}
          {salaried ? (
            <>
              <FormField label="Sueldo" hint={amount > 0 ? formatCOP(amount) : undefined}>
                <FormInput
                  value={values.salaryAmount}
                  onChangeText={(v) => set('salaryAmount', v.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  prefix="$"
                  placeholder="0"
                />
              </FormField>
              <View style={styles.chips}>
                <FormChip label="Cada semana" selected={values.salaryPeriod === 'weekly'} onPress={() => set('salaryPeriod', 'weekly')} />
                <FormChip label="Cada mes" selected={values.salaryPeriod === 'monthly'} onPress={() => set('salaryPeriod', 'monthly')} />
              </View>
              <ThemedText type="caption" themeColor="textSecondary">
                {values.salaryPeriod === 'weekly'
                  ? 'Las semanas van de lunes a domingo.'
                  : 'Cada mes va del día 1 al último día.'}{' '}
                El primer período es el de la fecha en que guardas este cambio.
              </ThemedText>
            </>
          ) : null}
        </FormSection>
      ) : null}

      {!salaried ? (
        <ThemedText type="caption" themeColor="textSecondary">
          La comisión no se configura por vendedor: cada producto tiene su porcentaje y vale para todos.
        </ThemedText>
      ) : null}

      <FormSection title="Notas">
        <FormInput value={values.notes} onChangeText={(v) => set('notes', v)} placeholder="Opcional" multiline />
      </FormSection>
    </>
  );
}

function OptionCard<T>({ option, selected, onPress }: { option: Option<T>; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  const { title, text, icon: Icon } = option;
  return (
    <Pressable onPress={onPress}>
      <View
        style={[
          styles.mode,
          selected ? { backgroundColor: theme.primaryLight, borderColor: theme.primary } : { backgroundColor: theme.background, borderColor: theme.border },
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
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  mode: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1.5, borderRadius: Radii.button, padding: Spacing.three },
  modeIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
