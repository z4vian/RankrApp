/**
 * Design tokens — single source of truth for the Rankr visual system.
 * Sourced from existing screens; do not introduce new values without team alignment.
 */

export const colors = {
  // surfaces
  bg: '#0f0f13',
  bgDeeper: '#13131a',
  card: '#1a1a24',
  cardElevated: '#1e1e2a',
  border: '#2a2a38',
  borderSoft: '#1e1e2e',

  // text
  text: '#ffffff',
  textSecondary: '#aaaaaa',
  textMuted: '#666666',
  textPlaceholder: '#555555',

  // brand
  purple: '#7C3AED',
  purpleLight: '#A78BFA',
  purpleSoft: '#7C3AED22', // 13% alpha — backgrounds for active states
  purpleDeep: '#5b1fdc',

  // semantic
  success: '#22c55e',
  warning: '#eab308',
  attention: '#f97316',
  error: '#ef4444',
  errorBg: '#2a1a1a',
  errorBorder: '#3a2020',
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
  caption: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  micro: { fontSize: 11, fontWeight: '700' as const, lineHeight: 14, letterSpacing: 1.5 },
} as const;

export const shadow = {
  sm: {
    shadowColor: colors.purple,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: colors.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: colors.purple,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;
