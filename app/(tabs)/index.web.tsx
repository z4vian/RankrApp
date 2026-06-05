/**
 * app/(tabs)/index.web.tsx
 *
 * Web-only home feed.  Metro picks this over index.tsx for web builds.
 *
 * Desktop (≥ 1024 px): feed is constrained to max-width 640 px and centred
 * in the content area, removing the dead horizontal space that plagues the
 * mobile layout on wide monitors.  The sidebar is handled by _layout.web.tsx;
 * this file only deals with the feed column itself.
 *
 * Mobile / tablet (< 1024 px): renders identically to index.tsx.
 *
 * We preserve every line of logic from index.tsx (getFeed, pagination, delete,
 * notification badge) — the only change is the wrapping View on desktop.
 *
 * File ownership: web-dev  — do NOT edit index.tsx (native/frontend-dev).
 */

import { getFeed, type FeedItem } from '@/lib/feed';
import { getUnreadNotificationCount } from '@/lib/notifications';
import { deletePost } from '@/lib/posts';
import { useResponsive } from '@/lib/responsive';
import { supabase } from '@/lib/supabase';
import { EmptyState, LoadingState, PostCard, RankedItemCard } from '@/components';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const PURPLE = '#7C3AED';
const BG = '#0f0f13';
const CARD = '#1a1a24';
const BORDER = '#2a2a38';
const PAGE_SIZE = 30;

// ---------------------------------------------------------------------------
// Helpers (identical to index.tsx)
// ---------------------------------------------------------------------------

const createdAtOf = (item: FeedItem): string =>
  item.kind === 'post' ? item.post.created_at : item.event.created_at;

const feedItemKey = (item: FeedItem): string =>
  item.kind === 'post' ? `post:${item.post.id}` : item.event.id;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const router = useRouter();
  const { isDesktop, isWide } = useResponsive();

  const [username, setUsername] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [endReached, setEndReached] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setEndReached(false);
    const [{ data: { user } }, fresh] = await Promise.all([
      supabase.auth.getUser(),
      getFeed(PAGE_SIZE),
    ]);
    setUsername(user?.email?.split('@')[0] ?? '');
    setCurrentUserId(user?.id ?? null);
    setFeed(fresh);
    if (fresh.length < PAGE_SIZE) setEndReached(true);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    loadInitial();
    getUnreadNotificationCount().then(setUnreadCount).catch(() => setUnreadCount(0));
  }, [loadInitial]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setEndReached(false);
    const fresh = await getFeed(PAGE_SIZE);
    setFeed(fresh);
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
      setFeed((prev) => {
        const seen = new Set(prev.map(feedItemKey));
        return [...prev, ...older.filter((i) => !seen.has(feedItemKey(i)))];
      });
      if (older.length < PAGE_SIZE) setEndReached(true);
    }
    setLoadingMore(false);
  }, [loadingMore, endReached, feed]);

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
          hitSlop={6}
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

  const feedList = (
    <FlatList
      data={feed}
      keyExtractor={feedItemKey}
      renderItem={({ item }) => {
        if (item.kind === 'post') {
          const post = item.post;
          const isOwn = currentUserId != null && post.user_id === currentUserId;
          const authorName = post.author.display_name ?? post.author.username ?? 'user';
          const attachedItemId = post.attached_item?.id ?? null;
          return (
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
          );
        }
        const ev = item.event;
        const authorName = ev.author.display_name ?? ev.author.username ?? 'user';
        return (
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
        );
      }}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={
        loading ? (
          <LoadingState label="Loading your feed…" />
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
          <ActivityIndicator color="#A78BFA" style={styles.footerSpinner} />
        ) : feed.length > 0 && endReached ? (
          <Text style={styles.endLabel}>You're all caught up</Text>
        ) : null
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#A78BFA"
          colors={[PURPLE]}
        />
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
    />
  );

  // ------------------------------------------------------------------
  // Desktop: constrain the feed column and centre it.  On mobile/tablet
  // render exactly as the native index.tsx does.
  // ------------------------------------------------------------------
  if (isDesktop || isWide) {
    return (
      <View style={styles.container}>
        <View style={styles.desktopColumn}>
          {feedList}
        </View>
      </View>
    );
  }

  return <View style={styles.container}>{feedList}</View>;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  /**
   * Desktop centred column.  640 px matches Twitter's content width and feels
   * natural at 1024-1440 px viewport widths.  `alignSelf: 'center'` works
   * correctly in react-native-web's flex layout.
   */
  desktopColumn: {
    flex: 1,
    width: '100%' as any,
    maxWidth: 640,
    alignSelf: 'center' as any,
  },

  listContent: {
    paddingBottom: 100,
  },

  // Header — identical to index.tsx
  greeting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 16,
  },
  greetingHello: { color: '#666', fontSize: 16 },
  greetingName: { color: '#fff', fontSize: 26, fontWeight: 'bold' },

  headerActions: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  bellButton: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: CARD, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: BORDER,
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#ef4444',
    paddingHorizontal: 4,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: BG,
  },
  bellBadgeText: {
    color: '#fff', fontSize: 9, fontWeight: '700',
  },
  composeButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: PURPLE, justifyContent: 'center', alignItems: 'center',
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8,
  },

  emptyWrap: { paddingTop: 40 },
  footerSpinner: { paddingVertical: 20 },
  endLabel: {
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 24,
  },
});
