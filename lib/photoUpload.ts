/**
 * lib/photoUpload.ts
 * Helper for uploading local image URIs to Supabase Storage and returning
 * a permanent public URL.
 *
 * Bucket: `list-item-photos`
 * NOTE: You must create this bucket in the Supabase dashboard (Storage →
 * New bucket → name: "list-item-photos" → Public: true) before using this
 * helper.
 *
 * Works on iOS, Android, and web.
 */

import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const BUCKET = 'list-item-photos';

/**
 * Generate a random alphanumeric suffix for unique filenames.
 */
function randomSuffix(length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Upload a local image URI to Supabase Storage and return its public URL.
 *
 * @param localUri  A `file://` URI from expo-image-picker (iOS/Android) or a
 *                  `blob:` URL (web). HTTP/HTTPS URLs are also accepted.
 * @param userId    The authenticated user's UUID — used as the path prefix so
 *                  that each user's uploads are isolated.
 * @returns         The permanent public HTTPS URL for the uploaded image.
 * @throws          Error with a descriptive message on any failure.
 *
 * Usage example:
 *   import { uploadListItemPhoto } from '@/lib/photoUpload';
 *   const publicUrl = await uploadListItemPhoto(localUri, user.id);
 *   // Store publicUrl in list_items.photo_urls
 */
export async function uploadListItemPhoto(
  localUri: string,
  userId: string
): Promise<string> {
  // ── 1. Derive a unique storage path ──────────────────────────────────────
  const fileName = `${userId}/${Date.now()}-${randomSuffix()}.jpg`;

  // ── 2. Convert the URI to a Blob ──────────────────────────────────────────
  // On native (iOS/Android) `localUri` is a `file://` path — fetch() handles it.
  // On web it may already be a `blob:` URL or a data: URL — fetch() handles both.
  let blob: Blob;
  try {
    const response = await fetch(localUri);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: HTTP ${response.status}`);
    }
    blob = await response.blob();
  } catch (err) {
    throw new Error(
      `[uploadListItemPhoto] Could not read local image at "${localUri}": ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  // ── 3. On native, Supabase JS client's storage upload can use the Blob directly.
  //       On web, ArrayBuffer is more reliable across Supabase SDK versions.
  let uploadBody: Blob | ArrayBuffer = blob;
  if (Platform.OS === 'web') {
    try {
      uploadBody = await blob.arrayBuffer();
    } catch {
      // Fall back to blob if arrayBuffer() is unavailable
      uploadBody = blob;
    }
  }

  // ── 4. Upload to Supabase Storage ─────────────────────────────────────────
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, uploadBody, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(
      `[uploadListItemPhoto] Storage upload failed: ${uploadError.message}`
    );
  }

  // ── 5. Get the permanent public URL ───────────────────────────────────────
  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(fileName);

  if (!urlData?.publicUrl) {
    throw new Error(
      '[uploadListItemPhoto] Could not retrieve public URL after upload.'
    );
  }

  return urlData.publicUrl;
}
