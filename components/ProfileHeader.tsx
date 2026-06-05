import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { FollowButton } from './FollowButton';
import { StatPill } from './StatPill';
import { colors, spacing, typography } from '@/lib/theme';

export interface ProfileHeaderStats {
  listsCount: number;
  itemsCount: number;
  followersCount: number;
  followingCount: number;
}

export interface ProfileHeaderProps {
  avatarUri?: string | null;
  displayName: string;
  username: string;
  bio?: string | null;
  stats: ProfileHeaderStats;
  isSelf: boolean;
  isFollowing?: boolean;
  followLoading?: boolean;
  onFollowToggle?: () => void;
  onEditProfile?: () => void;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
}

/** Composite profile header with avatar, name, bio, stat pills, and follow/edit action. */
export function ProfileHeader({
  avatarUri,
  displayName,
  username,
  bio,
  stats,
  isSelf,
  isFollowing = false,
  followLoading = false,
  onFollowToggle,
  onEditProfile,
  onFollowersPress,
  onFollowingPress,
}: ProfileHeaderProps) {
  return (
    <View style={styles.container}>
      {/* Identity */}
      <View style={styles.identity}>
        <Avatar uri={avatarUri} name={displayName} size={80} />
        <Text style={styles.displayName}>{displayName}</Text>
        <Text style={styles.username}>@{username}</Text>
        {bio ? <Text style={styles.bio}>{bio}</Text> : null}
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatPill
          value={stats.listsCount}
          label="Lists"
        />
        <View style={styles.divider} />
        <StatPill
          value={stats.itemsCount}
          label="Items"
        />
        <View style={styles.divider} />
        <StatPill
          value={stats.followersCount}
          label="Followers"
          onPress={onFollowersPress}
        />
        <View style={styles.divider} />
        <StatPill
          value={stats.followingCount}
          label="Following"
          onPress={onFollowingPress}
        />
      </View>

      {/* Action row */}
      <View style={styles.actionRow}>
        {isSelf ? (
          <Button
            label="Edit Profile"
            variant="secondary"
            onPress={onEditProfile ?? (() => {})}
            style={styles.actionBtn}
          />
        ) : (
          <FollowButton
            following={isFollowing}
            loading={followLoading}
            onPress={onFollowToggle ?? (() => {})}
            style={styles.actionBtn}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  identity: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  displayName: {
    ...typography.h2,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  username: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  bio: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.lg,
    alignSelf: 'stretch',
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  actionRow: {
    alignSelf: 'stretch',
  },
  actionBtn: {
    alignSelf: 'stretch',
  },
});
