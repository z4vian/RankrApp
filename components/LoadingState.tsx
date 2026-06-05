import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, spacing, typography } from '@/lib/theme';

export interface LoadingStateProps {
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/** Centered spinner with optional label — use as a full-area loading placeholder. */
export function LoadingState({ label, style }: LoadingStateProps) {
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator color={colors.purpleLight} size="large" />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  label: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
