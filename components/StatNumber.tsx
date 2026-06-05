import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, spacing, typography } from '@/lib/theme';

export type StatNumberTone = 'default' | 'purple' | 'success';

export interface StatNumberProps {
  value: number | string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: StatNumberTone;
  style?: StyleProp<ViewStyle>;
}

const TONE_COLOR: Record<StatNumberTone, string> = {
  default: colors.text,
  purple: colors.purpleLight,
  success: colors.success,
};

/** Centered big-number block for year-in-review style insights. */
export function StatNumber({
  value,
  label,
  icon,
  tone = 'default',
  style,
}: StatNumberProps) {
  const accent = TONE_COLOR[tone];
  return (
    <View style={[styles.container, style]}>
      {icon ? (
        <Ionicons name={icon} size={22} color={accent} style={styles.icon} />
      ) : null}
      <Text style={[styles.value, { color: accent }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  icon: {
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: 48,
    fontWeight: '800',
    lineHeight: 54,
    fontVariant: ['tabular-nums'],
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    textTransform: 'lowercase',
  },
});
