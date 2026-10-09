import { Link, Stack } from 'expo-router';
import { HandCoins, PackageMinus, PackageOpen, ShoppingBag, Undo2, type LucideProps } from 'lucide-react-native';
import { useCallback, useState, type ComponentType } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductThumb } from '@/components/pos';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useTheme } from '@/hooks/use-theme';
import {
  cashAccountsRepo,
  commissionPaymentsRepo,
  productsRepo,
  sellersRepo,
  type CommissionPayment,
  type CommissionPaymentPreview,
  type Seller,
} from '@/lib/data';
import { formatCOP, formatDateTime, todayLocalDateString } from '@/lib/format';

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

// The seller's own view of their seller record (more/sellers/[id] when the
// logged-in user is that seller): no edit form, no owner actions — just what
// they hold, or what they're owed. The owner's screen is unchanged.
export function MySellerView({ sellerId }: { sellerId: number }) {
  const [seller, setSeller] = useState<Seller | null>(null);

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      sellersRepo.getById(sellerId).then((found) => {
        if (!cancelled) setSeller(found);
      });
      return () => {
        cancelled = true;
      };
    }, [sellerId]),
  );

  if (!seller) return <ThemedView style={styles.container} />;
  return seller.inventoryMode === 'store' ? <MyCommissions seller={seller} /> : <MyInventory seller={seller} />;
}

type Line = { productId: number; name: string; sku: string; price: number; imageUri: string | null; quantity: number };

function MyInventory({ seller }: { seller: Seller }) {
  const theme = useTheme();
  const [lines, setLines] = useState<Line[] | null>(null);

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([sellersRepo.getInventory(seller.id), productsRepo.list()]).then(([inventory, products]) => {
        if (cancelled) return;
        const byId = Object.fromEntries(products.map((p) => [p.id, p]));
        setLines(
          inventory
            .map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
              name: byId[line.productId]?.name ?? `Producto #${line.productId}`,
              sku: byId[line.productId]?.sku ?? '',
              price: byId[line.productId]?.price ?? 0,
              imageUri: byId[line.productId]?.primaryImageUri ?? null,
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      });
      return () => {
        cancelled = true;
      };
    }, [seller.id]),
  );

  const units = (lines ?? []).reduce((sum, l) => sum + l.quantity, 0);
  const value = (lines ?? []).reduce((sum, l) => sum + l.quantity * l.price, 0);
  const hasStock = (lines?.length ?? 0) > 0;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Mi inventario' }} />
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
            <ThemedText type="secondary" themeColor="textSecondary">
              Mercancía contigo
            </ThemedText>
            <ThemedText type="bigNumber">{plural(units, 'unidad', 'unidades')}</ThemedText>
            <ThemedText type="secondary" themeColor="textSecondary">
              {plural(lines?.length ?? 0, 'producto', 'productos')} · {formatCOP(value)} a precio de venta
            </ThemedText>
          </ThemedView>

          {hasStock ? (
            <View style={styles.actions}>
              <Action
                href={`/more/sellers/sales/new?sellerId=${seller.id}`}
                icon={ShoppingBag}
                color={theme.primary}
                label="Vender"
              />
              <Action
                href={`/more/sellers/returns/new?sellerId=${seller.id}`}
                icon={Undo2}
                color={theme.info}
                label="Devolver"
              />
              <Action
                href={`/more/sellers/losses/new?sellerId=${seller.id}`}
                icon={PackageMinus}
                color={theme.error}
                label="Reportar pérdida"
              />
            </View>
          ) : null}

          <View style={styles.section}>
            <ThemedText type="sectionTitle">Productos</ThemedText>
            {lines === null ? (
              <ThemedText type="small" themeColor="textSecondary">
                Cargando…
              </ThemedText>
            ) : !hasStock ? (
              <ThemedView type="backgroundElement" style={[styles.emptyCard, Shadow.subtle]}>
                <View style={[styles.emptyIcon, { backgroundColor: theme.primaryLight }]}>
                  <PackageOpen color={theme.primary} size={28} />
                </View>
                <ThemedText type="cardTitle">No tienes mercancía</ThemedText>
                <ThemedText type="secondary" themeColor="textSecondary" style={styles.center}>
                  Aparece aquí cuando el dueño te registra una entrega.
                </ThemedText>
              </ThemedView>
            ) : (
              <ThemedView type="backgroundElement" style={[styles.listCard, Shadow.subtle]}>
                {lines.map((line, i) => (
                  <View key={line.productId} style={[styles.lineRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                    <ProductThumb uri={line.imageUri} style={styles.thumb} iconSize={20} />
                    <View style={styles.flex}>
                      <ThemedText type="small" numberOfLines={2}>
                        {line.name}
                      </ThemedText>
                      <ThemedText type="caption" themeColor="textSecondary">
                        {line.sku ? `${line.sku} · ` : ''}
                        {formatCOP(line.price)} c/u
                      </ThemedText>
                    </View>
                    <View style={[styles.qtyBadge, { backgroundColor: withAlpha(theme.info, 0.12) }]}>
                      <ThemedText type="smallBold" style={{ color: theme.info }}>
                        {line.quantity}
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </ThemedView>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Action({ href, icon: Icon, color, label }: { href: string; icon: ComponentType<LucideProps>; color: string; label: string }) {
  return (
    <Link href={href as never} asChild>
      <Pressable style={styles.flex}>
        <ThemedView type="backgroundElement" style={[styles.action, Shadow.subtle]}>
          <View style={[styles.actionIcon, { backgroundColor: withAlpha(color, 0.12) }]}>
            <Icon color={color} size={20} />
          </View>
          <ThemedText type="small" style={styles.center}>
            {label}
          </ThemedText>
        </ThemedView>
      </Pressable>
    </Link>
  );
}

function MyCommissions({ seller }: { seller: Seller }) {
  const theme = useTheme();
  const [pending, setPending] = useState<CommissionPaymentPreview | null>(null);
  const [payments, setPayments] = useState<CommissionPayment[]>([]);
  const [accountNames, setAccountNames] = useState<Record<number, string>>({});

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([
        commissionPaymentsRepo.preview(seller.id, todayLocalDateString()),
        commissionPaymentsRepo.listForSeller(seller.id),
        cashAccountsRepo.list(),
      ]).then(([preview, rows, accounts]) => {
        if (cancelled) return;
        setPending(preview);
        setPayments(rows);
        setAccountNames(Object.fromEntries(accounts.map((a) => [a.id, a.name])));
      });
      return () => {
        cancelled = true;
      };
    }, [seller.id]),
  );

  const totalPaid = payments.reduce((sum, p) => sum + p.totalCommission, 0);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Mis comisiones' }} />
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
            <ThemedText type="secondary" themeColor="textSecondary">
              Por cobrar
            </ThemedText>
            <ThemedText type="bigNumber" style={{ color: theme.primary }} adjustsFontSizeToFit numberOfLines={1}>
              {formatCOP(pending?.totalCommission ?? 0)}
            </ThemedText>
            <ThemedText type="secondary" themeColor="textSecondary">
              {plural(pending?.saleCount ?? 0, 'venta', 'ventas')} todavía sin pagar
            </ThemedText>
          </ThemedView>

          <ThemedText type="caption" themeColor="textSecondary">
            Cada pago del dueño cubre todas tus ventas hasta la fecha del pago. Lo que vendas después entra en el siguiente.
          </ThemedText>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText type="sectionTitle" style={styles.flex}>
                Pagos recibidos
              </ThemedText>
              {payments.length > 0 ? (
                <ThemedText type="caption" themeColor="textSecondary">
                  {formatCOP(totalPaid)} en total
                </ThemedText>
              ) : null}
            </View>
            {payments.length === 0 ? (
              <ThemedView type="backgroundElement" style={[styles.emptyCard, Shadow.subtle]}>
                <View style={[styles.emptyIcon, { backgroundColor: withAlpha(theme.purple, 0.12) }]}>
                  <HandCoins color={theme.purple} size={28} />
                </View>
                <ThemedText type="secondary" themeColor="textSecondary" style={styles.center}>
                  Todavía no te han pagado comisiones.
                </ThemedText>
              </ThemedView>
            ) : (
              <ThemedView type="backgroundElement" style={[styles.listCard, Shadow.subtle]}>
                {payments.map((payment, i) => (
                  <View key={payment.id} style={[styles.lineRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                    <View style={[styles.actionIcon, { backgroundColor: withAlpha(theme.purple, 0.12) }]}>
                      <HandCoins color={theme.purple} size={18} />
                    </View>
                    <View style={styles.flex}>
                      <ThemedText type="small">Pagado el {formatDateTime(payment.paidAt)}</ThemedText>
                      <ThemedText type="caption" themeColor="textSecondary">
                        {plural(payment.saleCount, 'venta', 'ventas')} hasta el {payment.periodDate} ·{' '}
                        {accountNames[payment.accountId] ?? 'Cuenta'}
                      </ThemedText>
                    </View>
                    <ThemedText type="smallBold">{formatCOP(payment.totalCommission)}</ThemedText>
                  </View>
                ))}
              </ThemedView>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { padding: Layout.screenPadding, gap: Layout.cardGap, paddingBottom: Spacing.six },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  card: { borderRadius: Radii.card, padding: Spacing.four, gap: Spacing.one },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { borderRadius: Radii.card, padding: Spacing.three, alignItems: 'center', gap: Spacing.two, minHeight: 96, justifyContent: 'center' },
  actionIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  section: { gap: Spacing.two },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  emptyCard: { borderRadius: Radii.card, padding: Spacing.five, alignItems: 'center', gap: Spacing.two },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  listCard: { borderRadius: Radii.card, paddingHorizontal: Spacing.three },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  thumb: { width: 48, height: 48, borderRadius: Spacing.two },
  qtyBadge: { minWidth: 36, borderRadius: Radii.chip, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, alignItems: 'center' },
});
