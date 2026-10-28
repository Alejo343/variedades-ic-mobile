import { router, Stack } from 'expo-router';
import { Ban, PencilLine } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormInput } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Layout, Radii, Shadow, Spacing, withAlpha } from '@/constants/theme';
import { useDataFocusEffect } from '@/hooks/use-data-focus-effect';
import { useMySeller } from '@/hooks/use-my-seller';
import { useTheme } from '@/hooks/use-theme';
import { cashAccountsRepo, directSalesRepo, productsRepo, sellersRepo, sellerSalesRepo } from '@/lib/data';
import { saleVoidBlocker } from '@/lib/domain/sale-void';
import { formatCOP, formatDateTime } from '@/lib/format';

export type SaleKind = 'direct' | 'seller';

type Detail = {
  id: number;
  saleDate: string;
  totalAmount: number;
  commissionAmount: number;
  sellerId: number | null;
  sellerName: string | null;
  accountName: string | null;
  notes: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  blocker: string | null;
  items: { key: number; name: string; quantity: number; unitPrice: number; subtotal: number }[];
};

async function loadDetail(kind: SaleKind, saleId: number): Promise<Detail | null> {
  const [products, sellers] = await Promise.all([productsRepo.list(), sellersRepo.list()]);
  const productName = new Map(products.map((p) => [p.id, p.name]));
  const sellerName = (id: number | null) => (id === null ? null : (sellers.find((s) => s.id === id)?.name ?? `Vendedor #${id}`));
  const items = (rows: { id: number; productId: number; quantity: number; unitPrice: number; subtotal: number }[]) =>
    rows.map((i) => ({ key: i.id, name: productName.get(i.productId) ?? `Producto #${i.productId}`, quantity: i.quantity, unitPrice: i.unitPrice, subtotal: i.subtotal }));

  if (kind === 'direct') {
    const [sales, accounts] = await Promise.all([directSalesRepo.list(), cashAccountsRepo.list()]);
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) return null;
    return {
      ...sale,
      sellerName: sellerName(sale.sellerId),
      accountName: accounts.find((a) => a.id === sale.accountId)?.name ?? null,
      blocker: saleVoidBlocker(sale),
      items: items(sale.items),
    };
  }
  const sale = (await sellerSalesRepo.list()).find((s) => s.id === saleId);
  if (!sale) return null;
  return { ...sale, sellerName: sellerName(sale.sellerId), accountName: null, blocker: saleVoidBlocker(sale), items: items(sale.items) };
}

// One sale, with Anular / Corregir for the owner (lib/domain/sale-void.ts).
// Corregir voids it and opens the matching form preloaded with its products,
// to register it again the right way: the POS for the owner's in-store sale,
// the consignment sale form for a seller's. A store seller's in-store sale is
// only voided — it's theirs to register again from their phone.
export function SaleDetail({ kind, saleId }: { kind: SaleKind; saleId: number }) {
  const theme = useTheme();
  const { isSeller } = useMySeller();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<'void' | 'correct' | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useDataFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadDetail(kind, saleId).then((found) => {
        if (cancelled) return;
        setDetail(found);
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [kind, saleId]),
  );

  async function handleConfirm() {
    if (!detail || !confirming) return;
    setSaving(true);
    setError(null);
    try {
      if (kind === 'direct') await directSalesRepo.voidSale(saleId, reason);
      else await sellerSalesRepo.voidSale(saleId, reason);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo anular la venta');
      // Re-enabled only on failure: the success paths leave the screen
      // (a state update on a closing screen crashes Android, CLAUDE.md).
      setSaving(false);
      return;
    }
    if (confirming === 'void') router.back();
    else if (kind === 'direct') router.dismissTo({ pathname: '/sell', params: { corregir: String(saleId) } });
    else router.replace({ pathname: '/more/sellers/sales/new', params: { sellerId: String(detail.sellerId), corregir: String(saleId) } });
  }

  if (loading || !detail) {
    return (
      <ThemedView style={[styles.container, styles.padded]}>
        <ThemedText themeColor="textSecondary">{loading ? 'Cargando…' : 'Venta no encontrada'}</ThemedText>
      </ThemedView>
    );
  }

  const voided = detail.voidedAt !== null;
  const canCorrect = kind === 'seller' || detail.sellerId === null;
  const who = kind === 'seller' ? detail.sellerName : detail.sellerName ? `Vendió ${detail.sellerName}` : 'En local';

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: `Venta #${detail.id}` }} />
      <SafeAreaView style={styles.flex} edges={[]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
              <View style={styles.heroHeader}>
                <ThemedText type="secondary" themeColor="textSecondary" style={styles.flex}>
                  {who}
                </ThemedText>
                {voided ? (
                  <View style={[styles.chip, { backgroundColor: withAlpha(theme.error, 0.12) }]}>
                    <ThemedText type="caption" style={{ color: theme.error }}>
                      Anulada
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              <ThemedText
                type="bigNumber"
                adjustsFontSizeToFit
                numberOfLines={1}
                style={voided ? [styles.struck, { color: theme.textSecondary }] : undefined}>
                {formatCOP(detail.totalAmount)}
              </ThemedText>
              <ThemedText type="secondary" themeColor="textSecondary">
                {[formatDateTime(detail.saleDate), detail.accountName].filter(Boolean).join(' · ')}
              </ThemedText>
              {voided ? (
                <ThemedText type="small" style={{ color: theme.error }}>
                  Anulada el {formatDateTime(detail.voidedAt!)}
                  {detail.voidReason ? ` · ${detail.voidReason}` : ''}
                </ThemedText>
              ) : null}
            </ThemedView>

            <ThemedView type="backgroundElement" style={[styles.card, Shadow.subtle]}>
              {detail.items.map((item) => (
                <View key={item.key} style={styles.line}>
                  <View style={styles.flex}>
                    <ThemedText type="small" numberOfLines={2}>
                      {item.name}
                    </ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {item.quantity} × {formatCOP(item.unitPrice)}
                    </ThemedText>
                  </View>
                  <ThemedText type="small">{formatCOP(item.subtotal)}</ThemedText>
                </View>
              ))}
              {detail.sellerId !== null && detail.commissionAmount > 0 ? (
                <>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <View style={styles.line}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Comisión del vendedor
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.primary }}>
                      {formatCOP(detail.commissionAmount)}
                    </ThemedText>
                  </View>
                </>
              ) : null}
              {detail.notes ? (
                <ThemedText type="caption" themeColor="textSecondary">
                  {detail.notes}
                </ThemedText>
              ) : null}
            </ThemedView>

            {!isSeller && !voided ? (
              detail.blocker ? (
                <ThemedText type="caption" themeColor="textSecondary">
                  {detail.blocker}
                </ThemedText>
              ) : confirming ? (
                <ThemedView type="backgroundElement" style={[styles.card, styles.actionCard, Shadow.subtle]}>
                  <ThemedText type="smallBold">{confirming === 'correct' ? '¿Anular y corregir esta venta?' : '¿Anular esta venta?'}</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {kind === 'direct'
                      ? 'Las unidades vuelven al inventario y el dinero sale de la caja.'
                      : 'Las unidades vuelven al inventario del vendedor y la venta no entra en su liquidación.'}
                    {confirming === 'correct' ? ' Después se abre una venta nueva con los mismos productos para registrarla bien.' : ''}
                  </ThemedText>
                  <FormInput value={reason} onChangeText={setReason} placeholder="Motivo (opcional)" maxLength={500} />
                  {error ? (
                    <ThemedText type="small" style={{ color: theme.error }}>
                      {error}
                    </ThemedText>
                  ) : null}
                  <View style={styles.buttons}>
                    <Pressable style={styles.flex} onPress={() => setConfirming(null)} disabled={saving}>
                      <View style={[styles.button, { borderColor: theme.border }]}>
                        <ThemedText type="default">Cancelar</ThemedText>
                      </View>
                    </Pressable>
                    <Pressable style={styles.flex} onPress={handleConfirm} disabled={saving}>
                      <View style={[styles.button, styles.filled, { backgroundColor: theme.error }, saving && styles.disabled]} collapsable={false}>
                        <ThemedText type="default" style={styles.onFilled}>
                          {saving ? 'Anulando…' : confirming === 'correct' ? 'Anular y corregir' : 'Anular'}
                        </ThemedText>
                      </View>
                    </Pressable>
                  </View>
                </ThemedView>
              ) : (
                <View style={styles.actions}>
                  {canCorrect ? (
                    <Pressable onPress={() => setConfirming('correct')}>
                      <View style={[styles.actionButton, { borderColor: withAlpha(theme.primary, 0.4) }]}>
                        <PencilLine color={theme.primary} size={18} />
                        <ThemedText type="default" style={{ color: theme.primary }}>
                          Corregir venta
                        </ThemedText>
                      </View>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => setConfirming('void')}>
                    <View style={[styles.actionButton, { borderColor: withAlpha(theme.error, 0.4) }]}>
                      <Ban color={theme.error} size={18} />
                      <ThemedText type="default" style={{ color: theme.error }}>
                        Anular venta
                      </ThemedText>
                    </View>
                  </Pressable>
                  {!canCorrect ? (
                    <ThemedText type="caption" themeColor="textSecondary" style={styles.center}>
                      La venta de un vendedor de tienda se anula aquí; si hay que registrarla de nuevo, la hace él desde su celular.
                    </ThemedText>
                  ) : null}
                </View>
              )
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  padded: { padding: Layout.screenPadding },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  scrollContent: { padding: Layout.screenPadding, gap: Layout.cardGap, paddingBottom: Spacing.six },
  card: { borderRadius: Radii.card, padding: Spacing.four, gap: Spacing.one },
  heroHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  chip: { borderRadius: Radii.chip, paddingHorizontal: Spacing.two, paddingVertical: 2 },
  struck: { textDecorationLine: 'line-through' },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.one },
  divider: { height: 1, marginVertical: Spacing.two },
  actionCard: { gap: Spacing.three },
  actions: { gap: Spacing.two },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderRadius: Radii.buttonPrimary,
    paddingVertical: Spacing.three,
  },
  buttons: { flexDirection: 'row', gap: Spacing.two },
  button: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Radii.buttonPrimary, borderWidth: 1 },
  filled: { borderWidth: 0 },
  onFilled: { color: '#FFFFFF' },
  disabled: { opacity: 0.5 },
});
