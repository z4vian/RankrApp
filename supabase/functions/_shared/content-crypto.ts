/** AES-256-GCM via Web Crypto. Keys never leave the server. Not end-to-end encryption. */
export const MAX_CONTENT_BYTES = 64 * 1024;
export type Context = { ownerId: string; id: string; contentType: string };
export type Envelope = { ciphertext: string; iv: string; key_id: string; format_version: 1 };
export type Keyring = { activeId: string; keys: Record<string, CryptoKey> };
const encoder = new TextEncoder();
function toBase64(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}
export async function loadKeyring(raw: string, activeId: string): Promise<Keyring> {
  const values = JSON.parse(raw);
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Invalid keyring');
  const keys: Record<string, CryptoKey> = Object.create(null);
  for (const [id, value] of Object.entries(values)) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) || typeof value !== 'string') throw new Error('Invalid keyring');
    const bytes = fromBase64(value);
    if (bytes.length !== 32 || toBase64(bytes) !== value) throw new Error('Expected a canonical base64 256-bit key');
    keys[id] = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
    bytes.fill(0);
  }
  if (!Object.hasOwn(keys, activeId)) throw new Error('Active key unavailable');
  return { activeId, keys };
}
function aad(context: Context): Uint8Array<ArrayBuffer> {
  return encoder.encode(JSON.stringify(['rankr-content', 1, context.ownerId, context.id, context.contentType]));
}
export async function encryptContent(payload: unknown, context: Context, keyring: Keyring): Promise<Envelope> {
  const json = JSON.stringify(payload);
  if (json === undefined) throw new Error('Invalid JSON payload');
  const plaintext = encoder.encode(json);
  if (plaintext.length > MAX_CONTENT_BYTES) throw new Error('Content too large');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  try {
    const result = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(context), tagLength: 128 }, keyring.keys[keyring.activeId], plaintext);
    return { ciphertext: toBase64(new Uint8Array(result)), iv: toBase64(iv), key_id: keyring.activeId, format_version: 1 };
  } finally { plaintext.fill(0); }
}
export async function decryptContent(envelope: Envelope, context: Context, keyring: Keyring): Promise<unknown> {
  if (envelope.format_version !== 1 || !Object.hasOwn(keyring.keys, envelope.key_id)) throw new Error('Unsupported envelope');
  const iv = fromBase64(envelope.iv);
  if (iv.length !== 12) throw new Error('Invalid nonce');
  const plaintext = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aad(context), tagLength: 128 }, keyring.keys[envelope.key_id], fromBase64(envelope.ciphertext)));
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext)); }
  finally { plaintext.fill(0); }
}
