import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, shadow, spacing, typography } from '@/lib/theme';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastProps {
  message: string;
  tone?: ToastTone;
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
}

const TONE_DOT: Record<ToastTone, string> = {
  success: colors.success,
  error: colors.error,
  info: colors.purpleLight,
};

/** Single toast pill — colored leading dot + message; spring-in on mount, dismissable on tap. */
export function Toast({ message, tone = 'info', onDismiss, style }: ToastProps) {
  const translateY = useRef(new Animated.Value(20)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 8,
        speed: 14,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, opacity]);

  const content = (
    <Animated.View
      style={[
        styles.toast,
        shadow.md,
        { transform: [{ translateY }], opacity },
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: TONE_DOT[tone] }]} />
      <Text style={styles.message} numberOfLines={3}>{message}</Text>
    </Animated.View>
  );

  if (onDismiss) {
    return (
      <TouchableOpacity
        onPress={onDismiss}
        activeOpacity={0.85}
        style={styles.touchable}
      >
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={styles.touchable}>{content}</View>;
}

const styles = StyleSheet.create({
  touchable: {
    width: '100%',
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    maxWidth: '92%',
    gap: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  message: {
    ...typography.body,
    color: colors.text,
    flexShrink: 1,
  },
});
