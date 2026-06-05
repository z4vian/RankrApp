import React, { ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Avatar } from './Avatar';
import { colors, spacing, typography } from '@/lib/theme';

export interface UserRowProps {
  avatarUri?: string | null;
  displayName: string;
  username: string;
  bio?: string | null;
  trailing?: ReactNode;
  onPress?: () => void;
}

/** Horizontal user row for follower/following lists and search results with a trailing slot. */
export function UserRow({
  avatarUri,
  displayName,
  username,
  bio,
  trailing,
  onPress,
}: UserRowProps) {
  const inner = (
    <View style={styles.container}>
      <Avatar uri={avatarUri} name={displayName} size={44} />
      <View style={styles.info}>
        <Text style={styles.displayName} numberOfLines={1}>{displayName}</Text>
        <Text style={styles.username} numberOfLines={1}>@{username}</Text>
        {bio ? (
          <Text style={styles.bio} numberOfLines={1}>{bio}</Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {inner}
      </TouchableOpacity>
    );
  }

  return inner;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  info: {
    flex: 1,
    marginLeft: spacing.md,
  },
  displayName: {
    ...typography.bodyBold,
    color: colors.text,
    marginBottom: 2,
  },
  username: {
    ...typography.small,
    color: colors.textSecondary,
  },
  bio: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 2,
  },
  trailing: {
    marginLeft: spacing.sm,
  },
});
