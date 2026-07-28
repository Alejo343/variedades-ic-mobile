import { Stack } from 'expo-router';

export default function PurchasesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Compras' }} />
      <Stack.Screen name="new" options={{ title: 'Nuevo pedido', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Pedido' }} />
      <Stack.Screen name="distributors/index" options={{ title: 'Distribuidores' }} />
      <Stack.Screen name="distributors/new" options={{ title: 'Nuevo distribuidor', presentation: 'modal' }} />
      <Stack.Screen name="distributors/[id]" options={{ title: 'Editar distribuidor' }} />
      <Stack.Screen name="payments/new" options={{ title: 'Registrar pago', presentation: 'modal' }} />
    </Stack>
  );
}
