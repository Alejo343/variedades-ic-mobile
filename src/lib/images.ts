import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

// Lets the user pick one or more photos and copies each into the app's
// document directory — the picker's own cache URI isn't guaranteed to survive
// after the app restarts. Returns the persisted URIs in selection order
// (empty if cancelled).
export async function pickAndPersistProductImages(): Promise<string[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Se necesita permiso para acceder a las fotos');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    allowsMultipleSelection: true,
  });
  if (result.canceled) return [];

  const stamp = Date.now();
  const uris: string[] = [];
  for (const [i, asset] of result.assets.entries()) {
    const source = new File(asset.uri);
    const destination = new File(Paths.document, `product-${stamp}-${i}${source.extension || '.jpg'}`);
    await source.copy(destination);
    uris.push(destination.uri);
  }
  return uris;
}

// Best-effort cleanup of a persisted photo: a file that's already gone (or a
// URI outside our control) must never block saving the product.
export function deleteProductImageFile(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // ignore — an orphaned file only wastes space
  }
}
