import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useReducedMotion } from '@/lib/a11y';
import { colors, spacing, typography } from '@/lib/theme';

const AnimatedIonicon = Animated.createAnimatedComponent(Ionicons);

export interface LikeButtonProps {
  liked: boolean;
  count?: number;
  loading?: boolean;
  onPress: () => void;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

function formatCount(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  if (n < 1_000_000) return Math.floor(n / 1000) + 'K';
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
}

/** Heart-toggle like button with bounce animation and optional count. */
export function LikeButton({
  liked,
  count,
  loading = false,
  onPress,
  size = 'md',
  style,
}: LikeButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const fill = useRef(new Animated.Value(liked ? 1 : 0)).current;
  const reducedMotion = useReducedMotion();

  // Smoothly crossfade the filled heart on top of the outlined one whenever
  // the `liked` prop changes (e.g. parent toggles after async confirm).
  useEffect(() => {
    if (reducedMotion) {
      fill.setValue(liked ? 1 : 0);
      return;
    }
    Animated.timing(fill, {
      toValue: liked ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [liked, reducedMotion, fill]);

  const handlePress = () => {
    if (!reducedMotion) {
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1.3,
          useNativeDriver: true,
          speed: 50,
          bounciness: 12,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 30,
          bounciness: 10,
        }),
      ]).start();
    }
    // Light tap on like only (not unlike) for subtle reward feedback.
    if (!liked) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  };

  const iconSize = size === 'sm' ? 16 : 22;
  const textStyle = size === 'sm' ? typography.caption : typography.body;

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={loading}
      activeOpacity={0.7}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={[styles.container, style]}
      accessibilityRole="button"
      accessibilityLabel={liked ? 'Unlike' : 'Like'}
      accessibilityState={{ selected: liked, disabled: loading, busy: loading }}
    >
      {loading ? (
        <View style={{ width: iconSize, height: iconSize, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.purpleLight} size="small" />
        </View>
      ) : (
        <Animated.View style={{ transform: [{ scale }], width: iconSize, height: iconSize }}>
          {/* Outlined heart sits underneath — always visible.
              Filled heart is layered on top with animated opacity that
              tracks the `liked` prop, giving a smooth crossfade. */}
          <Ionicons
            name="heart-outline"
            size={iconSize}
            color={colors.textSecondary}
            style={StyleSheet.absoluteFill}
          />
          <AnimatedIonicon
            name="heart"
            size={iconSize}
            color={colors.error}
            style={[StyleSheet.absoluteFill, { opacity: fill }]}
          />
        </Animated.View>
      )}
      {count !== undefined ? (
        <Text
          style={[
            styles.count,
            textStyle,
            { color: liked ? colors.error : colors.textSecondary },
          ]}
        >
          {formatCount(count)}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  count: {
    marginLeft: spacing.xs + 2,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
