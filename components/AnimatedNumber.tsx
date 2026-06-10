import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleProp,
  Text,
  TextStyle,
} from 'react-native';
import { useReducedMotion } from '@/lib/a11y';

export interface AnimatedNumberProps {
  /** The target value to display. Counter tweens from current → this. */
  value: number;
  /** Animation duration in ms. Default 700. */
  duration?: number;
  /** Number of decimal places. Default 0 (integer). */
  decimals?: number;
  /** Optional formatter — receives the in-flight value, returns the string to render. */
  format?: (n: number) => string;
  style?: StyleProp<TextStyle>;
}

/**
 * Smoothly counts up (or down) to its `value` prop with an ease-out curve.
 * Reduced-motion users see the final value immediately. Render-cost is bound
 * to ~60 setState calls over the animation duration (one per frame).
 */
export function AnimatedNumber({
  value,
  duration = 700,
  decimals = 0,
  format,
  style,
}: AnimatedNumberProps) {
  const reducedMotion = useReducedMotion();
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState<number>(reducedMotion ? value : 0);
  const lastValue = useRef<number>(reducedMotion ? value : 0);

  useEffect(() => {
    if (reducedMotion) {
      setDisplay(value);
      lastValue.current = value;
      return;
    }
    const from = lastValue.current;
    const to = value;
    anim.setValue(0);
    const listenerId = anim.addListener(({ value: progress }) => {
      setDisplay(from + (to - from) * progress);
    });
    Animated.timing(anim, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // we need JS-side listener for setState
    }).start(() => {
      lastValue.current = to;
    });
    return () => {
      anim.removeListener(listenerId);
    };
  }, [value, duration, reducedMotion, anim]);

  const text = format ? format(display) : display.toFixed(decimals);
  return <Text style={style}>{text}</Text>;
}
