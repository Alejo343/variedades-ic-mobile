import { Link, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
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
import { formatCOP } from '@/lib/format';

const STATUS_LABELS: Record<PurchaseOrder['status'], string> = {
  pendiente: 'pendiente',
  en_viaje: 'en camino',
  recibido: 'recibido',
  cancelado: 'cancelado',
};

export default function PurchaseOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);

  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [distributor, setDistributor] = useState<Distributor | null>(null);
  const [productById, setProductById] = useState<Record<number, Product>>({});
  const [balance, setBalance] = useState<PurchaseOrderBalance | null>(null);
  const [payments, setPayments] = useState<PurchasePayment[]>([]);
  const [accountNames, setAccountNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
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

  async function handleMarkInTransit() {
    setSaving(true);
    try {
      const updated = await purchaseOrdersRepo.markInTransit(orderId);
      setOrder(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar el pedido');
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkReceived() {
    setSaving(true);
    try {
      const updated = await purchaseOrdersRepo.markReceived(orderId);
      setOrder(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo recibir el pedido');
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    setSaving(true);
    try {
      const updated = await purchaseOrdersRepo.cancel(orderId);
      setOrder(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cancelar el pedido');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !order) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText themeColor="textSecondary">{loading ? 'Cargando…' : 'Pedido no encontrado'}</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="small">Distribuidor</ThemedText>
          <ThemedText type="default" style={styles.value}>
            {distributor?.name ?? 'Sin distribuidor'}
          </ThemedText>

          <ThemedText type="small">Estado</ThemedText>
          <ThemedText type="default" style={styles.value}>
            {STATUS_LABELS[order.status]} · {order.purchaseType === 'credito' ? 'crédito' : 'contado'}
          </ThemedText>

          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Productos
          </ThemedText>
          {order.items.map((item) => (
            <ThemedView key={item.id} type="backgroundElement" style={styles.itemRow}>
              <ThemedText type="small">{productById[item.productId]?.name ?? `Producto #${item.productId}`}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.quantity} × {formatCOP(item.unitCost)} = {formatCOP(item.quantity * item.unitCost)}
              </ThemedText>
            </ThemedView>
          ))}

          <ThemedView type="backgroundElement" style={styles.totalBlock}>
            <ThemedText>Costo total</ThemedText>
            <ThemedText type="linkPrimary" style={styles.totalAmount}>
              {formatCOP(order.totalCost)}
            </ThemedText>
          </ThemedView>

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <ThemedView style={styles.actionsRow}>
            {order.status === 'pendiente' ? (
              <Pressable style={styles.actionFlex} onPress={handleMarkInTransit} disabled={saving}>
                <ThemedView type="backgroundSelected" style={styles.submitButton}>
                  <ThemedText type="linkPrimary">Marcar en camino</ThemedText>
                </ThemedView>
              </Pressable>
            ) : null}
            {order.status === 'en_viaje' ? (
              <Pressable style={styles.actionFlex} onPress={handleMarkReceived} disabled={saving}>
                <ThemedView type="backgroundSelected" style={styles.submitButton}>
                  <ThemedText type="linkPrimary">Marcar recibido</ThemedText>
                </ThemedView>
              </Pressable>
            ) : null}
            {order.status === 'pendiente' || order.status === 'en_viaje' ? (
              <Pressable style={styles.actionFlex} onPress={handleCancel} disabled={saving}>
                <ThemedView type="backgroundElement" style={styles.submitButton}>
                  <ThemedText>Cancelar</ThemedText>
                </ThemedView>
              </Pressable>
            ) : null}
          </ThemedView>

          {order.purchaseType === 'credito' && balance ? (
            <>
              <ThemedText type="smallBold" style={styles.sectionTitle}>
                Cuenta por pagar
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.totalBlock}>
                <ThemedView>
                  <ThemedText type="small" themeColor="textSecondary">
                    Pagado: {formatCOP(balance.totalPaid)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Pendiente
                  </ThemedText>
                </ThemedView>
                <ThemedText type="linkPrimary" style={styles.totalAmount}>
                  {formatCOP(balance.pending)}
                </ThemedText>
              </ThemedView>

              {payments.map((payment) => (
                <ThemedView key={payment.id} type="backgroundElement" style={styles.itemRow}>
                  <ThemedText type="small">{formatCOP(payment.amount)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {accountNames[payment.accountId] ?? `Cuenta #${payment.accountId}`} · {payment.paidAt}
                  </ThemedText>
                </ThemedView>
              ))}

              {balance.pending > 0 && order.status !== 'cancelado' ? (
                <Link href={`/more/purchases/payments/new?orderId=${orderId}`} asChild>
                  <Pressable>
                    <ThemedView type="backgroundSelected" style={styles.submitButton}>
                      <ThemedText type="linkPrimary">Registrar pago</ThemedText>
                    </ThemedView>
                  </Pressable>
                </Link>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { padding: Spacing.four, gap: Spacing.two },
  value: { marginBottom: Spacing.two },
  sectionTitle: { marginTop: Spacing.three, marginBottom: Spacing.one },
  itemRow: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.one,
  },
  totalBlock: {
    marginTop: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalAmount: { fontSize: 20 },
  error: { color: '#d9534f' },
  actionsRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  actionFlex: { flex: 1 },
  submitButton: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
