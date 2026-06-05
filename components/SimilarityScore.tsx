import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, spacing, typography } from '@/lib/theme';

export type SimilaritySize = 'md' | 'lg';

export interface SimilarityScoreProps {
  score: number;
  label?: string;
  size?: SimilaritySize;
  style?: StyleProp<ViewStyle>;
}

function ringColor(score: number): string {
  if (score >= 80) return colors.success;
  if (score >= 60) return colors.purple;
  if (score >= 40) return colors.warning;
  return colors.error;
}

const SIZE_SPEC: Record<SimilaritySize, { diameter: number; fontSize: number }> = {
  lg: { diameter: 120, fontSize: 36 },
  md: { diameter: 64, fontSize: 22 },
};

/** Hero percentage badge with a colored ring — used as the focal point on the compare-with-friend screen. */
export function SimilarityScore({
  score,
  label = 'Taste match',
  size = 'lg',
  style,
}: SimilarityScoreProps) {
  const spec = SIZE_SPEC[size];
  const stroke = ringColor(score);
  const clamped = Math.max(0, Math.min(100, Math.round(score)));

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.ring,
          {
            width: spec.diameter,
            height: spec.diameter,
            borderRadius: spec.diameter / 2,
            borderColor: stroke,
          },
        ]}
      >
        <Text style={[styles.value, { fontSize: spec.fontSize }]}>
          {clamped}%
        </Text>
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    borderWidth: 4,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: {
    color: colors.text,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
