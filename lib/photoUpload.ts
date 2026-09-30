import * as Crypto from 'expo-crypto';
import { supabase, supabaseUrl } from '@/lib/supabase';
import { PHOTO_BUCKET, PHOTO_MAX_BYTES, PHOTO_PREFIX, PHOTO_TTL_SECONDS, isLocalPhoto, photoObjectPath } from './photoReferences';

export function storedPhotoPath(reference: string): string | null {
  return photoObjectPath(reference, supabaseUrl);
}
export async function uploadListItemPhoto(localUri: string, userId: string): Promise<string> {
  if (!isLocalPhoto(localUri)) throw new Error('Choose an image from your device.');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || user?.id !== userId) throw new Error('Sign in again before uploading.');
  const { data: ready, error: readinessError } = await supabase.rpc('rankr_private_photos_ready');
  if (readinessError || ready !== true) throw new Error('Private photo storage is not configured yet.');
  const response = await fetch(localUri);
  if (!response.ok) throw new Error('Could not read the selected image.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > PHOTO_MAX_BYTES) throw new Error('Choose an image smaller than 10 MB.');
  // Verify magic bytes rather than trusting a filename or forcing every file to JPEG.
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = [137,80,78,71,13,10,26,10].every((b,i) => bytes[i] === b);
  const webp = [82,73,70,70].every((b,i) => bytes[i] === b) && [87,69,66,80].every((b,i) => bytes[i+8] === b);
  const extension = jpeg ? 'jpg' : png ? 'png' : webp ? 'webp' : null;
  if (!extension) throw new Error('Choose a JPEG, PNG, or WebP image.');
  const path = `${userId}/${Crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, bytes.buffer, {
    contentType: jpeg ? 'image/jpeg' : `image/${extension}`, upsert: false, cacheControl: '0',
  });
  if (error) throw new Error('Could not upload the image. Please try again.');
  return PHOTO_PREFIX + path;
}
export async function resolvePhoto(reference: string): Promise<string | null> {
  if (isLocalPhoto(reference)) return reference;
  const path = storedPhotoPath(reference);
  if (!path) return null; // Never fall back to an old public URL or arbitrary remote host.
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, PHOTO_TTL_SECONDS);
  return error ? null : data?.signedUrl ?? null;
}
