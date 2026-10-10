import { Link, Stack, useLocalSearchParams } from 'expo-router';
import {
  ClipboardList,
  HandCoins,
  MapPin,
  PackageMinus,
  PackagePlus,
  Pencil,
  Phone,
  ReceiptText,
  ShoppingBag,
  Undo2,
  type LucideProps,
} from 'lucide-react-native';
import { useCallback, useState, type ComponentType } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MenuRow } from '@/components/menu-row';
import { MySellerView } from '@/components/my-seller-view';
import { ProductThumb } from '@/components/pos';
import { SellerAccessCard } from '@/components/seller-access-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useMySeller } from '@/hooks/use-my-seller';
import { useTheme } from '@/hooks/use-theme';
import {
  commissionPaymentsRepo,
  directSalesRepo,
  productsRepo,
  sellerDeliveriesRepo,
  sellerLossesRepo,
  sellerReturnsRepo,
  sellersRepo,
  sellerSalesRepo,
  settlementsRepo,
  type Seller,
} from '@/lib/data';
import { formatCOP, formatDateTime, todayLocalDateString } from '@/lib/format';
import { describeCommission } from '@/lib/seller-commission';

type Tone = 'primary' | 'info' | 'warning' | 'error' | 'purple';

type Activity = { key: string; date: string; icon: ComponentType<LucideProps>; tone: Tone; title: string; value: string };

type InventoryLine = { productId: number; name: string; imageUri: string | null; quantity: number; price: number };

type Profile = {
  seller: Seller;
  // Consignment: what they hold and what the next settlement collects.
  inventory: InventoryLine[];
  amountDue: number;
  // Store: commissions not yet paid.
  pendingCommission: number;
  pendingCommissionSales: number;
  totalSold: number;
  activity: Activity[];
};

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

const LOSS_LABEL = { perdida: 'Pérdida', dano: 'Daño', robo: 'Robo' } as const;

async function loadProfile(sellerId: number): Promise<Profile | null> {
  const seller = await sellersRepo.getById(sellerId);
  if (!seller) return null;
  const today = todayLocalDateString();

  if (seller.inventoryMode === 'store') {
    const [preview, sales, payments] = await Promise.all([
      commissionPaymentsRepo.preview(sellerId, today),
      directSalesRepo.list(),
      commissionPaymentsRepo.listForSeller(sellerId),
    ]);
    const own = sales.filter((s) => s.sellerId === sellerId);
    const activity: Activity[] = [
      ...own.map((s) => ({
        key: `sale-${s.id}`,
        date: s.saleDate,
        icon: ShoppingBag,
        tone: 'primary' as Tone,
        title: `Venta · ${plural(s.items.length, 'producto', 'productos')}`,
        value: formatCOP(s.totalAmount),
      })),
      ...payments.map((p) => ({
        key: `pay-${p.id}`,
        date: p.paidAt,
        icon: HandCoins,
        tone: 'purple' as Tone,
        title: `Pago de comisiones · ${plural(p.saleCount, 'venta', 'ventas')}`,
        value: formatCOP(p.totalCommission),
      })),
    ];
    return {
      seller,
      inventory: [],
      amountDue: 0,
      pendingCommission: preview.totalCommission,
      pendingCommissionSales: preview.saleCount,
      totalSold: own.reduce((sum, s) => sum + s.totalAmount, 0),
      activity: activity.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8),
    };
  }

  const [lines, products, preview, sales, deliveries, returns, losses, settlements] = await Promise.all([
    sellersRepo.getInventory(sellerId),
    productsRepo.list(),
    settlementsRepo.preview(sellerId, today),
    sellerSalesRepo.listForSeller(sellerId),
    sellerDeliveriesRepo.listForSeller(sellerId),
    sellerReturnsRepo.listForSeller(sellerId),
    sellerLossesRepo.listForSeller(sellerId),
    settlementsRepo.list(),
  ]);
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  const units = (items: { quantity: number }[]) => items.reduce((sum, i) => sum + i.quantity, 0);
  const activity: Activity[] = [
    ...deliveries.map((d) => ({
      key: `del-${d.id}`,
      date: d.deliveryDate,
      icon: PackagePlus,
      tone: 'info' as Tone,
      title: `Entrega · ${plural(units(d.items), 'unidad', 'unidades')}`,
      value: formatCOP(d.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0)),
    })),
    ...sales.map((s) => ({
      key: `sale-${s.id}`,
      date: s.saleDate,
      icon: ShoppingBag,
      tone: 'primary' as Tone,
      title: `Venta · ${plural(units(s.items), 'unidad', 'unidades')}`,
      value: formatCOP(s.totalAmount),
    })),
    ...returns.map((r) => ({
      key: `ret-${r.id}`,
      date: r.returnDate,
      icon: Undo2,
      tone: 'warning' as Tone,
      title: `Devolución · ${plural(units(r.items), 'unidad', 'unidades')}`,
      value: '',
    })),
    ...losses.map((l) => ({
      key: `loss-${l.id}`,
      date: l.lossDate,
      icon: PackageMinus,
      tone: 'error' as Tone,
      title: `${LOSS_LABEL[l.type]} · ${plural(units(l.items), 'unidad', 'unidades')}`,
      value: formatCOP(l.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0)),
    })),
    ...settlements
      .filter((s) => s.sellerId === sellerId)
      .map((s) => ({
        key: `set-${s.id}`,
        date: s.settledAt ?? s.createdAt,
        icon: ClipboardList,
        tone: 'purple' as Tone,
        title: s.status === 'liquidada' ? 'Liquidación cerrada' : 'Liquidación pendiente',
        value: formatCOP(s.amountDue),
      })),
  ];
  return {
    seller,
    inventory: lines
      .map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        name: byId[l.productId]?.name ?? `Producto #${l.productId}`,
        imageUri: byId[l.productId]?.primaryImageUri ?? null,
        price: byId[l.productId]?.price ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    amountDue: preview.amountDue,
    pendingCommission: 0,
    pendingCommissionSales: 0,
    totalSold: sales.reduce((sum, s) => sum + s.totalAmount, 0),
    activity: activity.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8),
  };
}

// A seller opening their own record ("Mi inventario" / "Mis comisiones") gets
// a read-only view of their own (components/my-seller-view.tsx); the owner
// gets this profile. Editing the data lives in [id]/edit.tsx.
export default function SellerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isSeller } = useMySeller();
  return isSeller ? <MySellerView sellerId={Number(id)} /> : <SellerProfile sellerId={Number(id)} />;
}

function SellerProfile({ sellerId }: { sellerId: number }) {
  const theme = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadProfile(sellerId).then((result) => {
        if (cancelled) return;
        setProfile(result);
        setLoaded(true);
      });
      return () => {
        cancelled = true;
      };
    }, [sellerId]),
  );

  const toneColor: Record<Tone, string> = {
    primary: theme.primary,
    info: theme.info,
    warning: theme.warning,
    error: theme.error,
    purple: theme.purple,
  };

  if (!profile) {
    return (
      <ThemedView style={[styles.container, styles.padded]}>
        <ThemedText themeColor="textSecondary">{loaded ? 'Vendedor no encontrado' : 'Cargando…'}</ThemedText>
      </ThemedView>
    );
  }

  const { seller } = profile;
  const isStore = seller.inventoryMode === 'store';
  const units = profile.inventory.reduce((sum, l) => sum + l.quantity, 0);
  const hasStock = units > 0;
  const q = `sellerId=${sellerId}`;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: seller.name,
          headerRight: () => (
            <Link href={`/more/sellers/${sellerId}/edit`} asChild>
              <Pressable hitSlop={8} style={styles.headerAction}>
                <Pencil color={theme.primary} size={16} />
                <ThemedText type="smallBold" style={{ color: theme.primary }}>
                  Editar
                </ThemedText>
              </Pressable>
            </Link>
          ),
        }}
      />
      <SafeAreaView style={styles.flex} edges={[]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
            <View style={styles.identity}>
              <View style={[styles.avatar, { backgroundColor: theme.primaryLight }]}>
                <ThemedText type="sectionTitle" style={{ color: theme.primary }}>
                  {seller.name.trim().charAt(0).toUpperCase() || '?'}
                </ThemedText>
              </View>
              <View style={styles.flex}>
                <ThemedText type="cardTitle">{seller.name}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {describeCommission(seller.commissionType, seller.commissionValue)}
                </ThemedText>
              </View>
            </View>
            <View style={styles.badges}>
              <Badge label={isStore ? 'Tienda' : 'Consignación'} color={theme.info} />
              {!seller.active ? <Badge label="Inactivo" color={theme.error} /> : null}
              {seller.phone ? <InfoChip icon={Phone} text={seller.phone} /> : null}
              {seller.city ? <InfoChip icon={MapPin} text={seller.city} /> : null}
            </View>
          </ThemedView>

          <View style={styles.tiles}>
            {isStore ? (
              <Tile
                label="Comisión por pagar"
                value={formatCOP(profile.pendingCommission)}
                caption={plural(profile.pendingCommissionSales, 'venta', 'ventas')}
                color={theme.purple}
              />
            ) : (
              <>
                <Tile label="Tiene" value={plural(units, 'unidad', 'unidades')} caption={plural(profile.inventory.length, 'producto', 'productos')} color={theme.info} />
                <Tile label="Por liquidar hoy" value={formatCOP(profile.amountDue)} caption="Lo que entregaría" color={theme.primary} />
              </>
            )}
          </View>
          <ThemedText type="caption" themeColor="textSecondary">
            Ha vendido {formatCOP(profile.totalSold)} en total.
          </ThemedText>

          <View style={styles.section}>
            <ThemedText type="sectionTitle">Acciones</ThemedText>
            <View style={styles.actions}>
              {isStore ? (
                <Action
                  href={`/more/sellers/commissions/new?${q}`}
                  icon={HandCoins}
                  color={theme.purple}
                  label="Pagar comisiones"
                  disabled={profile.pendingCommission <= 0}
                />
              ) : (
                <>
                  <Action href={`/more/sellers/deliveries/new?${q}`} icon={PackagePlus} color={theme.info} label="Entregar" disabled={!seller.active} />
                  <Action href={`/more/sellers/sales/new?${q}`} icon={ShoppingBag} color={theme.primary} label="Venta" disabled={!hasStock} />
                  <Action href={`/more/sellers/returns/new?${q}`} icon={Undo2} color={theme.warning} label="Devolución" disabled={!hasStock} />
                  <Action href={`/more/sellers/losses/new?${q}`} icon={PackageMinus} color={theme.error} label="Pérdida" disabled={!hasStock} />
                  <Action href={`/more/sellers/settlements/new?${q}`} icon={ClipboardList} color={theme.purple} label="Liquidar" />
                </>
              )}
            </View>
          </View>

          {!isStore ? (
            <View style={styles.section}>
              <ThemedText type="sectionTitle">Inventario</ThemedText>
              {profile.inventory.length === 0 ? (
                <ThemedText type="secondary" themeColor="textSecondary">
                  No tiene mercancía ahora. Usa &quot;Entregar&quot; para darle productos.
                </ThemedText>
              ) : (
                <ThemedView type="backgroundElement" style={[styles.listCard, Shadow.subtle]}>
                  {profile.inventory.map((line, i) => (
                    <View key={line.productId} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                      <ProductThumb uri={line.imageUri} style={styles.thumb} iconSize={16} />
                      <View style={styles.flex}>
                        <ThemedText type="small" numberOfLines={1}>
                          {line.name}
                        </ThemedText>
                        <ThemedText type="caption" themeColor="textSecondary">
                          {formatCOP(line.price)} c/u
                        </ThemedText>
                      </View>
                      <View style={[styles.qty, { backgroundColor: withAlpha(theme.info, 0.12) }]}>
                        <ThemedText type="smallBold" style={{ color: theme.info }}>
                          {line.quantity}
                        </ThemedText>
                      </View>
                    </View>
                  ))}
                </ThemedView>
              )}
            </View>
          ) : null}

          <View style={styles.section}>
            <ThemedText type="sectionTitle">Actividad reciente</ThemedText>
            {profile.activity.length === 0 ? (
              <ThemedText type="secondary" themeColor="textSecondary">
                Sin movimientos todavía.
              </ThemedText>
            ) : (
              <ThemedView type="backgroundElement" style={[styles.listCard, Shadow.subtle]}>
                {profile.activity.map((entry, i) => {
                  const color = toneColor[entry.tone];
                  const Icon = entry.icon;
                  return (
                    <View key={entry.key} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                      <View style={[styles.iconDot, { backgroundColor: withAlpha(color, 0.12) }]}>
                        <Icon color={color} size={16} />
                      </View>
                      <View style={styles.flex}>
                        <ThemedText type="small" numberOfLines={1}>
                          {entry.title}
                        </ThemedText>
                        <ThemedText type="caption" themeColor="textSecondary">
                          {formatDateTime(entry.date)}
                        </ThemedText>
                      </View>
                      {entry.value ? <ThemedText type="smallBold">{entry.value}</ThemedText> : null}
                    </View>
                  );
                })}
              </ThemedView>
            )}
          </View>

          <View style={styles.section}>
            <ThemedText type="sectionTitle">Historial</ThemedText>
            <ThemedView type="backgroundElement" style={[styles.menuCard, Shadow.subtle]}>
              {isStore ? (
                <MenuRow href={`/sell/history?${q}`} icon={ReceiptText} title="Ventas" subtitle="Sus ventas en la tienda" />
              ) : (
                <>
                  <MenuRow href={`/more/sellers/deliveries?${q}`} icon={PackagePlus} color={theme.info} title="Entregas" />
                  <MenuRow href={`/more/sellers/sales?${q}`} icon={ShoppingBag} title="Ventas" divider />
                  <MenuRow href={`/more/sellers/returns?${q}`} icon={Undo2} color={theme.warning} title="Devoluciones" divider />
                  <MenuRow href={`/more/sellers/losses?${q}`} icon={PackageMinus} color={theme.error} title="Pérdidas" divider />
                  <MenuRow href={`/more/sellers/settlements?${q}`} icon={ClipboardList} color={theme.purple} title="Liquidaciones" divider />
                </>
              )}
            </ThemedView>
          </View>

          <SellerAccessCard sellerUuid={seller.uuid} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: withAlpha(color, 0.12) }]}>
      <ThemedText type="caption" style={{ color }}>
        {label}
      </ThemedText>
    </View>
  );
}

function InfoChip({ icon: Icon, text }: { icon: ComponentType<LucideProps>; text: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.badge, styles.infoChip, { backgroundColor: withAlpha(theme.textSecondary, 0.1) }]}>
      <Icon color={theme.textSecondary} size={12} />
      <ThemedText type="caption" themeColor="textSecondary">
        {text}
      </ThemedText>
    </View>
  );
}

function Tile({ label, value, caption, color }: { label: string; value: string; caption: string; color: string }) {
  return (
    <ThemedView type="backgroundElement" style={[styles.tile, Shadow.subtle]}>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="cardTitle" style={{ color }} adjustsFontSizeToFit numberOfLines={1}>
        {value}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {caption}
      </ThemedText>
    </ThemedView>
  );
}

function Action({
  href,
  icon: Icon,
  color,
  label,
  disabled = false,
}: {
  href: string;
  icon: ComponentType<LucideProps>;
  color: string;
  label: string;
  disabled?: boolean;
}) {
  const content = (
    <ThemedView type="backgroundElement" style={[styles.action, Shadow.subtle, disabled && styles.disabled]}>
      <View style={[styles.iconDot, { backgroundColor: withAlpha(color, 0.12) }]}>
        <Icon color={color} size={18} />
      </View>
      <ThemedText type="caption" style={styles.center} numberOfLines={1}>
        {label}
      </ThemedText>
    </ThemedView>
  );
  if (disabled) return <View style={styles.actionWrap}>{content}</View>;
  return (
    <Link href={href as never} asChild>
      <Pressable style={styles.actionWrap}>{content}</Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  padded: { padding: Layout.screenPadding },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  headerAction: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  scrollContent: { padding: Layout.screenPadding, gap: Layout.cardGap, paddingBottom: Spacing.six },
  card: { borderRadius: Radii.card, padding: Spacing.four, gap: Spacing.three },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  badge: { borderRadius: Radii.chip, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  infoChip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  tiles: { flexDirection: 'row', gap: Layout.cardGap },
  tile: { flex: 1, borderRadius: Radii.card, padding: Spacing.three, gap: Spacing.half },
  section: { gap: Spacing.two },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  actionWrap: { width: '31%', flexGrow: 1 },
  action: { borderRadius: Radii.card, paddingVertical: Spacing.three, paddingHorizontal: Spacing.two, alignItems: 'center', gap: Spacing.two },
  disabled: { opacity: 0.4 },
  listCard: { borderRadius: Radii.card, paddingHorizontal: Spacing.three },
  menuCard: { borderRadius: Radii.card, paddingHorizontal: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  thumb: { width: 40, height: 40, borderRadius: Spacing.two },
  qty: { minWidth: 36, borderRadius: Radii.chip, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, alignItems: 'center' },
  iconDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
