import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useReducedMotion } from '@/lib/a11y';
import { colors, radius, spacing } from '@/lib/theme';

export interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Single skeleton block — a low-contrast pulsing rectangle. Use to reserve
 * space while real content loads. Respects reduced-motion (becomes static).
 */
export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius: br = radius.sm,
  style,
}: SkeletonProps) {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(0.55);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reducedMotion]);

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[
        {
          width,
          height,
          borderRadius: br,
          backgroundColor: colors.cardElevated,
          opacity,
        },
        style,
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Composed skeletons for common screen patterns
// ---------------------------------------------------------------------------

/** Shape-matching skeleton for a feed PostCard. */
export function PostCardSkeleton() {
  return (
    <View style={styles.postCard}>
      <View style={styles.postRow}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={styles.postBody}>
          <Skeleton width={120} height={14} />
          <Skeleton width={80} height={11} style={{ marginTop: spacing.xs + 2 }} />
        </View>
      </View>
      <Skeleton height={14} style={{ marginTop: spacing.md, marginLeft: 40 + spacing.md }} />
      <Skeleton width="80%" height={14} style={{ marginTop: spacing.xs + 2, marginLeft: 40 + spacing.md }} />
    </View>
  );
}

/** Shape-matching skeleton for a "Lists" tab card (cover + title + count). */
export function ListCardSkeleton() {
  return (
    <View style={styles.listCard}>
      <Skeleton width="100%" height={120} borderRadius={0} />
      <View style={styles.listCardBody}>
        <View style={{ flex: 1 }}>
          <Skeleton width="70%" height={17} />
          <Skeleton width="40%" height={13} style={{ marginTop: spacing.xs + 2 }} />
        </View>
        <Skeleton width={36} height={26} borderRadius={radius.sm} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  postCard: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  postRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  postBody: {
    flex: 1,
  },
  listCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  listCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    justifyContent: 'space-between',
    gap: spacing.md,
  },
});
