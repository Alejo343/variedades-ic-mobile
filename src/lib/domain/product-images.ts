// Pure rules for a product's photo gallery, shared by the edit screen (which
// works on a draft list) and ProductsRepo (which normalizes before saving).
//
// Contract:
// - The list's order IS the display order (index 0 shows first).
// - Invariant: an empty list has no primary; a non-empty list has exactly
//   one image with isPrimary = true.
// - Every function returns a new array and never mutates its input.
// - Out-of-range indexes are a no-op (the list comes back unchanged).

export type ImageDraft = {
  url: string;
  isPrimary: boolean;
};

// Enforces the invariant: keeps the first primary found, or promotes the
// first image when none is marked.
export function normalizeImages(images: ImageDraft[]): ImageDraft[] {
  const primaryIndex = Math.max(0, images.findIndex((image) => image.isPrimary));
  return images.map((image, i) => ({ ...image, isPrimary: i === primaryIndex }));
}

// Appends a photo at the end; it only becomes primary if it's the first one.
export function addImage(images: ImageDraft[], url: string): ImageDraft[] {
  return [...images, { url, isPrimary: images.length === 0 }];
}

// Removes the photo at `index`; if it was the primary, the first remaining
// photo takes its place.
export function removeImage(images: ImageDraft[], index: number): ImageDraft[] {
  if (index < 0 || index >= images.length) return images;
  return normalizeImages(images.filter((_, i) => i !== index));
}

// Marks the photo at `index` as the only primary.
export function setPrimaryImage(images: ImageDraft[], index: number): ImageDraft[] {
  if (index < 0 || index >= images.length) return images;
  return images.map((image, i) => ({ ...image, isPrimary: i === index }));
}

// The URL to use as a thumbnail: the primary, else the first, else null.
export function primaryImageUrl(images: ImageDraft[]): string | null {
  return (images.find((image) => image.isPrimary) ?? images[0])?.url ?? null;
}
