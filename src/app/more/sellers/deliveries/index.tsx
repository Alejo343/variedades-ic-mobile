import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { PackagePlus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilterNote, RecordList, type RecordRow } from '@/components/record-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Spacing } from '@/constants/theme';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useTheme } from '@/hooks/use-theme';
import { sellerDeliveriesRepo, sellersRepo } from '@/lib/data';
import { formatCOP, formatDateTime } from '@/lib/format';

// Every delivery, or one seller's (`?sellerId=`, from their profile).
export default function SellerDeliveriesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { sellerId } = useLocalSearchParams<{ sellerId?: string }>();
  const onlySellerId = sellerId ? Number(sellerId) : null;
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [sellerName, setSellerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([sellerDeliveriesRepo.list(), sellersRepo.list()]).then(([deliveries, sellers]) => {
        if (cancelled) return;
        const names = Object.fromEntries(sellers.map((s) => [s.id, s.name]));
        setSellerName(onlySellerId !== null ? (names[onlySellerId] ?? null) : null);
        setRows(
          deliveries
            .filter((d) => onlySellerId === null || d.sellerId === onlySellerId)
            .map((d) => {
              const units = d.items.reduce((sum, i) => sum + i.quantity, 0);
              return {
                key: String(d.id),
                title: onlySellerId === null ? (names[d.sellerId] ?? `Vendedor #${d.sellerId}`) : `${units} ${units === 1 ? 'unidad' : 'unidades'}`,
                subtitle:
                  onlySellerId === null
                    ? `${units} ${units === 1 ? 'unidad' : 'unidades'} · ${formatDateTime(d.deliveryDate)}`
                    : formatDateTime(d.deliveryDate),
                value: formatCOP(d.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0)),
                valueCaption: 'a costo',
              };
            }),
        );
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [onlySellerId]),
  );

  return (
    <>
      {sellerName ? <Stack.Screen options={{ title: `Entregas · ${sellerName}` }} /> : null}
      <RecordList
        rows={rows}
        loading={loading}
        icon={PackagePlus}
        tint={theme.info}
        emptyText="Sin entregas todavía."
        header={sellerName ? <FilterNote text={`Solo las entregas a ${sellerName}.`} /> : undefined}
        footer={
          <ThemedView
            type="backgroundElement"
            style={[styles.bottomBar, { borderTopColor: theme.border, paddingBottom: Spacing.three + insets.bottom }]}>
            <Link href={onlySellerId !== null ? `/more/sellers/deliveries/new?sellerId=${onlySellerId}` : '/more/sellers/deliveries/new'} asChild>
              <Pressable>
                <View style={[styles.button, { backgroundColor: theme.info }]}>
                  <PackagePlus color="#FFFFFF" size={18} />
                  <ThemedText type="cardTitle" style={styles.onPrimary}>
                    Nueva entrega
                  </ThemedText>
                </View>
              </Pressable>
            </Link>
          </ThemedView>
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  bottomBar: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.three, borderTopWidth: 1 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Radii.buttonPrimary,
  },
  onPrimary: { color: '#FFFFFF' },
});
