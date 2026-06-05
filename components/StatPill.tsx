import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { colors, spacing, typography } from '@/lib/theme';

export interface StatPillProps {
  value: number | string;
  label: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Vertical number + label stat display — tappable when onPress is provided. */
export function StatPill({ value, label, onPress, style }: StatPillProps) {
  const content = (
    <View style={[styles.container, style]}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  value: {
    ...typography.h3,
    color: colors.text,
    marginBottom: 2,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'lowercase',
  },
});
