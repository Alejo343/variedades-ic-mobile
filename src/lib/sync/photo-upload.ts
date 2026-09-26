import { File, UploadType } from 'expo-file-system';
import { eq, like } from 'drizzle-orm';
import { buildUpsertProductPayload } from '@/lib/data/local/products-repo';
import { db } from '@/lib/data/local/db';
import { productImages, products } from '@/lib/data/local/schema';
import { extractErrorMessage } from './api';
import { SYNC_BASE_URL } from './config';
import { enqueueOperation } from './outbox';

// Uploads every product photo still stuck on this device (sub-paso 13),
// called by engine.ts BEFORE push — a fresh upsertProduct payload can only
// carry `images` once none of them are a local file:// path anymore (see
// products-repo.ts#buildUpsertProductPayload). Runs product by product, in
// upload order per product; a failure stops that product (its already-
// uploaded photos stay uploaded — nothing is redone next time) but not the
// others, so one bad file doesn't block every other product's sync.

export type PhotoUploadSummary = { uploaded: number; productsSynced: number; error?: string };

const MIME_BY_EXTENSION: Record<string, string> = { '.png': 'image/png', '.webp': 'image/webp' };

async function uploadOne(token: string, uri: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const file = new File(uri);
  try {
    const result = await file.upload(`${SYNC_BASE_URL}/api/sync/upload`, {
      httpMethod: 'POST',
      uploadType: UploadType.MULTIPART,
      fieldName: 'file',
      mimeType: MIME_BY_EXTENSION[file.extension.toLowerCase()] ?? 'image/jpeg',
      headers: { Authorization: `Bearer ${token}` },
    });
    let body: unknown = null;
    try {
      body = JSON.parse(result.body);
    } catch {
      // Falls through to the generic message below — a non-JSON body only
      // happens on an unexpected server/proxy error, not a real success.
    }
    if (result.status < 200 || result.status >= 300) return { ok: false, error: extractErrorMessage(body) ?? 'No se pudo subir la foto' };
    return { ok: true, url: (body as { url: string }).url };
  } catch {
    return { ok: false, error: 'Sin conexión al subir la foto' };
  }
}

export async function uploadPendingProductPhotos(token: string): Promise<PhotoUploadSummary> {
  const pending = await db.select().from(productImages).where(like(productImages.url, 'file:%'));
  if (!pending.length) return { uploaded: 0, productsSynced: 0 };

  const productIds = [...new Set(pending.map((row) => row.productId))];
  let uploaded = 0;
  let productsSynced = 0;

  for (const productId of productIds) {
    const images = pending.filter((row) => row.productId === productId).sort((a, b) => a.displayOrder - b.displayOrder);
    let failure: string | undefined;

    for (const image of images) {
      const result = await uploadOne(token, image.url);
      if (!result.ok) {
        failure = result.error;
        break;
      }
      await db.update(productImages).set({ url: result.url }).where(eq(productImages.id, image.id));
      uploaded++;
    }

    if (!failure) {
      await db.transaction(async (tx) => {
        const product = await tx.query.products.findFirst({ where: eq(products.id, productId) });
        if (!product) return;
        // Re-reads the gallery (now all remote), same builder every repo
        // call uses — this is what actually turns "no images sent yet"
        // into a real upsertProduct carrying them.
        await enqueueOperation(tx, 'upsertProduct', await buildUpsertProductPayload(tx, product));
      });
      productsSynced++;
    } else {
      return { uploaded, productsSynced, error: failure };
    }
  }

  return { uploaded, productsSynced };
}
