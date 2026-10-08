import { Link, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useMySeller } from '@/hooks/use-my-seller';
import { useTheme } from '@/hooks/use-theme';
import { cashAccountsRepo, commissionPaymentsRepo, productsRepo, sellersRepo, type CommissionPayment, type CommissionPaymentPreview } from '@/lib/data';
import { formatCOP, todayLocalDateString } from '@/lib/format';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { sellerSchema, type SellerInventoryMode } from '@/lib/validations';

type InventoryLine = { productId: number; name: string; sku: string; quantity: number };

export default function EditSellerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sellerId = Number(id);
  const theme = useTheme();
  const { isSeller } = useMySeller();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [commissionType, setCommissionType] = useState<'percentage' | 'fixed_per_unit'>('percentage');
  const [inventoryMode, setInventoryMode] = useState<SellerInventoryMode>('consignment');
  const [commissionValue, setCommissionValue] = useState('');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);
  // The saved mode (not the one being edited) decides which actions show.
  const [savedMode, setSavedMode] = useState<SellerInventoryMode>('consignment');
  const [inventory, setInventory] = useState<InventoryLine[]>([]);
  // Store sellers: commissions still unpaid up to today, and past payments.
  const [pendingCommission, setPendingCommission] = useState<CommissionPaymentPreview | null>(null);
  const [commissionPayments, setCommissionPayments] = useState<CommissionPayment[]>([]);
  const [accountNames, setAccountNames] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Prefills the edit form: focus only, never on a background sync — that
  // would overwrite what the owner is typing (see use-data-focus-effect.ts).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      sellersRepo.getById(sellerId).then((seller) => {
        if (cancelled) return;
        if (seller) {
          setName(seller.name);
          setPhone(seller.phone ?? '');
          setCity(seller.city ?? '');
          setCommissionType(seller.commissionType);
          setInventoryMode(seller.inventoryMode);
          setSavedMode(seller.inventoryMode);
          setCommissionValue(String(seller.commissionValue));
          setNotes(seller.notes ?? '');
          setActive(seller.active);
        }
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [sellerId]),
  );

  // The inventory section is read-only, so unlike the form above it also
  // reloads when a background sync changes it (a delivery the owner just
  // made, a sale from another device) — the seller's "Mi inventario".
  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([
        commissionPaymentsRepo.preview(sellerId, todayLocalDateString()),
        commissionPaymentsRepo.listForSeller(sellerId),
        cashAccountsRepo.list(),
      ]).then(([pending, payments, accounts]) => {
        if (cancelled) return;
        setPendingCommission(pending);
        setCommissionPayments(payments);
        setAccountNames(Object.fromEntries(accounts.map((a) => [a.id, a.name])));
      });
      Promise.all([sellersRepo.getInventory(sellerId), productsRepo.list()]).then(([lines, products]) => {
        if (cancelled) return;
        const productById = Object.fromEntries(products.map((p) => [p.id, p]));
        setInventory(
          lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            name: productById[line.productId]?.name ?? `Producto #${line.productId}`,
            sku: productById[line.productId]?.sku ?? '',
          })),
        );
      });
      return () => {
        cancelled = true;
      };
    }, [sellerId]),
  );

  async function handleSubmit() {
    const parsed = sellerSchema.safeParse({
      name,
      phone: phone || undefined,
      city: city || undefined,
      commissionType,
      commissionValue: Number(commissionValue),
      inventoryMode,
      notes: notes || undefined,
      active,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await sellersRepo.update(sellerId, parsed.data);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el vendedor');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    setSaving(true);
    try {
      await sellersRepo.deactivate(sellerId);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo desactivar el vendedor');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText themeColor="textSecondary">Cargando…</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {isSeller ? (
            <ThemedText type="default">{name}</ThemedText>
          ) : (
            <>
          <ThemedText type="small">Nombre</ThemedText>
          <TextInput value={name} onChangeText={setName} style={inputStyle} />

          <ThemedText type="small">Teléfono (opcional)</ThemedText>
          <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={inputStyle} />

          <ThemedText type="small">Ciudad (opcional)</ThemedText>
          <TextInput value={city} onChangeText={setCity} style={inputStyle} />

          <ThemedText type="small">Tipo de vendedor</ThemedText>
          <ThemedView style={styles.typeRow}>
            <Pressable style={styles.typeFlex} onPress={() => setInventoryMode('consignment')}>
              <ThemedView type={inventoryMode === 'consignment' ? 'backgroundSelected' : 'backgroundElement'} style={styles.typeButton}>
                <ThemedText type={inventoryMode === 'consignment' ? 'linkPrimary' : undefined}>Consignación</ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable style={styles.typeFlex} onPress={() => setInventoryMode('store')}>
              <ThemedView type={inventoryMode === 'store' ? 'backgroundSelected' : 'backgroundElement'} style={styles.typeButton}>
                <ThemedText type={inventoryMode === 'store' ? 'linkPrimary' : undefined}>Tienda principal</ThemedText>
              </ThemedView>
            </Pressable>
          </ThemedView>
          <ThemedText type="small" themeColor="textSecondary">
            {inventoryMode === 'store'
              ? 'Vende del inventario principal y el dinero entra a caja al momento. No recibe entregas ni se liquida.'
              : 'Vende solo la mercancía que se le entrega y entrega el dinero al liquidar.'}
          </ThemedText>

          <ThemedText type="small">Tipo de comisión</ThemedText>
          <ThemedView style={styles.typeRow}>
            <Pressable style={styles.typeFlex} onPress={() => setCommissionType('percentage')}>
              <ThemedView type={commissionType === 'percentage' ? 'backgroundSelected' : 'backgroundElement'} style={styles.typeButton}>
                <ThemedText type={commissionType === 'percentage' ? 'linkPrimary' : undefined}>% por venta</ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable style={styles.typeFlex} onPress={() => setCommissionType('fixed_per_unit')}>
              <ThemedView type={commissionType === 'fixed_per_unit' ? 'backgroundSelected' : 'backgroundElement'} style={styles.typeButton}>
                <ThemedText type={commissionType === 'fixed_per_unit' ? 'linkPrimary' : undefined}>Fija por unidad</ThemedText>
              </ThemedView>
            </Pressable>
          </ThemedView>

          <ThemedText type="small">
            {commissionType === 'percentage' ? 'Comisión en puntos base (ej. 1000 = 10%)' : 'Comisión fija por unidad vendida, en pesos'}
          </ThemedText>
          <TextInput value={commissionValue} onChangeText={setCommissionValue} keyboardType="numeric" style={inputStyle} />

          <ThemedText type="small">Notas (opcional)</ThemedText>
          <TextInput value={notes} onChangeText={setNotes} style={inputStyle} multiline />

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <Pressable onPress={handleSubmit} disabled={saving}>
            <ThemedView type="backgroundSelected" style={styles.submitButton}>
              <ThemedText type="linkPrimary">{saving ? 'Guardando…' : 'Guardar cambios'}</ThemedText>
            </ThemedView>
          </Pressable>
            </>
          )}

          {savedMode === 'store' ? (
            <>
              <ThemedText themeColor="textSecondary" type="small" style={styles.sectionTitle}>
                Vendedor de tienda: vende del inventario principal desde Vender y sus ventas entran a caja al momento.
              </ThemedText>

              <ThemedText type="smallBold" style={styles.sectionTitle}>
                Comisiones
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.inventoryRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  Pendiente por pagar
                </ThemedText>
                <ThemedText type="subtitle">{formatCOP(pendingCommission?.totalCommission ?? 0)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {pendingCommission?.saleCount ?? 0} {pendingCommission?.saleCount === 1 ? 'venta' : 'ventas'}
                </ThemedText>
              </ThemedView>

              {!isSeller && (pendingCommission?.totalCommission ?? 0) > 0 ? (
                <Link href={`/more/sellers/commissions/new?sellerId=${sellerId}`} asChild>
                  <Pressable>
                    <ThemedView type="backgroundSelected" style={styles.submitButton}>
                      <ThemedText type="linkPrimary">Pagar comisiones</ThemedText>
                    </ThemedView>
                  </Pressable>
                </Link>
              ) : null}

              {commissionPayments.length > 0 ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.sectionTitle}>
                  Pagos realizados
                </ThemedText>
              ) : null}
              {commissionPayments.map((payment) => (
                <ThemedView key={payment.id} type="backgroundElement" style={styles.inventoryRow}>
                  <ThemedText type="small">
                    {formatCOP(payment.totalCommission)} · hasta {payment.periodDate}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {payment.saleCount} {payment.saleCount === 1 ? 'venta' : 'ventas'} · {accountNames[payment.accountId] ?? 'Cuenta'}
                  </ThemedText>
                </ThemedView>
              ))}
            </>
          ) : (
            <>
          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Inventario actual
          </ThemedText>
          {inventory.length === 0 ? (
            <ThemedText themeColor="textSecondary" type="small">
              Sin inventario asignado todavía.
            </ThemedText>
          ) : (
            inventory.map((line) => (
              <ThemedView key={line.productId} type="backgroundElement" style={styles.inventoryRow}>
                <ThemedText type="small">{line.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {line.sku} · {line.quantity} unidad{line.quantity === 1 ? '' : 'es'}
                </ThemedText>
              </ThemedView>
            ))
          )}

          {inventory.length > 0 ? (
            <>
              <Link href={`/more/sellers/sales/new?sellerId=${sellerId}`} asChild>
                <Pressable>
                  <ThemedView type="backgroundSelected" style={styles.submitButton}>
                    <ThemedText type="linkPrimary">Registrar venta</ThemedText>
                  </ThemedView>
                </Pressable>
              </Link>

              <ThemedView style={styles.actionsRow}>
                <Link href={`/more/sellers/returns/new?sellerId=${sellerId}`} asChild>
                  <Pressable style={styles.actionFlex}>
                    <ThemedView type="backgroundElement" style={styles.submitButton}>
                      <ThemedText>Registrar devolución</ThemedText>
                    </ThemedView>
                  </Pressable>
                </Link>
                <Link href={`/more/sellers/losses/new?sellerId=${sellerId}`} asChild>
                  <Pressable style={styles.actionFlex}>
                    <ThemedView type="backgroundElement" style={styles.submitButton}>
                      <ThemedText>Registrar pérdida</ThemedText>
                    </ThemedView>
                  </Pressable>
                </Link>
              </ThemedView>
            </>
          ) : null}

          {!isSeller ? (
            <Link href={`/more/sellers/settlements/new?sellerId=${sellerId}`} asChild>
              <Pressable>
                <ThemedView type="backgroundElement" style={styles.submitButton}>
                  <ThemedText>Liquidar</ThemedText>
                </ThemedView>
              </Pressable>
            </Link>
          ) : null}
            </>
          )}

          {active && !isSeller ? (
            <Pressable onPress={handleDeactivate} disabled={saving}>
              <ThemedView type="backgroundElement" style={styles.submitButton}>
                <ThemedText>Desactivar vendedor</ThemedText>
              </ThemedView>
            </Pressable>
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
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  sectionTitle: { marginTop: Spacing.three, marginBottom: Spacing.one },
  inventoryRow: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.one,
  },
  actionsRow: { flexDirection: 'row', gap: Spacing.two },
  actionFlex: { flex: 1 },
  typeRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.two },
  typeFlex: { flex: 1 },
  typeButton: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  error: { color: '#d9534f' },
  submitButton: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
