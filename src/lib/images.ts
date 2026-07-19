import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

// Copies the picked photo into the app's document directory — the picker's
// own cache URI isn't guaranteed to survive after the app restarts.
export async function pickAndPersistProductImage(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Se necesita permiso para acceder a las fotos');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
  });
  if (result.canceled || !result.assets[0]) return null;

  const source = new File(result.assets[0].uri);
  const destination = new File(Paths.document, `product-${Date.now()}${source.extension || '.jpg'}`);
  await source.copy(destination);
  return destination.uri;
}
