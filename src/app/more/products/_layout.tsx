import { Stack } from 'expo-router';

export default function ProductsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Productos' }} />
      <Stack.Screen name="new" options={{ title: 'Nuevo producto', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Producto' }} />
      <Stack.Screen name="categories/index" options={{ title: 'Categorías' }} />
      <Stack.Screen name="categories/new" options={{ title: 'Nueva categoría', presentation: 'modal' }} />
      <Stack.Screen name="categories/[id]" options={{ title: 'Editar categoría' }} />
    </Stack>
  );
}
