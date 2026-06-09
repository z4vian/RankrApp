/**
 * lib/a11y.ts
 *
 * Accessibility utilities. `useReducedMotion()` subscribes to OS-level
 * reduce-motion settings so animations can be skipped or shortened when the
 * user has requested it (iOS: Settings > Accessibility > Motion; Android:
 * Settings > Accessibility > Remove animations; Web: prefers-reduced-motion).
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (v) => {
        if (mounted) setReduced(v);
      }
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
