import { Stack } from 'expo-router';

export default function SellLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Vender' }} />
      <Stack.Screen name="history" options={{ title: 'Historial de ventas' }} />
    </Stack>
  );
}
