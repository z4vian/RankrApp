/**
 * lib/recommendationsCache.ts
 *
 * 24-hour TTL cache for the "For You" recommendation feeds.
 *
 * Storage backend:
 *  - Native (iOS/Android): @react-native-async-storage/async-storage
 *  - Web / SSR: no-op shim (AsyncStorage throws during static render and
 *    is not available in browser environments for this project — we avoid
 *    top-level AsyncStorage access entirely to preserve the existing SSR fix)
 *
 * Cached envelope: JSON string of { items: RecItem[], timestamp: number }
 *
 * Key namespaces:
 *  - Per-category (legacy v1): `rankr.foryou.cache.<category>`
 *  - Per-list (v2):            `rankr.foryou.cache.list.<listId>`
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { RecItem, RecCategory } from '@/lib/recommendations';

// ---------------------------------------------------------------------------
// Storage shim — never call AsyncStorage at the top level (SSR safety)
// ---------------------------------------------------------------------------

type StorageShim = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  getAllKeys: () => Promise<readonly string[]>;
  multiRemove: (keys: string[]) => Promise<void>;
};

const noopStorage: StorageShim = {
  getItem: async (_key: string) => null,
  setItem: async (_key: string, _value: string) => {},
  removeItem: async (_key: string) => {},
  getAllKeys: async () => [],
  multiRemove: async (_keys: string[]) => {},
};

/** Lazily resolved at call-time so no top-level Platform check runs during SSR. */
function getStorage(): StorageShim {
  if (Platform.OS === 'web') return noopStorage;
  return AsyncStorage;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Key for legacy per-category cache (v1 backward compat). */
const KEY = (category: string) => `rankr.foryou.cache.${category}`;

/** Key prefix for per-list cache (v2). */
const LIST_KEY_PREFIX = 'rankr.foryou.cache.list.';

/** Key for a specific list's cache entry. */
const LIST_KEY = (listId: string) => `${LIST_KEY_PREFIX}${listId}`;

// ---------------------------------------------------------------------------
// Cache envelope type
// ---------------------------------------------------------------------------

interface CacheEnvelope {
  items: RecItem[];
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Retrieve cached recommendations for a category.
 * Returns `null` if the cache is missing or older than 24 hours.
 */
export async function getCachedRecs(
  category: RecCategory
): Promise<RecItem[] | null> {
  try {
    const storage = getStorage();
    const raw = await storage.getItem(KEY(category));
    if (!raw) return null;

    const envelope: CacheEnvelope = JSON.parse(raw);
    if (!envelope || !Array.isArray(envelope.items)) return null;

    if (Date.now() - envelope.timestamp > TTL_MS) {
      // Stale — clean it up in the background, return null
      storage.removeItem(KEY(category)).catch(() => {});
      return null;
    }

    return envelope.items;
  } catch (err) {
    console.error('[getCachedRecs]', err);
    return null;
  }
}

/**
 * Persist recommendations for a category with the current timestamp.
 * Silently no-ops on web.
 */
export async function setCachedRecs(
  category: RecCategory,
  items: RecItem[]
): Promise<void> {
  try {
    const storage = getStorage();
    const envelope: CacheEnvelope = { items, timestamp: Date.now() };
    await storage.setItem(KEY(category), JSON.stringify(envelope));
  } catch (err) {
    console.error('[setCachedRecs]', err);
  }
}

/**
 * Invalidate (delete) the cached recommendations for a category.
 * Call this after the user ranks or adds new items so the feed refreshes.
 */
export async function invalidateRecsCache(
  category: RecCategory
): Promise<void> {
  try {
    const storage = getStorage();
    await storage.removeItem(KEY(category));
  } catch (err) {
    console.error('[invalidateRecsCache]', err);
  }
}

// ---------------------------------------------------------------------------
// Per-list cache (v2 "For You" per-list feed)
// Key format: rankr.foryou.cache.list.<listId>
// ---------------------------------------------------------------------------

/**
 * Retrieve cached recommendations for a specific list.
 * Returns `null` if the cache is missing or older than 24 hours.
 *
 * @param listId  UUID of the list.
 */
export async function getCachedRecsForList(listId: string): Promise<RecItem[] | null> {
  try {
    const storage = getStorage();
    const raw = await storage.getItem(LIST_KEY(listId));
    if (!raw) return null;

    const envelope: CacheEnvelope = JSON.parse(raw);
    if (!envelope || !Array.isArray(envelope.items)) return null;

    if (Date.now() - envelope.timestamp > TTL_MS) {
      // Stale — clean it up in the background, return null
      storage.removeItem(LIST_KEY(listId)).catch(() => {});
      return null;
    }

    return envelope.items;
  } catch (err) {
    console.error('[getCachedRecsForList]', listId, err);
    return null;
  }
}

/**
 * Persist recommendations for a specific list with the current timestamp.
 * Silently no-ops on web.
 *
 * @param listId  UUID of the list.
 * @param items   Recommendation items to cache.
 */
export async function setCachedRecsForList(listId: string, items: RecItem[]): Promise<void> {
  try {
    const storage = getStorage();
    const envelope: CacheEnvelope = { items, timestamp: Date.now() };
    await storage.setItem(LIST_KEY(listId), JSON.stringify(envelope));
  } catch (err) {
    console.error('[setCachedRecsForList]', listId, err);
  }
}

/**
 * Invalidate (delete) the cached recommendations for a specific list.
 * Call this after the user ranks or adds new items to the list.
 *
 * @param listId  UUID of the list.
 */
export async function invalidateRecsCacheForList(listId: string): Promise<void> {
  try {
    const storage = getStorage();
    await storage.removeItem(LIST_KEY(listId));
  } catch (err) {
    console.error('[invalidateRecsCacheForList]', listId, err);
  }
}

/**
 * Wipe ALL per-list cache entries.
 * Use on logout or when the user triggers a manual "refresh all" action.
 *
 * On web this is a no-op (matches the existing shim behaviour).
 */
export async function invalidateAllListRecsCache(): Promise<void> {
  try {
    const storage = getStorage();
    const allKeys = await storage.getAllKeys();
    const listKeys = (allKeys as string[]).filter((k) => k.startsWith(LIST_KEY_PREFIX));
    if (listKeys.length > 0) {
      await storage.multiRemove(listKeys);
    }
  } catch (err) {
    console.error('[invalidateAllListRecsCache]', err);
  }
}
