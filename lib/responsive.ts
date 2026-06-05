/**
 * lib/responsive.ts
 *
 * Breakpoint constants and a lightweight `useResponsive()` hook built on
 * React Native's `useWindowDimensions`.  Safe to call on both native and web
 * (useWindowDimensions is cross-platform).
 */

import { useWindowDimensions } from 'react-native';

// ---------------------------------------------------------------------------
// Breakpoints (px — same units react-native-web uses for window width)
// ---------------------------------------------------------------------------

export const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface ResponsiveState {
  width: number;
  height: number;
  /** The *current* named breakpoint bucket. */
  breakpoint: Breakpoint;
  /** width < 768 */
  isMobile: boolean;
  /** 768 <= width < 1024 */
  isTablet: boolean;
  /** 1024 <= width < 1440 */
  isDesktop: boolean;
  /** width >= 1440 */
  isWide: boolean;
}

export function useResponsive(): ResponsiveState {
  const { width, height } = useWindowDimensions();

  const isMobile = width < BREAKPOINTS.tablet;
  const isTablet = width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop;
  const isDesktop = width >= BREAKPOINTS.desktop && width < BREAKPOINTS.wide;
  const isWide = width >= BREAKPOINTS.wide;

  let breakpoint: Breakpoint;
  if (isWide) {
    breakpoint = 'wide';
  } else if (isDesktop) {
    breakpoint = 'desktop';
  } else if (isTablet) {
    breakpoint = 'tablet';
  } else {
    breakpoint = 'mobile';
  }

  return { width, height, breakpoint, isMobile, isTablet, isDesktop, isWide };
}
