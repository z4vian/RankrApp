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
import { categoryIcon } from './_categoryIcon';
import { colors, radius, spacing, typography } from '@/lib/theme';

export interface PublicListOwner {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export interface PublicListCardProps {
  title: string;
  description?: string | null;
  category: string;
  itemCount: number;
  owner: PublicListOwner;
  onPress?: () => void;
  onOwnerPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Discover-feed card summarising a public list — category badge, title/description, owner row with item count. */
export function PublicListCard({
  title,
  description,
  category,
  itemCount,
  owner,
  onPress,
  onOwnerPress,
  style,
}: PublicListCardProps) {
  const ownerLabel =
    owner.display_name || (owner.username ? `@${owner.username}` : 'user');
  const ownerHandle = owner.username ? `@${owner.username}` : ownerLabel;

  const card = (
    <View style={[styles.card, style]}>
      <View style={styles.topRow}>
        <View style={styles.categoryBadge}>
          <Ionicons
            name={categoryIcon(category)}
            size={28}
            color={colors.purpleLight}
          />
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          {description ? (
            <Text style={styles.description} numberOfLines={2}>{description}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.ownerRow}>
        {onOwnerPress ? (
          <TouchableOpacity
            onPress={onOwnerPress}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={styles.ownerTap}
          >
            <Avatar uri={owner.avatar_url} name={ownerLabel} size={24} />
            <Text style={styles.ownerHandle} numberOfLines={1}>{ownerHandle}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.ownerTap}>
            <Avatar uri={owner.avatar_url} name={ownerLabel} size={24} />
            <Text style={styles.ownerHandle} numberOfLines={1}>{ownerHandle}</Text>
          </View>
        )}
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.itemCount}>
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
        {card}
      </TouchableOpacity>
    );
  }
  return card;
}

const CATEGORY_BADGE_SIZE = 64;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  categoryBadge: {
    width: CATEGORY_BADGE_SIZE,
    height: CATEGORY_BADGE_SIZE,
    borderRadius: CATEGORY_BADGE_SIZE / 2,
    backgroundColor: colors.purpleSoft,
    borderWidth: 1,
    borderColor: colors.purple,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.h3,
    color: colors.text,
  },
  description: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 4,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ownerTap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
    minWidth: 0,
  },
  ownerHandle: {
    ...typography.small,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  metaDot: {
    ...typography.small,
    color: colors.textMuted,
  },
  itemCount: {
    ...typography.small,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
});
