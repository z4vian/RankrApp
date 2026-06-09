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
import { Avatar } from './Avatar';
import { ListItemPreviewCard } from './ListItemPreviewCard';
import { RelativeTime } from './RelativeTime';
import { colors, spacing, typography } from '@/lib/theme';

export type PostVisibility = 'private' | 'followers' | 'public';

export interface PostAttachedItem {
  title: string;
  subtitle: string | null;
  image_url: string | null;
  category: string;
  rank?: number | null;
}

export interface PostCardProps {
  avatarUri?: string | null;
  authorName: string;
  authorUsername: string | null;
  body: string;
  createdAtIso: string;
  visibility: PostVisibility;
  attachedItem?: PostAttachedItem | null;
  isOwn: boolean;
  onPressAuthor?: () => void;
  onPressAttachedItem?: () => void;
  onDelete?: () => void;
  style?: StyleProp<ViewStyle>;
}

const VISIBILITY_META: Record<
  PostVisibility,
  { icon: keyof typeof Ionicons.glyphMap; label: string; color: string }
> = {
  private: { icon: 'lock-closed', label: 'Only you', color: colors.textMuted },
  followers: { icon: 'people', label: 'Followers', color: colors.purpleLight },
  public: { icon: 'globe-outline', label: 'Public', color: colors.success },
};

/** Twitter-style feed post — author header, body, optional attached list item, visibility hint for own posts. */
export function PostCard({
  avatarUri,
  authorName,
  authorUsername,
  body,
  createdAtIso,
  visibility,
  attachedItem,
  isOwn,
  onPressAuthor,
  onPressAttachedItem,
  onDelete,
  style,
}: PostCardProps) {
  const displayLabel = authorName || (authorUsername ? `@${authorUsername}` : 'user');
  const handle = authorUsername ? `@${authorUsername}` : null;
  const vis = VISIBILITY_META[visibility];

  const avatarEl = <Avatar uri={avatarUri} name={displayLabel} size={40} />;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.headerRow}>
        {onPressAuthor ? (
          <TouchableOpacity onPress={onPressAuthor} activeOpacity={0.7}>
            {avatarEl}
          </TouchableOpacity>
        ) : (
          avatarEl
        )}

        <View style={styles.headerInfo}>
          <View style={styles.identityRow}>
            {onPressAuthor ? (
              <TouchableOpacity onPress={onPressAuthor} activeOpacity={0.7} style={styles.nameWrap}>
                <Text style={styles.authorName} numberOfLines={1}>{displayLabel}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.authorName} numberOfLines={1}>{displayLabel}</Text>
            )}
            {handle ? (
              <Text style={styles.username} numberOfLines={1}>{handle}</Text>
            ) : null}
          </View>

          <View style={styles.metaRow}>
            <RelativeTime iso={createdAtIso} style={styles.time} />
            {isOwn ? (
              <View style={styles.visChip}>
                <Ionicons name={vis.icon} size={10} color={vis.color} style={styles.visIcon} />
                <Text style={[styles.visLabel, { color: vis.color }]}>{vis.label}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {isOwn && onDelete ? (
          <TouchableOpacity
            onPress={onDelete}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.deleteBtn}
            accessibilityRole="button"
            accessibilityLabel="Post options"
            accessibilityHint="Opens menu to delete this post"
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {body ? <Text style={styles.body}>{body}</Text> : null}

      {attachedItem ? (
        <ListItemPreviewCard
          title={attachedItem.title}
          subtitle={attachedItem.subtitle}
          image_url={attachedItem.image_url}
          category={attachedItem.category}
          rank={attachedItem.rank ?? null}
          onPress={onPressAttachedItem}
          style={styles.attachment}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.bg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  nameWrap: {
    flexShrink: 1,
  },
  authorName: {
    ...typography.bodyBold,
    color: colors.text,
  },
  username: {
    ...typography.small,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: spacing.sm,
  },
  time: {
    color: colors.textMuted,
  },
  visChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  visIcon: {
    marginRight: 3,
  },
  visLabel: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.sm,
    marginLeft: 40 + spacing.md, // align under headerInfo, past the avatar
  },
  attachment: {
    marginTop: spacing.md,
    marginLeft: 40 + spacing.md,
  },
});
