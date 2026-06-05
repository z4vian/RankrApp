import Ionicons from '@expo/vector-icons/Ionicons';
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
import { categoryIcon } from './_categoryIcon';
import { colors, radius, spacing, typography } from '@/lib/theme';

export interface RankedItemCardProps {
  avatarUri?: string | null;
  authorName: string;
  authorUsername: string | null;

  itemTitle: string;
  itemSubtitle: string | null;
  itemImageUrl: string | null;
  itemCategory: string;
  score: number;

  listTitle: string;

  notes: string | null;

  createdAtIso: string;

  onPressAuthor?: () => void;
  onPressItem?: () => void;

  style?: StyleProp<ViewStyle>;
}

function scoreColor(score: number): string {
  if (score >= 8) return colors.success;
  if (score >= 6) return colors.warning;
  if (score >= 4) return colors.attention;
  return colors.error;
}

/** Feed unit for ranking activity — single flat card with author header, title + score row, list subtitle, optional notes. */
export function RankedItemCard({
  avatarUri,
  authorName,
  authorUsername,
  itemTitle,
  itemSubtitle: _itemSubtitle,
  itemImageUrl,
  itemCategory,
  score,
  listTitle,
  notes,
  createdAtIso,
  onPressAuthor,
  onPressItem,
  style,
}: RankedItemCardProps) {
  const displayLabel = authorName || (authorUsername ? `@${authorUsername}` : 'user');
  const handle = authorUsername ? `@${authorUsername}` : null;
  const chipColor = scoreColor(score);

  const avatarEl = <Avatar uri={avatarUri} name={displayLabel} size={40} />;

  return (
    <View style={[styles.container, style]}>
      {/* Header row — mirrors PostCard layout */}
      <View style={styles.headerRow}>
        {onPressAuthor ? (
          <TouchableOpacity onPress={onPressAuthor} activeOpacity={0.7}>
            {avatarEl}
          </TouchableOpacity>
        ) : (
          avatarEl
        )}

        <View style={styles.headerInfo}>
          {onPressAuthor ? (
            <TouchableOpacity onPress={onPressAuthor} activeOpacity={0.7} style={styles.nameWrap}>
              <Text style={styles.authorName} numberOfLines={1}>{displayLabel}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.authorName} numberOfLines={1}>{displayLabel}</Text>
          )}

          <View style={styles.metaRow}>
            {handle ? (
              <Text style={styles.handle} numberOfLines={1}>{handle}</Text>
            ) : null}
            <Text style={styles.verb}>· ranked</Text>
            <Text style={styles.metaDot}>·</Text>
            <RelativeTime iso={createdAtIso} style={styles.time} />
          </View>
        </View>
      </View>

      {/* Item row — thumbnail + (title + subtitle) + score chip */}
      <TouchableOpacity
        onPress={onPressItem}
        activeOpacity={onPressItem ? 0.7 : 1}
        disabled={!onPressItem}
        style={styles.itemRow}
      >
        <View style={styles.thumbWrap}>
          {itemImageUrl ? (
            <Image source={{ uri: itemImageUrl }} style={styles.thumb} contentFit="cover" />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <Ionicons
                name={categoryIcon(itemCategory)}
                size={18}
                color={colors.purpleLight}
              />
            </View>
          )}
        </View>

        <View style={styles.itemTextWrap}>
          <Text style={styles.itemTitle} numberOfLines={1}>{itemTitle}</Text>
          <Text style={styles.listSubtitle} numberOfLines={1}>in {listTitle}</Text>
        </View>

        <View style={[styles.scoreChip, { backgroundColor: chipColor }]}>
          <Text style={styles.scoreText}>{score.toFixed(1)}</Text>
        </View>
      </TouchableOpacity>

      {/* Notes body */}
      {notes && notes.trim().length > 0 ? (
        <Text style={styles.notes}>{notes}</Text>
      ) : null}
    </View>
  );
}

const GUTTER = 40 + spacing.md; // matches PostCard: avatar size + header gap

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
  nameWrap: {
    alignSelf: 'flex-start',
  },
  authorName: {
    ...typography.bodyBold,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  handle: {
    ...typography.small,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  verb: {
    ...typography.small,
    color: colors.textMuted,
  },
  metaDot: {
    ...typography.small,
    color: colors.textMuted,
  },
  time: {
    color: colors.textMuted,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginLeft: GUTTER,
    gap: spacing.md,
  },
  thumbWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    backgroundColor: colors.purpleSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    ...typography.h3,
    color: colors.text,
  },
  listSubtitle: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scoreChip: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    ...typography.bodyBold,
    color: colors.text,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  notes: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.sm,
    marginLeft: GUTTER,
  },
});
