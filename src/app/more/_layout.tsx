import { Stack } from 'expo-router';

export default function MoreLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Más' }} />
      <Stack.Screen name="products" options={{ headerShown: false }} />
      <Stack.Screen name="inventory" options={{ headerShown: false }} />
      <Stack.Screen name="cash" options={{ headerShown: false }} />
      <Stack.Screen name="sellers" options={{ headerShown: false }} />
      <Stack.Screen name="purchases" options={{ headerShown: false }} />
      <Stack.Screen name="reports" options={{ title: 'Reportes' }} />
      <Stack.Screen name="settings" options={{ title: 'Configuración' }} />
    </Stack>
  );
}
