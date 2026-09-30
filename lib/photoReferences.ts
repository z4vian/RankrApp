/** Durable references contain no bearer token. Legacy URLs resolve only for our project. */
export const PHOTO_BUCKET = 'list-item-photos';
export const PHOTO_PREFIX = `storage://${PHOTO_BUCKET}/`;
export const PHOTO_TTL_SECONDS = 120;
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export function photoObjectPath(reference: string, projectUrl: string): string | null {
  let path: string;
  if (reference.startsWith(PHOTO_PREFIX)) path = reference.slice(PHOTO_PREFIX.length);
  else {
    try {
      const url = new URL(reference);
      const project = new URL(projectUrl);
      const prefix = `/storage/v1/object/public/${PHOTO_BUCKET}/`;
      if (url.origin !== project.origin || !url.pathname.startsWith(prefix) || url.search || url.hash) return null;
      path = decodeURIComponent(url.pathname.slice(prefix.length));
    } catch { return null; }
  }
  return /^[0-9a-f-]{36}\/[A-Za-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(path) ? path : null;
}
export function isLocalPhoto(uri: string): boolean {
  return /^(file:|content:|blob:|data:image\/(?:jpeg|png|webp);base64,)/i.test(uri);
}
