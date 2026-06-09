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
import { colors, spacing, typography } from '@/lib/theme';

export interface CommentBubbleProps {
  avatarUri?: string | null;
  authorName: string;
  authorUsername: string | null;
  body: string;
  createdAtIso: string;
  edited: boolean;
  isOwn: boolean;
  onPressAuthor?: () => void;
  onDelete?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Single comment in a thread with author header, body, and optional delete action. */
export function CommentBubble({
  avatarUri,
  authorName,
  authorUsername,
  body,
  createdAtIso,
  edited,
  isOwn,
  onPressAuthor,
  onDelete,
  style,
}: CommentBubbleProps) {
  const displayLabel = authorName || (authorUsername ? `@${authorUsername}` : 'user');

  const avatar = (
    <Avatar uri={avatarUri} name={displayLabel} size={32} />
  );

  const nameEl = (
    <Text style={styles.authorName} numberOfLines={1}>{displayLabel}</Text>
  );

  return (
    <View style={[styles.container, style]}>
      {onPressAuthor ? (
        <TouchableOpacity onPress={onPressAuthor} activeOpacity={0.7}>
          {avatar}
        </TouchableOpacity>
      ) : (
        avatar
      )}
      <View style={styles.content}>
        <View style={styles.headerRow}>
          {onPressAuthor ? (
            <TouchableOpacity onPress={onPressAuthor} activeOpacity={0.7} style={styles.nameWrap}>
              {nameEl}
            </TouchableOpacity>
          ) : (
            <View style={styles.nameWrap}>{nameEl}</View>
          )}
          <RelativeTime iso={createdAtIso} style={styles.time} />
          {edited ? <Text style={styles.edited}>edited</Text> : null}
        </View>
        <Text style={styles.body}>{body}</Text>
        {isOwn && onDelete ? (
          <TouchableOpacity
            onPress={onDelete}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.deleteBtn}
          >
            <Text style={styles.deleteLabel}>Delete</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  content: {
    flex: 1,
    marginLeft: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameWrap: {
    flexShrink: 1,
    marginRight: spacing.sm,
  },
  authorName: {
    ...typography.bodyBold,
    color: colors.text,
  },
  time: {
    marginRight: spacing.xs + 2,
  },
  edited: {
    ...typography.caption,
    color: colors.textPlaceholder,
    fontStyle: 'italic',
  },
  body: {
    ...typography.body,
    color: colors.text,
  },
  deleteBtn: {
    marginTop: spacing.xs + 2,
    alignSelf: 'flex-start',
  },
  deleteLabel: {
    ...typography.caption,
    color: colors.error,
    fontWeight: '600',
  },
});
