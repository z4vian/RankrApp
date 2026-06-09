/**
 * app/notifications.tsx
 *
 * Standalone notifications screen.
 *
 * T1 Fix 4 — swapped from the flat `getNotifications` to the grouped
 * `getGroupedNotifications`. Multiple events sharing `(kind, list_item)`
 * collapse into one row, displayed as:
 *
 *   1 actor:  "**@alice** liked your *Inception*"
 *   2 actors: "**@alice** and **@bob** liked your *Inception*"
 *   3+ actors: "**@alice**, **@bob** and **3 others** liked your *Inception*"
 *
 * The shipped <NotificationRow /> component from @/components only accepts a
 * single actor + flat text — it can't render the grouped copy. Per the brief,
 * we inline the row rendering here (still using Avatar + RelativeTime from
 * @/components for visual consistency).
 *
 * Pull-to-refresh re-fetches; markNotificationsAsSeen fires once after
 * items render so the unread badge clears.
 */

import {
  EmptyState,
  Avatar,
  LoadingState,
  RelativeTime,
} from '@/components';
import {
  getGroupedNotifications,
  markNotificationsAsSeen,
  type GroupedNotification,
} from '@/lib/notifications';
import { colors, radius, spacing, typography } from '@/lib/theme';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<GroupedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        const fresh = await getGroupedNotifications(50);
        if (cancelled) return;
        setItems(fresh);
        setLoading(false);
        markNotificationsAsSeen().catch(() => {});
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const fresh = await getGroupedNotifications(50);
    setItems(fresh);
    setRefreshing(false);
    markNotificationsAsSeen().catch(() => {});
  }, []);

  const handlePress = useCallback(
    (n: GroupedNotification) => {
      router.push(`/list-item/${n.list_item.id}` as any);
    },
    [router],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading && items.length === 0 ? (
        <LoadingState label="Loading notifications…" />
      ) : items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="notifications-outline"
            title="No notifications yet"
            subtitle="When people like or comment on your items, they'll show up here."
          />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => (
            <GroupedNotificationRow
              notification={item}
              onPress={() => handlePress(item)}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.purpleLight}
              colors={[colors.purple]}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Inline row — composes the grouped actor copy.
// ---------------------------------------------------------------------------

/**
 * Kind-specific verb fragment that follows the actor list.
 *
 * - like                 → "liked your"
 * - comment              → "commented on your"
 * - tagged_watched_with  → "tagged you in"
 *
 * "your" / "you in" wording matches the v1 flat NotificationRow component
 * so the screen reads consistently between flat and grouped paths.
 */
function verbFor(kind: GroupedNotification['kind']): string {
  if (kind === 'like') return ' liked your ';
  if (kind === 'comment') return ' commented on your ';
  return ' tagged you in ';
}

interface GroupedNotificationRowProps {
  notification: GroupedNotification;
  onPress: () => void;
}

function GroupedNotificationRow({ notification: n, onPress }: GroupedNotificationRowProps) {
  const primaryLabel =
    n.primary_actor.username
      ? `@${n.primary_actor.username}`
      : n.primary_actor.display_name || 'someone';

  // Build the actor-list segment.
  //   1 actor:  "primary"
  //   2 actors: "primary and other[0]"
  //   3+:       "primary, other[0] and (total - 2) others"
  // total_actor_count INCLUDES primary, so "others" = total - 2 once we've
  // already named primary + other[0].
  const renderActors = () => {
    if (n.total_actor_count <= 1) {
      return <Text style={styles.actorBold}>{primaryLabel}</Text>;
    }
    if (n.total_actor_count === 2) {
      const second = n.other_actor_names[0] ?? 'someone';
      return (
        <>
          <Text style={styles.actorBold}>{primaryLabel}</Text>
          <Text> and </Text>
          <Text style={styles.actorBold}>{second}</Text>
        </>
      );
    }
    // 3+ actors. Always use the "primary, other[0] and N others" template
    // (one secondary + the count). We could show two secondaries here but
    // the brief specifies the 3+ template as "primary, other[0] and total-2".
    const second = n.other_actor_names[0] ?? 'someone';
    const othersCount = n.total_actor_count - 2;
    return (
      <>
        <Text style={styles.actorBold}>{primaryLabel}</Text>
        <Text>, </Text>
        <Text style={styles.actorBold}>{second}</Text>
        <Text> and </Text>
        <Text style={styles.actorBold}>
          {othersCount} other{othersCount === 1 ? '' : 's'}
        </Text>
      </>
    );
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.row, n.is_unread && styles.rowUnread]}
    >
      <Avatar
        uri={n.primary_actor.avatar_url}
        name={primaryLabel}
        size={40}
      />

      <View style={styles.middle}>
        <Text style={styles.bodyText} numberOfLines={3}>
          {renderActors()}
          <Text>{verbFor(n.kind)}</Text>
          <Text style={styles.italic}>{n.list_item.title}</Text>
        </Text>
        {/* Comment preview line — only present for comment groups whose
            most-recent comment had a non-empty body. Shows author handle
            on the left to attribute the quoted text. */}
        {n.kind === 'comment' && n.latest_comment_preview ? (
          <Text style={styles.commentPreview} numberOfLines={2}>
            <Text style={styles.commentAuthor}>{primaryLabel}:</Text>
            <Text>{` “${n.latest_comment_preview}”`}</Text>
          </Text>
        ) : null}
        <RelativeTime iso={n.latest_created_at} style={styles.time} />
      </View>

      <View style={styles.thumbWrap}>
        {n.list_item.image_url ? (
          <Image
            source={{ uri: n.list_item.image_url }}
            style={styles.thumb}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]} />
        )}
      </View>

      {n.is_unread ? <View style={styles.unreadDot} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
  },
  headerSpacer: {
    width: 36,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: spacing.xxxl,
  },

  // Row layout — mirrors @/components/NotificationRow visually so the
  // screen looks consistent if backend ever swaps back to flat mode.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowUnread: {
    backgroundColor: colors.purpleSoft,
  },
  middle: {
    flex: 1,
  },
  bodyText: {
    ...typography.body,
    color: colors.text,
  },
  actorBold: {
    ...typography.bodyBold,
    color: colors.text,
  },
  italic: {
    color: colors.purpleLight,
    fontStyle: 'italic',
  },
  commentPreview: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 4,
  },
  commentAuthor: {
    ...typography.small,
    color: colors.text,
    fontWeight: '600',
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
