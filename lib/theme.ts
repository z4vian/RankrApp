/**
 * Design tokens — single source of truth for the Rankr visual system.
 *
 * Token policy (read before adding new values):
 *
 *  - **Brand purple is scarce.** Use it for primary CTAs, brand chrome
 *    (logo, tab accent), and focus/glow halos. Avoid it for active states,
 *    soft chips, and decorative backgrounds — those should use neutral
 *    surfaces (`cardElevated`) or `purpleSoft` so the primary action stays
 *    visually dominant.
 *
 *  - **Depth = black; glow = purple.** Real elevation is communicated with
 *    black shadows (`shadow.sm/md/lg`). Purple halos are a separate token
 *    (`glow.purple` / `glow.purpleStrong`) used for focused CTAs and inputs.
 *    Don't mix the two — a card doesn't need a purple halo.
 *
 *  - **Three surface tiers.** `bg` → `card` → `cardElevated`. Use
 *    `cardElevated` for cards-on-cards, sheet bodies, modal surfaces.
 *
 *  - **Sentiment ramp is theme-owned.** Anywhere you color a rank or
 *    sentiment, pull from `colors.sentiment.*`. No inline hex.
 */

export const colors = {
  // ---- Surfaces (three-tier elevation) ----
  bg: '#0f0f13',           // root background
  bgDeeper: '#13131a',     // chrome (tab bar, header rails)
  card: '#1a1a24',         // primary card surface
  cardElevated: '#22222e', // cards-on-cards, sheet bodies, modals
  overlay: '#15151e',      // floating modals over scrim

  // ---- Borders (hierarchy) ----
  border: '#2a2a38',       // primary dividers, surface boundaries
  borderSoft: '#1e1e2e',   // inline dividers, nested-card borders
  borderStrong: '#3a3a4d', // emphasized borders (selected, focused fallback)

  // ---- Text ----
  text: '#ffffff',
  textSecondary: '#aaaaaa',
  textMuted: '#777777',    // bumped from #666 — old value was hard to read
  textPlaceholder: '#555555',

  // ---- Brand ----
  purple: '#7C3AED',
  purpleLight: '#A78BFA',
  purpleSoft: '#7C3AED22', // 13% alpha — backgrounds for soft chips/active states
  purpleDeep: '#5b1fdc',

  // ---- Semantic ----
  success: '#22c55e',
  warning: '#eab308',
  attention: '#f97316',
  error: '#ef4444',
  errorBg: '#2a1a1a',
  errorBorder: '#3a2020',

  // ---- Sentiment ramp (rating / score scale) ----
  // Mint → warm → red. Used by `scoreColor()` and any rank-tinted UI.
  // Each tone has a foreground variant for solid text on dark surface and
  // a soft variant for muted chips/backgrounds.
  sentiment: {
    loved: '#34d399',        // mint — 4-5 range
    lovedSoft: '#34d39933',  // 20% alpha
    liked: '#a3e635',        // lime — 3-4 range
    likedSoft: '#a3e63533',
    meh: '#9ca3af',          // neutral gray — middling
    mehSoft: '#9ca3af33',
    disliked: '#fb923c',     // warm orange — 1-2 range
    dislikedSoft: '#fb923c33',
    hated: '#ef4444',        // red — 0-1 range
    hatedSoft: '#ef444433',
  },

  // ---- Photo / image affordances ----
  // Hairline border for media (posters, avatars, album covers) so they
  // separate from dark surfaces without adding chrome.
  imageBorder: 'rgba(255,255,255,0.08)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

export const typography = {
  h1: { fontSize: 32, fontWeight: '700' as const, lineHeight: 38 },
  h2: { fontSize: 26, fontWeight: '700' as const, lineHeight: 32 },
  h3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 26 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyBold: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  small: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  caption: { fontSize: 13, fontWeight: '500' as const, lineHeight: 17 },
  micro: { fontSize: 12, fontWeight: '700' as const, lineHeight: 16, letterSpacing: 1.5 },
} as const;

/**
 * Numeric: monospaced figures so digits don't jiggle when values change.
 * Spread into a Text style: `{ ...typography.body, ...tabular }`.
 *
 * Kept outside the typography `as const` block so the inner array stays
 * mutable — react-native's TextStyle expects a mutable `FontVariant[]`.
 */
import type { TextStyle } from 'react-native';
export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

/**
 * Elevation shadows — BLACK based for genuine depth on dark surfaces.
 * Purple halos live separately in `glow.*` so cards don't get tinted.
 */
export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 12,
  },
} as const;

/**
 * Brand halos — purple-tinted glow for focused inputs and primary CTAs.
 * NEVER use on plain cards. Compose with `shadow.*` when you want both
 * elevation and a brand halo (e.g. the main "Sign up" button).
 */
export const glow = {
  purple: {
    shadowColor: colors.purple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 0,
  },
  purpleStrong: {
    shadowColor: colors.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 0,
  },
} as const;

/**
 * Score-to-sentiment color resolver. Maps a 0-10 rank to one of the
 * sentiment tones. Centralizes what was previously duplicated as inline
 * hex across profile, lists, list-item, and compare screens.
 */
export function scoreColor(rank: number | null | undefined): string {
  if (rank == null) return colors.sentiment.meh;
  if (rank >= 8) return colors.sentiment.loved;
  if (rank >= 6) return colors.sentiment.liked;
  if (rank >= 4) return colors.sentiment.disliked;
  return colors.sentiment.hated;
}

/**
 * Sentiment-key color resolver. For categorical sentiment values stored on
 * list items: `liked` / `didnt_care` / `didnt_like`. Returns brand purple
 * for unknown/empty.
 */
export function sentimentColor(s: string | null | undefined): string {
  if (s === 'liked') return colors.sentiment.loved;
  if (s === 'didnt_care') return colors.sentiment.meh;
  if (s === 'didnt_like') return colors.sentiment.hated;
  return colors.purple;
}
