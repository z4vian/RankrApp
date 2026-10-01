/** Web-first guest drafts: local, unencrypted, retained for seven days. No network. */
export type GuestCategory = 'movies' | 'tv' | 'games' | 'music' | 'books';
export type GuestDraftItem = { id: string; title: string; subtitle?: string; image_url?: string; external_id?: string; notes?: string };
export type GuestDraft = { version: 1; id: string; title: string; category: GuestCategory; items: GuestDraftItem[]; updatedAt: number };
export const GUEST_DRAFT_MAX_ITEMS = 20;
export const GUEST_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const KEY = 'rankr.guest-draft.v1';
const categories = new Set(['movies', 'tv', 'games', 'music', 'books']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let memory: GuestDraft | null = null;
let memoryOnly = false;
function storage(): Storage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; }
}
export function isGuestDraftPersistenceAvailable(): boolean {
  const target = storage();
  if (!target || memoryOnly) return false;
  try { const probe = `${KEY}.probe`; target.setItem(probe, '1'); target.removeItem(probe); return true; } catch { return false; }
}
function validImage(value: string): boolean {
  if (/^\/media\/[A-Za-z0-9/_.,%-]+$/.test(value) && !value.includes('..') && !/%(?:2e|2f|5c)/i.test(value)) return true;
  try { const parsed = new URL(value); return parsed.protocol === 'https:' && !!parsed.hostname && !parsed.username && !parsed.password; } catch { return false; }
}
/** Shared validation for local drafts and the import boundary; SQL validates again. */
export function validateGuestDraft(value: unknown): GuestDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid guest draft.');
  const draft = value as GuestDraft;
  if (draft.version !== 1 || typeof draft.id !== 'string' || !uuid.test(draft.id) || typeof draft.title !== 'string' || !draft.title.trim() || draft.title.length > 200 || !categories.has(draft.category) || !Number.isSafeInteger(draft.updatedAt) || draft.updatedAt < 0 || !Array.isArray(draft.items) || draft.items.length > GUEST_DRAFT_MAX_ITEMS) throw new Error('Invalid guest draft.');
  const ids = new Set<string>();
  const items = draft.items.map(item => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !uuid.test(item.id) || ids.has(item.id.toLowerCase()) || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 200) throw new Error('Invalid guest item.');
    ids.add(item.id.toLowerCase());
    const result: GuestDraftItem = { id: item.id.toLowerCase(), title: item.title.trim() };
    for (const [field, max] of [['subtitle', 300], ['external_id', 200], ['notes', 4000], ['image_url', 2048]] as const) {
      const text = item[field];
      if (text !== undefined) {
        if (typeof text !== 'string' || text.length > max || text.includes('\u0000') || (field === 'image_url' && text !== '' && !validImage(text))) throw new Error(`Invalid guest ${field}.`);
        result[field] = text;
      }
    }
    if (result.title.includes('\u0000')) throw new Error('Invalid guest title.');
    return result;
  });
  const result: GuestDraft = { version: 1, id: draft.id.toLowerCase(), title: draft.title.trim(), category: draft.category, items, updatedAt: draft.updatedAt };
  if (result.title.includes('\u0000') || new TextEncoder().encode(JSON.stringify(result)).length > 128 * 1024) throw new Error('Guest draft is too large.');
  return result;
}
export function getGuestDraft(): GuestDraft | null {
  let value: unknown = memory;
  if (!memoryOnly) {
    try { const raw = storage()?.getItem(KEY); if (raw != null) value = JSON.parse(raw); } catch { memoryOnly = true; }
  }
  if (!value) return null;
  try {
    const draft = validateGuestDraft(value);
    if (Date.now() - draft.updatedAt > GUEST_DRAFT_TTL_MS || draft.updatedAt > Date.now() + 60000) { clearGuestDraft(); return null; }
    memory = draft;
    return JSON.parse(JSON.stringify(draft)) as GuestDraft;
  } catch { clearGuestDraft(); return null; }
}
export function saveGuestDraft(draft: GuestDraft): void {
  const valid = validateGuestDraft({ ...draft, updatedAt: Date.now() });
  memory = valid;
  try {
    const target = storage();
    if (!target) { memoryOnly = true; return; }
    target.setItem(KEY, JSON.stringify(valid)); memoryOnly = false;
  } catch { memoryOnly = true; }
}
export function clearGuestDraft(): void {
  memory = null;
  try { storage()?.removeItem(KEY); } catch { memoryOnly = true; }
}
export function createGuestDraft(category: GuestCategory, title: string): GuestDraft {
  // Keep Expo native modules out of web/Node initialization; native drafts
  // remain memory-only even though UUID creation works on both platforms.
  let id: string;
  try {
    id = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : (require('expo-crypto') as typeof import('expo-crypto')).randomUUID();
  } catch {
    throw new Error('Could not start your guest list. Please try again or use the web app.');
  }
  return validateGuestDraft({ version: 1, id, title, category, items: [], updatedAt: Date.now() });
}
