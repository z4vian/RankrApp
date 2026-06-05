import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '@/lib/theme';

export type PillVariant = 'default' | 'purple' | 'success' | 'warning' | 'error';
export type IconName = keyof typeof Ionicons.glyphMap;

export interface PillProps {
  label: string;
  variant?: PillVariant;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}

const variantStyles: Record<
  PillVariant,
  { bg: string; text: string; border: string }
> = {
  default: { bg: colors.card, text: colors.textSecondary, border: colors.border },
  purple: { bg: colors.purpleSoft, text: colors.purpleLight, border: colors.purple },
  success: { bg: '#22c55e18', text: colors.success, border: colors.success },
  warning: { bg: '#eab30818', text: colors.warning, border: colors.warning },
  error: { bg: colors.errorBg, text: colors.error, border: colors.errorBorder },
};

/** Small rounded badge with semantic colour variants and optional leading icon. */
export function Pill({ label, variant = 'default', icon, style }: PillProps) {
  const { bg, text, border } = variantStyles[variant];

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: bg, borderColor: border },
        style,
      ]}
    >
      {icon ? (
        <Ionicons name={icon} size={12} color={text} style={styles.icon} />
      ) : null}
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
  label: {
    ...typography.caption,
  },
});
