import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Button } from './Button';
import { colors, radius, typography } from '@/lib/theme';

export interface FollowButtonProps {
  following: boolean;
  loading?: boolean;
  onPress: () => void;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

/** Follow / Following toggle — composes Button with size-aware height and pill shape for sm. */
export function FollowButton({
  following,
  loading = false,
  onPress,
  size = 'md',
  style,
}: FollowButtonProps) {
  if (size === 'sm') {
    return (
      <Button
        label={following ? 'Following' : 'Follow'}
        variant={following ? 'secondary' : 'primary'}
        onPress={onPress}
        loading={loading}
        style={[styles.sm, style]}
      />
    );
  }

  return (
    <Button
      label={following ? 'Following' : 'Follow'}
      variant={following ? 'secondary' : 'primary'}
      onPress={onPress}
      loading={loading}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  sm: {
    height: 36,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    // Override the label font inside Button via composition — Button exposes no label-style prop,
    // so we accept the default bodyBold size (15) at sm; override at call-site if desired.
  },
});
