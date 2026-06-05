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
import { categoryIcon } from './_categoryIcon';
import { colors, radius, spacing, typography } from '@/lib/theme';

export interface ListItemPreviewCardProps {
  title: string;
  subtitle: string | null;
  image_url: string | null;
  category: string;
  rank?: number | null;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

function scoreColor(rank: number): string {
  if (rank >= 8) return colors.success;
  if (rank >= 6) return colors.warning;
  if (rank >= 4) return colors.attention;
  return colors.error;
}

/** Compact horizontal card previewing an attached list_item — thumbnail + title/subtitle + category or score. */
export function ListItemPreviewCard({
  title,
  subtitle,
  image_url,
  category,
  rank,
  onPress,
  style,
}: ListItemPreviewCardProps) {
  const inner = (
    <View style={[styles.container, style]}>
      <View style={styles.thumbWrap}>
        {image_url ? (
          <Image source={{ uri: image_url }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons name={categoryIcon(category)} size={22} color={colors.purpleLight} />
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        ) : null}
        <View style={styles.metaRow}>
          <View style={styles.categoryChip}>
            <Ionicons
              name={categoryIcon(category)}
              size={11}
              color={colors.purpleLight}
              style={styles.categoryIcon}
            />
            <Text style={styles.categoryText}>{category}</Text>
          </View>
          {typeof rank === 'number' ? (
            <View style={[styles.scoreChip, { borderColor: scoreColor(rank) }]}>
              <Text style={[styles.scoreText, { color: scoreColor(rank) }]}>
                {rank.toFixed(1)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
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
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  thumbWrap: {
    width: 60,
    height: 60,
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
  info: {
    flex: 1,
  },
  title: {
    ...typography.bodyBold,
    color: colors.text,
    marginBottom: 2,
  },
  subtitle: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.purpleSoft,
    borderWidth: 1,
    borderColor: colors.purple,
  },
  categoryIcon: {
    marginRight: 4,
  },
  categoryText: {
    ...typography.caption,
    color: colors.purpleLight,
    textTransform: 'capitalize',
  },
  scoreChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  scoreText: {
    ...typography.caption,
    fontWeight: '700',
  },
});
