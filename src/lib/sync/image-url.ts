import { SYNC_BASE_URL } from './config';

// A product photo's stored `url` is either a local file:// URI (picked but
// not synced yet) or the relative path the server itself uses
// ("/uploads/products/x.webp") — same value on pull as on push, deliberately
// never rewritten to absolute at rest (sub-paso 13). Only rendering needs
// the full URL, so it's resolved here, at the one point that actually needs
// it — an <Image> `expo-image` already caches a remote uri to disk by
// default (`cachePolicy: 'disk'`), so this alone is what makes a synced
// photo show up offline after the first time it's loaded.
export function resolveImageUri(url: string): string {
  if (url.startsWith('file:') || url.startsWith('http:') || url.startsWith('https:')) return url;
  return `${SYNC_BASE_URL}${url}`;
}
