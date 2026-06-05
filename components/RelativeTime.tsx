import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';
import { colors, typography } from '@/lib/theme';

export interface RelativeTimeProps {
  iso: string;
  style?: StyleProp<TextStyle>;
}

const MONTHS_SHORT = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));

  if (diffSec < 60) return 'just now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;

  const diffWk = Math.floor(diffDay / 7);
  if (diffWk < 4) return `${diffWk}w`;

  const d = new Date(iso);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** Compact relative-time label (e.g. "just now", "5m", "3d", "jun 5"). */
export function RelativeTime({ iso, style }: RelativeTimeProps) {
  return <Text style={[styles.text, style]}>{formatRelative(iso)}</Text>;
}

const styles = StyleSheet.create({
  text: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
