import { Image } from 'expo-image';
import { ImagePlus, Star, X } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addImage, type ImageDraft, removeImage, setPrimaryImage } from '@/lib/domain/product-images';
import { deleteProductImageFile, pickAndPersistProductImages } from '@/lib/images';
import { resolveImageUri } from '@/lib/sync/image-url';

type Props = {
  images: ImageDraft[];
  onChange: (images: ImageDraft[]) => void;
  onError: (message: string) => void;
  // URLs already saved in the database. Their files are deleted by
  // ProductsRepo once the save commits; any other removed photo was only
  // picked in this session, so its file is deleted right away.
  savedUrls?: ReadonlySet<string>;
};

const THUMB = 96;

// Draft gallery for the product form: add (multi-select), mark primary, remove.
// Changes only reach the database when the form is saved.
export function ProductImageGallery({ images, onChange, onError, savedUrls }: Props) {
  const theme = useTheme();

  async function handleAdd() {
    try {
      const uris = await pickAndPersistProductImages();
      onChange(uris.reduce(addImage, images));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'No se pudo seleccionar la imagen');
    }
  }

  function handleRemove(index: number) {
    const url = images[index].url;
    if (!savedUrls?.has(url)) deleteProductImageFile(url);
    onChange(removeImage(images, index));
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {images.map((image, index) => (
          <View key={image.url} style={styles.item}>
            <Image
              source={{ uri: resolveImageUri(image.url) }}
              style={[
                styles.thumb,
                image.isPrimary && { borderWidth: 3, borderColor: theme.primary },
              ]}
            />
            <Pressable
              onPress={() => handleRemove(index)}
              hitSlop={8}
              accessibilityLabel="Quitar foto"
              style={[styles.removeButton, { backgroundColor: withAlpha('#000000', 0.55) }]}>
              <X color="#FFFFFF" size={14} />
            </Pressable>
            <Pressable
              onPress={() => onChange(setPrimaryImage(images, index))}
              disabled={image.isPrimary}
              accessibilityLabel={image.isPrimary ? 'Foto principal' : 'Marcar como principal'}
              style={styles.primaryToggle}>
              <Star
                color={image.isPrimary ? theme.primary : theme.textSecondary}
                fill={image.isPrimary ? theme.primary : 'transparent'}
                size={14}
              />
              <ThemedText
                type="small"
                style={{ color: image.isPrimary ? theme.primary : theme.textSecondary }}>
                {image.isPrimary ? 'Principal' : 'Marcar'}
              </ThemedText>
            </Pressable>
          </View>
        ))}

        <Pressable onPress={handleAdd} accessibilityLabel="Agregar fotos">
          <View style={[styles.thumb, styles.addTile, { borderColor: theme.primary, backgroundColor: theme.primaryLight }]}>
            <ImagePlus color={theme.primary} size={26} />
            <ThemedText type="small" style={{ color: theme.primary }}>
              {images.length === 0 ? 'Agregar fotos' : 'Agregar'}
            </ThemedText>
          </View>
        </Pressable>
      </ScrollView>
      {images.length > 1 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Marca con la estrella la foto principal: es la que se muestra en listados y en la venta.
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.two, marginBottom: Spacing.three },
  row: { gap: Spacing.three, paddingVertical: Spacing.one },
  item: { width: THUMB, alignItems: 'center', gap: Spacing.one },
  thumb: { width: THUMB, height: THUMB, borderRadius: Spacing.three },
  removeButton: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addTile: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
});
