import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '@/lib/theme';

export interface InsightSectionProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Year-in-review section wrapper — micro-style heading + optional subtitle above a card-styled body. */
export function InsightSection({ title, subtitle, children, style }: InsightSectionProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.micro,
    color: colors.purpleLight,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.small,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  body: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
});
