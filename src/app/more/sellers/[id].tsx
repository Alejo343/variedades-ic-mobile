import { Link, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { productsRepo, sellersRepo } from '@/lib/data';
import { sellerSchema } from '@/lib/validations';

type InventoryLine = { productId: number; name: string; sku: string; quantity: number };

export default function EditSellerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sellerId = Number(id);
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [commissionType, setCommissionType] = useState<'percentage' | 'fixed_per_unit'>('percentage');
  const [commissionValue, setCommissionValue] = useState('');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);
  const [inventory, setInventory] = useState<InventoryLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
          setCommissionValue(String(seller.commissionValue));
          setNotes(seller.notes ?? '');
          setActive(seller.active);
        }
        setLoading(false);
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
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="small">Nombre</ThemedText>
          <TextInput value={name} onChangeText={setName} style={inputStyle} />

          <ThemedText type="small">Teléfono (opcional)</ThemedText>
          <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={inputStyle} />

          <ThemedText type="small">Ciudad (opcional)</ThemedText>
          <TextInput value={city} onChangeText={setCity} style={inputStyle} />

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

          <Link href={`/more/sellers/settlements/new?sellerId=${sellerId}`} asChild>
            <Pressable>
              <ThemedView type="backgroundElement" style={styles.submitButton}>
                <ThemedText>Liquidar</ThemedText>
              </ThemedView>
            </Pressable>
          </Link>

          {active ? (
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
