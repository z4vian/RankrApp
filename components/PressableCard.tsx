import React, { ReactNode, useRef } from 'react';
import {
  AccessibilityProps,
  Animated,
  Pressable,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useReducedMotion } from '@/lib/a11y';

export interface PressableCardProps extends AccessibilityProps {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  /** Press-down scale. 0.98 by default — subtle, doesn't feel laggy. */
  pressedScale?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A tap-responsive container that scales down slightly on press and back on
 * release. Designed to give list/feed/grid cards a tactile character without
 * overpowering the content. Falls back to no animation under reduced-motion.
 */
export function PressableCard({
  children,
  onPress,
  onLongPress,
  disabled = false,
  pressedScale = 0.98,
  style,
  ...a11yProps
}: PressableCardProps) {
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    if (reducedMotion) return;
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => animateTo(pressedScale)}
      onPressOut={() => animateTo(1)}
      disabled={disabled}
      accessibilityRole={a11yProps.accessibilityRole ?? 'button'}
      {...a11yProps}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
