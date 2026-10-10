import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PurchaseOrder } from '@/lib/data';

export const PURCHASE_STATUS_LABEL: Record<PurchaseOrder['status'], string> = {
  pendiente: 'Pendiente',
  en_viaje: 'En camino',
  recibido: 'Recibido',
  cancelado: 'Cancelado',
};

export function usePurchaseStatusColor(): Record<PurchaseOrder['status'], string> {
  const theme = useTheme();
  return { pendiente: theme.warning, en_viaje: theme.info, recibido: theme.primary, cancelado: theme.textSecondary };
}

export function PurchaseStatusChip({ status }: { status: PurchaseOrder['status'] }) {
  const color = usePurchaseStatusColor()[status];
  return (
    <View style={[styles.chip, { backgroundColor: withAlpha(color, 0.12) }]}>
      <ThemedText type="caption" style={{ color }}>
        {PURCHASE_STATUS_LABEL[status]}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: Radii.chip, paddingHorizontal: Spacing.two, paddingVertical: 2 },
});
