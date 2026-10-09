import { ClipboardList, HandCoins, Package, ReceiptText, Settings, ShoppingBag, type LucideProps } from 'lucide-react-native';
import { useCallback, useState, type ComponentType } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MenuRow } from '@/components/menu-row';
import { SyncStatusPill } from '@/components/sync-status';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useTheme } from '@/hooks/use-theme';
import { useSyncSession } from '@/hooks/use-sync-session';
import {
  commissionPaymentsRepo,
  directSalesRepo,
  sellersRepo,
  sellerSalesRepo,
  settlementsRepo,
  type Seller,
} from '@/lib/data';
import { formatCOP, isOnLocalDay, todayLocalDateString } from '@/lib/format';

type Summary = {
  // Hero number: what they owe at the next settlement (consignment) or the
  // commission still to be paid to them (store).
  hero: number;
  heroCaption: string;
  todayTotal: number;
  todayCount: number;
  // Second tile: units held (consignment) or today's commission (store).
  side: string;
  sideCaption: string;
  productCount: number;
  unitCount: number;
};

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

async function loadSummary(seller: Seller): Promise<Summary> {
  const today = todayLocalDateString();

  if (seller.inventoryMode === 'store') {
    const [pending, sales] = await Promise.all([commissionPaymentsRepo.preview(seller.id, today), directSalesRepo.list()]);
    const todays = sales.filter((s) => s.sellerId === seller.id && isOnLocalDay(s.saleDate, today));
    const todayCommission = todays.reduce((sum, s) => sum + s.commissionAmount, 0);
    return {
      hero: pending.totalCommission,
      heroCaption: `${plural(pending.saleCount, 'venta', 'ventas')} sin pagar todavía`,
      todayTotal: todays.reduce((sum, s) => sum + s.totalAmount, 0),
      todayCount: todays.length,
      side: formatCOP(todayCommission),
      sideCaption: 'Comisión de hoy',
      productCount: 0,
      unitCount: 0,
    };
  }

  const [preview, sales, inventory] = await Promise.all([
    settlementsRepo.preview(seller.id, today),
    sellerSalesRepo.listForSeller(seller.id),
    sellersRepo.getInventory(seller.id),
  ]);
  const todays = sales.filter((s) => isOnLocalDay(s.saleDate, today));
  const units = inventory.reduce((sum, line) => sum + line.quantity, 0);
  const parts = [`Ventas ${formatCOP(preview.totalSales)}`, `tu comisión −${formatCOP(preview.totalCommission)}`];
  if (preview.totalLosses > 0) parts.push(`pérdidas +${formatCOP(preview.totalLosses)}`);
  return {
    hero: preview.amountDue,
    heroCaption: parts.join(' · '),
    todayTotal: todays.reduce((sum, s) => sum + s.totalAmount, 0),
    todayCount: todays.length,
    side: plural(units, 'unidad', 'unidades'),
    sideCaption: 'Mercancía contigo',
    productCount: inventory.length,
    unitCount: units,
  };
}

// What a seller sees under Más: who they are, whether their sales already
// reached the server, the one number that matters for their role, and their
// few screens. The owner keeps the plain module menu (more/index.tsx).
export function SellerHome({ seller, loading }: { seller: Seller | null; loading: boolean }) {
  const theme = useTheme();
  const session = useSyncSession();
  const [summary, setSummary] = useState<Summary | null>(null);
  const isStore = seller?.inventoryMode === 'store';

  useDataFocusEffect(
    useCallback(() => {
      if (!seller) return;
      let cancelled = false;
      loadSummary(seller).then((s) => {
        if (!cancelled) setSummary(s);
      });
      return () => {
        cancelled = true;
      };
    }, [seller]),
  );

  const fullName = seller?.name ?? (session.status === 'authenticated' ? session.session.user.name : '');
  const firstName = fullName.trim().split(/\s+/)[0] ?? '';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.greeting}>
            <ThemedText type="greeting">Hola{firstName ? `, ${firstName}` : ''}</ThemedText>
            <View style={styles.badges}>
              {seller ? (
                <View style={[styles.badge, { backgroundColor: withAlpha(theme.textSecondary, 0.12) }]}>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {isStore ? 'Vendes en la tienda' : 'Vendes por consignación'}
                  </ThemedText>
                </View>
              ) : null}
              <SyncStatusPill />
            </View>
          </View>

          {!seller ? (
            <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
              <ThemedText type="cardTitle">{loading ? 'Cargando…' : 'Preparando tus datos'}</ThemedText>
              <ThemedText type="secondary" themeColor="textSecondary">
                Tu información aparece aquí después de la primera sincronización. Si no llega, abre Configuración y toca
                &quot;Sincronizar ahora&quot;.
              </ThemedText>
            </ThemedView>
          ) : (
            <>
              <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
                <ThemedText type="secondary" themeColor="textSecondary">
                  {isStore ? 'Comisión por cobrar' : 'Por entregar en la próxima liquidación'}
                </ThemedText>
                <ThemedText type="bigNumber" style={{ color: theme.primary }} adjustsFontSizeToFit numberOfLines={1}>
                  {formatCOP(summary?.hero ?? 0)}
                </ThemedText>
                <ThemedText type="secondary" themeColor="textSecondary">
                  {summary?.heroCaption ?? ' '}
                </ThemedText>
              </ThemedView>

              <View style={styles.tiles}>
                <Tile
                  icon={ShoppingBag}
                  color={theme.success}
                  label="Vendiste hoy"
                  value={formatCOP(summary?.todayTotal ?? 0)}
                  caption={plural(summary?.todayCount ?? 0, 'venta', 'ventas')}
                />
                <Tile
                  icon={isStore ? HandCoins : Package}
                  color={isStore ? theme.purple : theme.info}
                  label={summary?.sideCaption ?? ' '}
                  value={summary?.side ?? '—'}
                />
              </View>

              <View style={styles.section}>
                <ThemedText type="sectionTitle">Lo tuyo</ThemedText>
                <ThemedView type="backgroundElement" style={[styles.menuCard, Shadow.subtle]}>
                  {isStore ? (
                    <>
                      <MenuRow href="/sell/history" icon={ReceiptText} title="Mis ventas" subtitle="Todo lo que has vendido" />
                      <MenuRow
                        href={`/more/sellers/${seller.id}`}
                        icon={HandCoins}
                        color={theme.purple}
                        title="Mis comisiones"
                        subtitle="Lo pendiente y los pagos que te han hecho"
                        divider
                      />
                    </>
                  ) : (
                    <>
                      <MenuRow
                        href={`/more/sellers/${seller.id}`}
                        icon={Package}
                        color={theme.info}
                        title="Mi inventario"
                        subtitle={
                          summary
                            ? `${plural(summary.productCount, 'producto', 'productos')} · devoluciones y pérdidas`
                            : 'Devoluciones y pérdidas'
                        }
                      />
                      <MenuRow
                        href="/more/sellers/sales"
                        icon={ReceiptText}
                        title="Mis ventas"
                        subtitle="Todo lo que has vendido"
                        divider
                      />
                      <MenuRow
                        href="/more/sellers/settlements"
                        icon={ClipboardList}
                        color={theme.purple}
                        title="Mis liquidaciones"
                        subtitle="Lo que has entregado al dueño"
                        divider
                      />
                    </>
                  )}
                </ThemedView>
              </View>
            </>
          )}

          <ThemedView type="backgroundElement" style={[styles.menuCard, Shadow.subtle]}>
            <MenuRow
              href="/more/settings"
              icon={Settings}
              color={theme.textSecondary}
              title="Configuración"
              subtitle="Cuenta, sincronización y tema"
            />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Tile({
  icon: Icon,
  color,
  label,
  value,
  caption,
}: {
  icon: ComponentType<LucideProps>;
  color: string;
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <ThemedView type="backgroundElement" style={[styles.tile, Shadow.subtle]}>
      <View style={[styles.tileIcon, { backgroundColor: withAlpha(color, 0.12) }]}>
        <Icon color={color} size={18} />
      </View>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="cardTitle" adjustsFontSizeToFit numberOfLines={1}>
        {value}
      </ThemedText>
      {caption ? (
        <ThemedText type="caption" themeColor="textSecondary">
          {caption}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { padding: Layout.screenPadding, gap: Layout.cardGap, paddingBottom: Spacing.six },
  greeting: { gap: Spacing.two },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  badge: { borderRadius: Radii.chip, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  card: { borderRadius: Radii.card, padding: Spacing.four, gap: Spacing.one },
  tiles: { flexDirection: 'row', gap: Layout.cardGap },
  tile: { flex: 1, borderRadius: Radii.card, padding: Spacing.three, gap: Spacing.one },
  tileIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  section: { gap: Spacing.two },
  menuCard: { borderRadius: Radii.card, paddingHorizontal: Spacing.three },
});
