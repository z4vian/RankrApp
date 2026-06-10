import React, { ReactNode, useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { useReducedMotion } from '@/lib/a11y';

export interface FadeSlideInProps {
  children: ReactNode;
  /** Stagger delay in ms — pass `index * 40` for a list reveal. */
  delay?: number;
  /** Animation duration in ms. Default 320. */
  duration?: number;
  /** Pixels to translate up from. Default 12. */
  fromY?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * One-shot entrance wrapper — fades in and translates up on mount.
 * Designed for list rows / cards. Re-renders do NOT re-animate. Respects
 * reduced-motion (renders immediately at the final position).
 *
 * Cap `delay` around 400ms when used in long lists — bigger staggers feel
 * laggy. If a list has 20+ items, only animate the first 10-15.
 */
export function FadeSlideIn({
  children,
  delay = 0,
  duration = 320,
  fromY = 12,
  style,
}: FadeSlideInProps) {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reducedMotion ? 0 : fromY)).current;

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
    // We deliberately only run this effect once (on mount). Re-running on
    // delay/duration changes would re-animate items already settled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}
