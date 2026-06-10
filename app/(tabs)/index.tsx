/**
 * app/(tabs)/index.tsx
 *
 * Phase 4 — Home tab repurposed as the social feed.
 *
 * Replaces the prior "Recent Activity" view entirely. Top of screen has the
 * preserved greeting + bell badge from Phase 3, with the prior purple "+"
 * (which routed to search) swapped for a compose-post button that opens
 * /post/compose.
 *
 * Feed:
 *   - getFeed(30) on first load — unified discriminated union of posts +
 *     ranking events
 *   - cursor-based infinite scroll (getFeed(30, lastCreatedAt))
 *   - pull-to-refresh
 *   - PostCard for `kind: 'post'`, RankedItemCard for `kind: 'ranking'`
 *   - Owner-only delete on PostCard (ranking events aren't deletable from feed)
 */

import { getFeed, type FeedItem } from '@/lib/feed';
import { getBlockedUserIds } from '@/lib/moderation';
import { getUnreadNotificationCount } from '@/lib/notifications';
import { deletePost } from '@/lib/posts';
import { supabase } from '@/lib/supabase';
import { colors, glow } from '@/lib/theme';
import { EmptyState, FadeSlideIn, PostCard, PostCardSkeleton, RankedItemCard } from '@/components';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const PAGE_SIZE = 30;

/**
 * Pull `created_at` off either branch of the FeedItem union — used for both
 * cursor pagination and as a stable shape for the dedup-by-key check below.
 */
const createdAtOf = (item: FeedItem): string =>
  item.kind === 'post' ? item.post.created_at : item.event.created_at;

/**
 * Stable key per FeedItem.
 * `RankingEvent.id` is already namespaced as `"ranking:${list_item_id}"` so
 * we prefix posts with `"post:"` to avoid any chance of collision with a UUID
 * that happens to start with `"ranking:"` (vanishingly unlikely, but cheap).
 */
const feedItemKey = (item: FeedItem): string =>
  item.kind === 'post' ? `post:${item.post.id}` : item.event.id;

/**
 * Session 1 — filter blocked users out client-side. Pull the actor id off
 * either branch and drop the row if it's in the block set.
 */
const filterBlocked = (items: FeedItem[], blocked: Set<string>): FeedItem[] => {
  if (blocked.size === 0) return items;
  return items.filter((item) => {
    const actorId = item.kind === 'post' ? item.post.user_id : item.event.user_id;
    return !blocked.has(actorId);
  });
};

export default function HomeScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [endReached, setEndReached] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  // Session 1 — set of blocked user ids; used to filter actors out of the
  // feed client-side. Refreshed on every focus along with the feed.
  const [blockedSet, setBlockedSet] = useState<Set<string>>(new Set());

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setEndReached(false);
    const [{ data: { user } }, fresh, blockedIds] = await Promise.all([
      supabase.auth.getUser(),
      getFeed(PAGE_SIZE),
      getBlockedUserIds(),
    ]);
    setUsername(user?.email?.split('@')[0] ?? '');
    setCurrentUserId(user?.id ?? null);
    const blocked = new Set(blockedIds);
    setBlockedSet(blocked);
    setFeed(filterBlocked(fresh, blocked));
    if (fresh.length < PAGE_SIZE) setEndReached(true);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    loadInitial();
    // Refresh the bell badge whenever home regains focus. Failure → 0.
    getUnreadNotificationCount().then(setUnreadCount).catch(() => setUnreadCount(0));
  }, [loadInitial]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setEndReached(false);
    const [fresh, blockedIds] = await Promise.all([
      getFeed(PAGE_SIZE),
      getBlockedUserIds(),
    ]);
    const blocked = new Set(blockedIds);
    setBlockedSet(blocked);
    setFeed(filterBlocked(fresh, blocked));
    if (fresh.length < PAGE_SIZE) setEndReached(true);
    setRefreshing(false);
    getUnreadNotificationCount().then(setUnreadCount).catch(() => setUnreadCount(0));
  }, []);

  const onEndReached = useCallback(async () => {
    if (loadingMore || endReached || feed.length === 0) return;
    const last = feed[feed.length - 1];
    if (!last) return;
    setLoadingMore(true);
    const older = await getFeed(PAGE_SIZE, createdAtOf(last));
    if (older.length === 0) {
      setEndReached(true);
    } else {
      const filteredOlder = filterBlocked(older, blockedSet);
      setFeed((prev) => {
        // Dedup by key in case of overlap at the cursor boundary (a post and
        // a ranking event created at exactly the same timestamp).
        const seen = new Set(prev.map(feedItemKey));
        return [...prev, ...filteredOlder.filter((i) => !seen.has(feedItemKey(i)))];
      });
      // End-reached is judged off the raw page size, not the post-filter
      // count — otherwise a page consisting entirely of blocked actors would
      // prematurely stop pagination.
      if (older.length < PAGE_SIZE) setEndReached(true);
    }
    setLoadingMore(false);
  }, [loadingMore, endReached, feed, blockedSet]);

  const handleDelete = useCallback(
    (postId: string) => {
      Alert.alert(
        'Delete post',
        'Are you sure? This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deletePost(postId);
                setFeed((prev) =>
                  prev.filter((i) => !(i.kind === 'post' && i.post.id === postId)),
                );
              } catch (err: any) {
                Alert.alert('Could not delete', err?.message ?? 'Please try again.');
              }
            },
          },
        ],
      );
    },
    [],
  );

  const renderHeader = () => (
    <View style={styles.greeting}>
      <View style={{ flex: 1 }}>
        <Text style={styles.greetingHello}>Hello,</Text>
        <Text style={styles.greetingName} numberOfLines={1}>@{username} 👋</Text>
      </View>
      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.bellButton}
          onPress={() => router.push('/notifications' as any)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        >
          <Ionicons name="notifications-outline" size={20} color="#aaa" />
          {unreadCount > 0 ? (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText} numberOfLines={1}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.composeButton}
          onPress={() => router.push('/post/compose' as any)}
        >
          <Ionicons name="create-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={feed}
        keyExtractor={feedItemKey}
        renderItem={({ item, index }) => {
          // Stagger only the first ~8 items so later items don't feel laggy.
          const staggerDelay = Math.min(index, 8) * 35;
          if (item.kind === 'post') {
            const post = item.post;
            const isOwn = currentUserId != null && post.user_id === currentUserId;
            const authorName =
              post.author.display_name ?? post.author.username ?? 'user';
            const attachedItemId = post.attached_item?.id ?? null;
            return (
              <FadeSlideIn delay={staggerDelay}>
              <PostCard
                avatarUri={post.author.avatar_url}
                authorName={authorName}
                authorUsername={post.author.username}
                body={post.body}
                createdAtIso={post.created_at}
                visibility={post.visibility}
                attachedItem={
                  post.attached_item
                    ? {
                        title: post.attached_item.title,
                        subtitle: post.attached_item.subtitle,
                        image_url: post.attached_item.image_url,
                        category: post.attached_item.category,
                        rank: post.attached_item.rank,
                      }
                    : null
                }
                isOwn={isOwn}
                onPressAuthor={
                  post.author.username
                    ? () => router.push(`/profile/${post.author.username}` as any)
                    : undefined
                }
                onPressAttachedItem={
                  attachedItemId
                    ? () => router.push(`/list-item/${attachedItemId}` as any)
                    : undefined
                }
                onDelete={isOwn ? () => handleDelete(post.id) : undefined}
              />
              </FadeSlideIn>
            );
          }
          // kind === 'ranking'
          const ev = item.event;
          const authorName =
            ev.author.display_name ?? ev.author.username ?? 'user';
          return (
            <FadeSlideIn delay={staggerDelay}>
            <RankedItemCard
              avatarUri={ev.author.avatar_url}
              authorName={authorName}
              authorUsername={ev.author.username}
              itemTitle={ev.list_item.title}
              itemSubtitle={ev.list_item.subtitle}
              itemImageUrl={ev.list_item.image_url}
              itemCategory={ev.list_item.category}
              score={ev.list_item.rank}
              listTitle={ev.list.title}
              notes={ev.notes}
              createdAtIso={ev.created_at}
              onPressAuthor={
                ev.author.username
                  ? () => router.push(`/profile/${ev.author.username}` as any)
                  : undefined
              }
              onPressItem={() => router.push(`/list-item/${ev.list_item.id}` as any)}
            />
            </FadeSlideIn>
          );
        }}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          loading ? (
            <View>
              <PostCardSkeleton />
              <PostCardSkeleton />
              <PostCardSkeleton />
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <EmptyState
                icon="sparkles-outline"
                title="Your feed is empty"
                subtitle="Follow some people to see their posts here"
                actionLabel="Find friends"
                onAction={() => router.push('/users/search' as any)}
              />
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              color="#A78BFA"
              style={styles.footerSpinner}
            />
          ) : feed.length > 0 && endReached ? (
            <Text style={styles.endLabel}>You're all caught up</Text>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#A78BFA"
            colors={[colors.purple]}
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  listContent: {
    paddingBottom: 100,
  },

  // Header
  greeting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  greetingHello: { color: '#666', fontSize: 16 },
  greetingName: { color: '#fff', fontSize: 26, fontWeight: 'bold' },

  headerActions: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  bellButton: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#ef4444',
    paddingHorizontal: 4,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.bg,
  },
  bellBadgeText: {
    color: '#fff', fontSize: 9, fontWeight: '700',
  },
  composeButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.purple, justifyContent: 'center', alignItems: 'center',
    ...glow.purpleStrong,
  },

  // Feed states
  emptyWrap: {
    paddingTop: 40,
  },
  footerSpinner: {
    paddingVertical: 20,
  },
  endLabel: {
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 24,
  },
});
