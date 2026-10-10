import { Stack } from 'expo-router';

export default function CashLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Caja' }} />
      <Stack.Screen name="new" options={{ title: 'Registrar movimiento', presentation: 'modal' }} />
      <Stack.Screen name="transfer" options={{ title: 'Transferir entre cuentas', presentation: 'modal' }} />
      <Stack.Screen name="accounts/index" options={{ title: 'Cuentas' }} />
      <Stack.Screen name="accounts/new" options={{ title: 'Nueva cuenta', presentation: 'modal' }} />
      <Stack.Screen name="accounts/[id]" options={{ title: 'Editar cuenta' }} />
    </Stack>
  );
}
