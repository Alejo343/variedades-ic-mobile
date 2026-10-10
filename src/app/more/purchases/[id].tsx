import { Link, useLocalSearchParams } from 'expo-router';
import { Check, CircleX, Plus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductThumb } from '@/components/pos';
import { PurchaseStatusChip } from '@/components/purchase-status';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useTheme } from '@/hooks/use-theme';
import {
  cashAccountsRepo,
  distributorsRepo,
  productsRepo,
  purchaseOrdersRepo,
  purchasePaymentsRepo,
  type Distributor,
  type Product,
  type PurchaseOrder,
  type PurchaseOrderBalance,
  type PurchasePayment,
} from '@/lib/data';
import { formatCOP, formatDateTime } from '@/lib/format';

const STEPS: { status: PurchaseOrder['status']; label: string }[] = [
  { status: 'pendiente', label: 'Pedido' },
  { status: 'en_viaje', label: 'En camino' },
  { status: 'recibido', label: 'Recibido' },
];

export default function PurchaseOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [distributor, setDistributor] = useState<Distributor | null>(null);
  const [productById, setProductById] = useState<Record<number, Product>>({});
  const [balance, setBalance] = useState<PurchaseOrderBalance | null>(null);
  const [payments, setPayments] = useState<PurchasePayment[]>([]);
  const [accountNames, setAccountNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([purchaseOrdersRepo.getById(orderId), productsRepo.list(), cashAccountsRepo.list()]).then(([found, products, accounts]) => {
        if (cancelled) return;
        setOrder(found);
        setProductById(Object.fromEntries(products.map((p) => [p.id, p])));
        setAccountNames(Object.fromEntries(accounts.map((a) => [a.id, a.name])));
        if (found?.distributorId) {
          distributorsRepo.getById(found.distributorId).then((d) => {
            if (!cancelled) setDistributor(d);
          });
        } else {
          setDistributor(null);
        }
        if (found?.purchaseType === 'credito') {
          Promise.all([purchasePaymentsRepo.getBalance(orderId), purchasePaymentsRepo.listForOrder(orderId)]).then(([b, p]) => {
            if (!cancelled) {
              setBalance(b);
              setPayments(p);
            }
          });
        } else {
          setBalance(null);
          setPayments([]);
        }
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [orderId]),
  );

  async function run(action: () => Promise<PurchaseOrder>, failure: string) {
    setSaving(true);
    setError(null);
    try {
      setOrder(await action());
    } catch (e) {
      setError(e instanceof Error ? e.message : failure);
    } finally {
      setSaving(false);
    }
  }

  function confirmCancel() {
    Alert.alert('Cancelar pedido', 'El pedido queda cancelado y no se puede recibir ni pagar después.', [
      { text: 'Volver', style: 'cancel' },
      { text: 'Cancelar pedido', style: 'destructive', onPress: () => run(() => purchaseOrdersRepo.cancel(orderId), 'No se pudo cancelar el pedido') },
    ]);
  }

  if (loading || !order) {
    return (
      <ThemedView style={[styles.container, styles.padded]}>
        <ThemedText themeColor="textSecondary">{loading ? 'Cargando…' : 'Pedido no encontrado'}</ThemedText>
      </ThemedView>
    );
  }

  const units = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const open = order.status === 'pendiente' || order.status === 'en_viaje';
  const stepIndex = STEPS.findIndex((s) => s.status === order.status);
  const paidRatio = balance && balance.totalCost > 0 ? Math.min(1, balance.totalPaid / balance.totalCost) : 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={[]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
            <View style={styles.heroHeader}>
              <ThemedText type="secondary" themeColor="textSecondary" style={styles.flex} numberOfLines={1}>
                {distributor?.name ?? 'Sin distribuidor'}
              </ThemedText>
              <PurchaseStatusChip status={order.status} />
            </View>
            <ThemedText type="bigNumber" adjustsFontSizeToFit numberOfLines={1}>
              {formatCOP(order.totalCost)}
            </ThemedText>
            <ThemedText type="secondary" themeColor="textSecondary">
              {units} {units === 1 ? 'unidad' : 'unidades'} · {order.purchaseType === 'credito' ? 'a crédito' : 'de contado'} ·{' '}
              {formatDateTime(order.orderDate)}
            </ThemedText>

            {order.status === 'cancelado' ? (
              <View style={[styles.cancelled, { backgroundColor: withAlpha(theme.textSecondary, 0.1) }]}>
                <CircleX color={theme.textSecondary} size={16} />
                <ThemedText type="small" themeColor="textSecondary">
                  Pedido cancelado
                </ThemedText>
              </View>
            ) : (
              <View style={styles.steps}>
                {STEPS.map((step, i) => {
                  const done = i <= stepIndex;
                  const color = done ? theme.primary : theme.border;
                  return (
                    <View key={step.status} style={styles.step}>
                      <View style={styles.stepLine}>
                        <View style={[styles.connector, { backgroundColor: i === 0 ? 'transparent' : i <= stepIndex ? theme.primary : theme.border }]} />
                        <View style={[styles.stepDot, { backgroundColor: done ? theme.primary : theme.backgroundElement, borderColor: color }]}>
                          {done ? <Check color="#FFFFFF" size={12} /> : null}
                        </View>
                        <View
                          style={[
                            styles.connector,
                            { backgroundColor: i === STEPS.length - 1 ? 'transparent' : i < stepIndex ? theme.primary : theme.border },
                          ]}
                        />
                      </View>
                      <ThemedText type="caption" style={{ color: done ? theme.text : theme.textSecondary }}>
                        {step.label}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            )}
          </ThemedView>

          <View style={styles.section}>
            <ThemedText type="sectionTitle">Productos</ThemedText>
            <ThemedView type="backgroundElement" style={[styles.listCard, Shadow.subtle]}>
              {order.items.map((item, i) => {
                const product = productById[item.productId];
                return (
                  <View key={item.id} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                    <ProductThumb uri={product?.primaryImageUri ?? null} style={styles.thumb} iconSize={16} />
                    <View style={styles.flex}>
                      <ThemedText type="small" numberOfLines={1}>
                        {product?.name ?? `Producto #${item.productId}`}
                      </ThemedText>
                      <ThemedText type="caption" themeColor="textSecondary">
                        {item.quantity} × {formatCOP(item.unitCost)}
                      </ThemedText>
                    </View>
                    <ThemedText type="smallBold">{formatCOP(item.quantity * item.unitCost)}</ThemedText>
                  </View>
                );
              })}
            </ThemedView>
          </View>

          {order.purchaseType === 'credito' && balance ? (
            <View style={styles.section}>
              <ThemedText type="sectionTitle">Pago</ThemedText>
              <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
                <View style={styles.spaceBetween}>
                  <ThemedText type="secondary" themeColor="textSecondary">
                    {balance.pending > 0 ? 'Falta por pagar' : 'Pagado completo'}
                  </ThemedText>
                  <ThemedText type="cardTitle" style={{ color: balance.pending > 0 ? theme.error : theme.primary }}>
                    {formatCOP(balance.pending)}
                  </ThemedText>
                </View>
                <View style={[styles.track, { backgroundColor: withAlpha(theme.textSecondary, 0.12) }]}>
                  {paidRatio > 0 ? <View style={[styles.fill, { width: `${paidRatio * 100}%`, backgroundColor: theme.primary }]} /> : null}
                </View>
                <ThemedText type="caption" themeColor="textSecondary">
                  Pagado {formatCOP(balance.totalPaid)} de {formatCOP(balance.totalCost)}
                </ThemedText>
                {payments.map((payment) => (
                  <View key={payment.id} style={[styles.paymentRow, { borderTopColor: theme.border }]}>
                    <View style={styles.flex}>
                      <ThemedText type="small">{accountNames[payment.accountId] ?? `Cuenta #${payment.accountId}`}</ThemedText>
                      <ThemedText type="caption" themeColor="textSecondary">
                        {formatDateTime(payment.paidAt)}
                      </ThemedText>
                    </View>
                    <ThemedText type="smallBold">{formatCOP(payment.amount)}</ThemedText>
                  </View>
                ))}
                {balance.pending > 0 && order.status !== 'cancelado' ? (
                  <Link href={`/more/purchases/payments/new?orderId=${orderId}`} asChild>
                    <Pressable>
                      <View style={[styles.outlineButton, { borderColor: theme.primary }]}>
                        <Plus color={theme.primary} size={16} />
                        <ThemedText type="smallBold" style={{ color: theme.primary }}>
                          Registrar pago
                        </ThemedText>
                      </View>
                    </Pressable>
                  </Link>
                ) : null}
              </ThemedView>
            </View>
          ) : null}

          {order.notes ? (
            <View style={styles.section}>
              <ThemedText type="sectionTitle">Notas</ThemedText>
              <ThemedText type="secondary" themeColor="textSecondary">
                {order.notes}
              </ThemedText>
            </View>
          ) : null}

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: withAlpha(theme.error, 0.08) }]}>
              <ThemedText type="small" style={{ color: theme.error }}>
                {error}
              </ThemedText>
            </View>
          ) : null}
        </ScrollView>

        {open ? (
          <ThemedView
            type="backgroundElement"
            style={[styles.bottomBar, { borderTopColor: theme.border, paddingBottom: Spacing.three + insets.bottom }]}>
            <Pressable
              disabled={saving}
              onPress={() =>
                order.status === 'pendiente'
                  ? run(() => purchaseOrdersRepo.markInTransit(orderId), 'No se pudo actualizar el pedido')
                  : run(() => purchaseOrdersRepo.markReceived(orderId), 'No se pudo recibir el pedido')
              }>
              <View style={[styles.primaryButton, { backgroundColor: order.status === 'pendiente' ? theme.info : theme.primary }, saving && styles.disabled]}>
                <ThemedText type="cardTitle" style={styles.onPrimary}>
                  {saving ? 'Guardando…' : order.status === 'pendiente' ? 'Marcar en camino' : 'Marcar recibido'}
                </ThemedText>
              </View>
            </Pressable>
            {order.status === 'en_viaje' ? (
              <ThemedText type="caption" themeColor="textSecondary" style={styles.center}>
                Al recibirlo se suman {units} {units === 1 ? 'unidad' : 'unidades'} al stock.
              </ThemedText>
            ) : null}
            <Pressable onPress={confirmCancel} disabled={saving} style={styles.textButton}>
              <ThemedText type="small" style={{ color: theme.error }}>
                Cancelar pedido
              </ThemedText>
            </Pressable>
          </ThemedView>
        ) : null}
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
  card: { borderRadius: Radii.card, padding: Spacing.four, gap: Spacing.two },
  heroHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  cancelled: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: Spacing.two, padding: Spacing.two, marginTop: Spacing.one },
  steps: { flexDirection: 'row', marginTop: Spacing.two },
  step: { flex: 1, alignItems: 'center', gap: Spacing.one },
  stepLine: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  connector: { flex: 1, height: 2 },
  stepDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  section: { gap: Spacing.two },
  listCard: { borderRadius: Radii.card, paddingHorizontal: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  thumb: { width: 40, height: 40, borderRadius: Spacing.two },
  spaceBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.two, borderTopWidth: 1 },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderWidth: 1.5,
    borderRadius: Radii.button,
    paddingVertical: Spacing.three,
    marginTop: Spacing.one,
  },
  errorBox: { borderRadius: Spacing.three, padding: Spacing.three },
  bottomBar: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.three, borderTopWidth: 1, gap: Spacing.one },
  primaryButton: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Radii.buttonPrimary },
  onPrimary: { color: '#FFFFFF' },
  textButton: { alignItems: 'center', paddingVertical: Spacing.two },
  disabled: { opacity: 0.5 },
});
