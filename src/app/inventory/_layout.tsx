import { Stack } from 'expo-router';

export default function InventoryLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Inventario' }} />
      <Stack.Screen name="adjust" options={{ title: 'Ajustar stock', presentation: 'modal' }} />
      <Stack.Screen name="backup" options={{ title: 'Respaldo' }} />
    </Stack>
  );
}
