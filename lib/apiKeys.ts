/**
 * lib/apiKeys.ts
 *
 * Centralized API keys, sourced from environment variables.
 * Set these in `.env` at the project root (see `.env.example`).
 *
 * Note: `EXPO_PUBLIC_*` vars are inlined into the client bundle by Metro at
 * build time, so they are NOT truly secret — they ship to every device that
 * runs the app. They live in env files for swap-by-environment convenience
 * (dev / staging / prod) and to keep the repo clean. For real secrets, route
 * the request through a backend proxy.
 */

/**
 * Resolve an env var or log a warning. Returns empty string on miss so that
 * downstream `fetch` calls fail with a recognizable URL (the third-party API
 * will return a 401 / 400) rather than crashing the app at import time.
 */
const requireKey = (name: string, value: string | undefined): string => {
  if (!value) {
    console.warn(`[apiKeys] Missing ${name}. Set it in .env (see .env.example).`);
    return '';
  }
  return value;
};

export const TMDB_API_KEY = requireKey(
  'EXPO_PUBLIC_TMDB_API_KEY',
  process.env.EXPO_PUBLIC_TMDB_API_KEY
);

export const RAWG_API_KEY = requireKey(
  'EXPO_PUBLIC_RAWG_API_KEY',
  process.env.EXPO_PUBLIC_RAWG_API_KEY
);
