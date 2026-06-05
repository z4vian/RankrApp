import { Image } from 'expo-image';
import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Avatar } from './Avatar';
import { RelativeTime } from './RelativeTime';
import { colors, radius, spacing, typography } from '@/lib/theme';

export type NotificationKind = 'like' | 'comment' | 'tagged_watched_with';

export interface NotificationActor {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export interface NotificationRowProps {
  kind: NotificationKind;
  actor: NotificationActor;
  itemTitle: string;
  itemImageUrl: string | null;
  commentPreview?: string | null;
  createdAtIso: string;
  isUnread: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Single notifications-feed row with actor avatar, kind-specific text, and item thumbnail. */
export function NotificationRow({
  kind,
  actor,
  itemTitle,
  itemImageUrl,
  commentPreview,
  createdAtIso,
  isUnread,
  onPress,
  style,
}: NotificationRowProps) {
  const actorLabel = actor.display_name || actor.username || 'someone';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.container,
        isUnread && styles.unread,
        style,
      ]}
    >
      <Avatar uri={actor.avatar_url} name={actorLabel} size={40} />

      <View style={styles.middle}>
        <Text style={styles.text} numberOfLines={2}>
          <Text style={styles.bold}>{actorLabel}</Text>
          {kind === 'like' ? (
            <>
              <Text> liked your </Text>
              <Text style={styles.italic}>{itemTitle}</Text>
            </>
          ) : kind === 'comment' ? (
            <>
              <Text> commented: </Text>
              <Text>
                &ldquo;{commentPreview ?? ''}&rdquo;
              </Text>
            </>
          ) : (
            <>
              <Text> tagged you in </Text>
              <Text style={styles.italic}>{itemTitle}</Text>
            </>
          )}
        </Text>
        <RelativeTime iso={createdAtIso} style={styles.time} />
      </View>

      <View style={styles.thumbWrap}>
        {itemImageUrl ? (
          <Image
            source={{ uri: itemImageUrl }}
            style={styles.thumb}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]} />
        )}
      </View>

      {isUnread ? <View style={styles.unreadDot} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  unread: {
    backgroundColor: colors.purpleSoft,
  },
  middle: {
    flex: 1,
  },
  text: {
    ...typography.body,
    color: colors.text,
  },
  bold: {
    ...typography.bodyBold,
    color: colors.text,
  },
  italic: {
    color: colors.purpleLight,
    fontStyle: 'italic',
  },
  time: {
    marginTop: 2,
  },
  thumbWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  unreadDot: {
    position: 'absolute',
    top: spacing.md + 2,
    right: spacing.xs,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.purple,
  },
});
