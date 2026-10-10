import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NewProductForm } from '@/components/new-product-form';
import { ThemedView } from '@/components/themed-view';

// Productos → Nuevo producto. The form itself is shared with Compras → Nuevo
// pedido (components/new-product-form.tsx).
export default function NewProductScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={[]}>
        <NewProductForm
          mode="catalog"
          submitLabel="Crear producto"
          onCreated={() => router.back()}
          onExisting={(product) => router.push(`/more/products/${product.id}`)}
          existingLabel={(product) => `Ir a editar ${product.name}`}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
