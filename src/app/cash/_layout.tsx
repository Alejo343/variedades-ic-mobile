import { Stack } from 'expo-router';

export default function CashLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Caja' }} />
      <Stack.Screen name="new" options={{ title: 'Registrar movimiento', presentation: 'modal' }} />
    </Stack>
  );
}
