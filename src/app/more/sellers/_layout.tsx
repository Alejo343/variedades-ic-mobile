import { Stack } from 'expo-router';

export default function SellersLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Vendedores' }} />
      <Stack.Screen name="new" options={{ title: 'Nuevo vendedor', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Editar vendedor' }} />
      <Stack.Screen name="deliveries/index" options={{ title: 'Entregas a vendedores' }} />
      <Stack.Screen name="deliveries/new" options={{ title: 'Nueva entrega', presentation: 'modal' }} />
      <Stack.Screen name="sales/index" options={{ title: 'Ventas de vendedores' }} />
      <Stack.Screen name="sales/new" options={{ title: 'Nueva venta', presentation: 'modal' }} />
      <Stack.Screen name="returns/index" options={{ title: 'Devoluciones de vendedores' }} />
      <Stack.Screen name="returns/new" options={{ title: 'Nueva devolución', presentation: 'modal' }} />
      <Stack.Screen name="losses/index" options={{ title: 'Pérdidas de vendedores' }} />
      <Stack.Screen name="losses/new" options={{ title: 'Nueva pérdida', presentation: 'modal' }} />
      <Stack.Screen name="settlements/index" options={{ title: 'Liquidaciones' }} />
      <Stack.Screen name="settlements/new" options={{ title: 'Nueva liquidación', presentation: 'modal' }} />
      <Stack.Screen name="settlements/[id]" options={{ title: 'Liquidación' }} />
      <Stack.Screen name="commissions/new" options={{ title: 'Pagar comisiones', presentation: 'modal' }} />
    </Stack>
  );
}
