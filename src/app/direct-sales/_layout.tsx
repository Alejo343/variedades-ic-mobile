import { Stack } from 'expo-router';

export default function DirectSalesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Ventas en local' }} />
      <Stack.Screen name="new" options={{ title: 'Nueva venta', presentation: 'modal' }} />
    </Stack>
  );
}
