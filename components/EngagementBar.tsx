import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { LikeButton } from './LikeButton';
import { WatchedWithStack, WatchedWithUser } from './WatchedWithStack';
import { colors, radius, spacing, typography } from '@/lib/theme';

export interface EngagementBarProps {
  likeCount: number;
  hasUserLiked: boolean;
  onLikePress: () => void;
  likeLoading?: boolean;

  commentCount: number;
  onCommentsPress: () => void;

  watchedWithUsers: WatchedWithUser[];

  showAddWatchedWith?: boolean;
  onAddWatchedWithPress?: () => void;

  style?: StyleProp<ViewStyle>;
}

function formatCount(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  if (n < 1_000_000) return Math.floor(n / 1000) + 'K';
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
}

/** Horizontal row of like + comment + watched-with summary for item detail screens. */
export function EngagementBar({
  likeCount,
  hasUserLiked,
  onLikePress,
  likeLoading,
  commentCount,
  onCommentsPress,
  watchedWithUsers,
  showAddWatchedWith,
  onAddWatchedWithPress,
  style,
}: EngagementBarProps) {
  return (
    <View style={[styles.container, style]}>
      <LikeButton
        liked={hasUserLiked}
        count={likeCount}
        loading={likeLoading}
        onPress={onLikePress}
        size="md"
        style={styles.action}
      />

      <TouchableOpacity
        onPress={onCommentsPress}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={[styles.action, styles.commentChip]}
      >
        <Ionicons
          name="chatbubble-outline"
          size={20}
          color={colors.textSecondary}
        />
        <Text style={styles.commentCount}>{formatCount(commentCount)}</Text>
      </TouchableOpacity>

      <View style={styles.spacer} />

      {watchedWithUsers.length > 0 ? (
        <WatchedWithStack
          users={watchedWithUsers}
          maxVisible={3}
          size={28}
          onPress={onAddWatchedWithPress}
        />
      ) : showAddWatchedWith ? (
        <TouchableOpacity
          onPress={onAddWatchedWithPress}
          activeOpacity={0.7}
          style={styles.addPill}
        >
          <Ionicons name="person-add-outline" size={14} color={colors.purpleLight} />
          <Text style={styles.addPillText}>Add who you were with</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentChip: {
    gap: spacing.xs + 2,
  },
  commentCount: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  spacer: {
    flex: 1,
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.purple,
    backgroundColor: colors.purpleSoft,
    gap: spacing.xs + 2,
  },
  addPillText: {
    ...typography.caption,
    color: colors.purpleLight,
    fontWeight: '600',
  },
});
