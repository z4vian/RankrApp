/**
 * app/(tabs)/index.web.tsx
 *
 * Web-only home feed.  Metro picks this over index.tsx for web builds.
 *
 * Layout breakdown:
 *   - Mobile / tablet (< 1024 px):           single-column FlatList, identical
 *                                            to native index.tsx.
 *   - Narrow desktop (1024 ≤ w < 1280 px):   single column centred at
 *                                            max-width 640 px (no right rail).
 *   - Wide desktop (w ≥ 1280 px):            centred container with the feed
 *                                            (max 640 px) on the left and a
 *                                            320 px right rail showing
 *                                            "Who to follow" suggestions.
 *
 * SSR safety: the desktop / wide-desktop branches are gated by `hasMounted`,
 * so the SSR pass always emits the mobile tree (which then hydrates cleanly).
 * See _layout.web.tsx for the matching pattern.
 *
 * File ownership: web-dev  — do NOT edit index.tsx (native/frontend-dev).
 */

import { getFeed, type FeedItem } from '@/lib/feed';
import { getUnreadNotificationCount } from '@/lib/notifications';
import { deletePost } from '@/lib/posts';
import { useResponsive } from '@/lib/responsive';
import {
  followUser,
  getSuggestedUsers,
  type FollowUser,
} from '@/lib/social';
import { supabase } from '@/lib/supabase';
import { colors, glow, radius, spacing, typography } from '@/lib/theme';
import {
  Avatar,
  EmptyState,
  FollowButton,
  LoadingState,
  PostCard,
  RankedItemCard,
  useToast,
} from '@/components';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ---------------------------------------------------------------------------
// Tokens / constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 30;

/**
 * Width thresholds — kept permissive so 1366×768 laptops still get the rail.
 *
 * - `>= 1024` triggers the centred desktop column (no rail).
 * - `>= 1280` triggers the two-column layout with the right rail.
 *
 * Below 1280 the rail is hidden, not just empty — we don't fetch suggestions
 * either, to avoid a wasted round-trip.
 */
const DESKTOP_MIN_WIDTH = 1024;
const RAIL_MIN_WIDTH = 1280;

const SUGGESTION_LIMIT = 5;

// ---------------------------------------------------------------------------
// Helpers (identical to index.tsx)
// ---------------------------------------------------------------------------

const createdAtOf = (item: FeedItem): string =>
  item.kind === 'post' ? item.post.created_at : item.event.created_at;

const feedItemKey = (item: FeedItem): string =>
  item.kind === 'post' ? `post:${item.post.id}` : item.event.id;

// ---------------------------------------------------------------------------
// Right-rail subcomponents
// ---------------------------------------------------------------------------

interface SuggestionRowProps {
  user: FollowUser;
  onPressProfile: () => void;
  onFollow: () => Promise<boolean>;
}

/**
 * Single "Who to follow" row.  Owns its own follow-button loading state so
 * each row can be tapped independently — we don't want one in-flight follow
 * to disable the whole rail.
 */
function SuggestionRow({ user, onPressProfile, onFollow }: SuggestionRowProps) {
  const [loading, setLoading] = useState(false);

  const handleFollow = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onFollow();
    } finally {
      setLoading(false);
    }
  }, [loading, onFollow]);

  const display = user.display_name ?? user.username ?? 'user';

  return (
    <Pressable
      onPress={onPressProfile}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        railStyles.row,
        (hovered as boolean) && railStyles.rowHovered,
        pressed && railStyles.rowPressed,
      ]}
    >
      <Avatar uri={user.avatar_url} name={display} size={40} />
      <View style={railStyles.rowText}>
        <Text style={railStyles.displayName} numberOfLines={1}>{display}</Text>
        {user.username ? (
          <Text style={railStyles.username} numberOfLines={1}>@{user.username}</Text>
        ) : null}
        {user.bio ? (
          <Text style={railStyles.bio} numberOfLines={2}>{user.bio}</Text>
        ) : null}
      </View>
      <View style={railStyles.followWrap}>
        <FollowButton
          following={false}
          loading={loading}
          onPress={handleFollow}
          size="sm"
        />
      </View>
    </Pressable>
  );
}

interface WhoToFollowCardProps {
  users: FollowUser[];
  loaded: boolean;
  onPressProfile: (username: string) => void;
  onFollow: (user: FollowUser) => Promise<boolean>;
  onSeeMore: () => void;
}

function WhoToFollowCard({
  users,
  loaded,
  onPressProfile,
  onFollow,
  onSeeMore,
}: WhoToFollowCardProps) {
  return (
    <View style={railStyles.card}>
      <Text style={railStyles.cardTitle}>Who to follow</Text>

      {!loaded ? (
        <View style={railStyles.placeholder}>
          <ActivityIndicator color={colors.purpleLight} />
        </View>
      ) : users.length === 0 ? (
        <Text style={railStyles.placeholderText}>No suggestions right now.</Text>
      ) : (
        <View>
          {users.map((u, idx) => (
            <View key={u.id}>
              <SuggestionRow
                user={u}
                onPressProfile={() => {
                  if (u.username) onPressProfile(u.username);
                }}
                onFollow={() => onFollow(u)}
              />
              {idx < users.length - 1 ? <View style={railStyles.divider} /> : null}
            </View>
          ))}
        </View>
      )}

      <Pressable
        onPress={onSeeMore}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
          railStyles.seeMore,
          (hovered as boolean) && railStyles.seeMoreHovered,
          pressed && { opacity: 0.6 },
        ]}
      >
        <Text style={railStyles.seeMoreText}>See more →</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { width } = useResponsive();

  // SSR-safe desktop detection — useWindowDimensions reports 0 during the
  // expo-router static-export pass, so we re-read window.innerWidth post-mount
  // to make the desktop column constraint reliable.
  const [postMountWidth, setPostMountWidth] = useState(0);
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
    if (typeof window !== 'undefined') {
      setPostMountWidth(window.innerWidth);
      const onResize = () => setPostMountWidth(window.innerWidth);
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }
  }, []);
  const effectiveWidth = hasMounted ? Math.max(postMountWidth, width) : 0;
  const showDesktopColumn = hasMounted && effectiveWidth >= DESKTOP_MIN_WIDTH;
  const showRail = hasMounted && effectiveWidth >= RAIL_MIN_WIDTH;

  const [username, setUsername] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [endReached, setEndReached] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Right-rail state
  const [suggested, setSuggested] = useState<FollowUser[]>([]);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);

  // Fetch suggestions only when the rail is visible.  Re-runs when the user
  // resizes from narrow to wide so the rail populates on first reveal.
  useEffect(() => {
    if (!showRail) return;
    if (suggestionsLoaded) return; // don't re-fetch on subsequent resizes
    let cancelled = false;
    getSuggestedUsers(SUGGESTION_LIMIT).then((users) => {
      if (cancelled) return;
      setSuggested(users);
      setSuggestionsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [showRail, suggestionsLoaded]);

  // ---- Feed loading (unchanged from prior pass) -----------------------------

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

  // ---- Right-rail handlers --------------------------------------------------

  /**
   * Optimistically remove the user from the rail, then call followUser().
   * On error, splice them back in at their original position and toast.
   */
  const handleFollowSuggestion = useCallback(
    async (user: FollowUser): Promise<boolean> => {
      let originalIndex = -1;
      setSuggested((prev) => {
        originalIndex = prev.findIndex((u) => u.id === user.id);
        return prev.filter((u) => u.id !== user.id);
      });
      try {
        await followUser(user.id);
        return true;
      } catch (err: any) {
        // Revert
        setSuggested((prev) => {
          if (originalIndex < 0) return [user, ...prev];
          const next = [...prev];
          next.splice(Math.min(originalIndex, next.length), 0, user);
          return next;
        });
        showToast(err?.message ?? 'Could not follow user', { tone: 'error' });
        return false;
      }
    },
    [showToast],
  );

  const handlePressSuggestionProfile = useCallback(
    (uname: string) => {
      router.push(`/profile/${uname}` as any);
    },
    [router],
  );

  // ---- Render bits ----------------------------------------------------------

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
          <ActivityIndicator color={colors.purpleLight} style={styles.footerSpinner} />
        ) : feed.length > 0 && endReached ? (
          <Text style={styles.endLabel}>You're all caught up</Text>
        ) : null
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.purpleLight}
          colors={[colors.purple]}
        />
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
    />
  );

  // -------------------------------------------------------------------
  // Branch A — Wide desktop: feed + right rail
  // -------------------------------------------------------------------
  if (showRail) {
    return (
      <View style={styles.container}>
        <View style={styles.wideRow}>
          <View style={styles.wideFeedCol}>{feedList}</View>
          <View style={styles.railCol}>
            <WhoToFollowCard
              users={suggested}
              loaded={suggestionsLoaded}
              onPressProfile={handlePressSuggestionProfile}
              onFollow={handleFollowSuggestion}
              onSeeMore={() => router.push('/users/search' as any)}
            />
          </View>
        </View>
      </View>
    );
  }

  // -------------------------------------------------------------------
  // Branch B — Narrow desktop: centred feed, no rail
  // -------------------------------------------------------------------
  if (showDesktopColumn) {
    return (
      <View style={styles.container}>
        <View style={styles.desktopColumn}>
          {feedList}
        </View>
      </View>
    );
  }

  // -------------------------------------------------------------------
  // Branch C — Mobile / tablet: identical to native index.tsx
  // -------------------------------------------------------------------
  return <View style={styles.container}>{feedList}</View>;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  /**
   * Narrow-desktop centred column (1024 ≤ w < 1280).  Single column max-width
   * 640 px to remove dead horizontal space without committing to a rail.
   */
  desktopColumn: {
    flex: 1,
    width: '100%' as any,
    maxWidth: 640,
    alignSelf: 'center' as any,
  },

  /**
   * Wide-desktop two-column container (w ≥ 1280).  Row of [feed | rail],
   * constrained to 1200 px so the whole layout stays anchored even on 4K.
   */
  wideRow: {
    flex: 1,
    flexDirection: 'row',
    width: '100%' as any,
    maxWidth: 1200,
    alignSelf: 'center' as any,
    paddingHorizontal: spacing.lg,
  },
  wideFeedCol: {
    flex: 1,
    maxWidth: 640,
  },
  railCol: {
    width: 320,
    marginLeft: spacing.xl,
    paddingTop: 40, // align with feed greeting block paddingTop
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
  greetingHello: { color: colors.textMuted, fontSize: 16 },
  greetingName: { color: colors.text, fontSize: 26, fontWeight: 'bold' },

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
    backgroundColor: colors.error,
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

  emptyWrap: { paddingTop: 40 },
  footerSpinner: { paddingVertical: 20 },
  endLabel: {
    color: colors.textPlaceholder,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 24,
  },
});

// ---------------------------------------------------------------------------
// Right-rail styles — kept separate so the feed styles above stay readable
// ---------------------------------------------------------------------------

const railStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    // Sticks below the top of the viewport while the feed scrolls.  Cast to
    // any because react-native-web supports `position: 'sticky'` but RN's
    // type definitions don't include it.
    position: 'sticky' as any,
    top: spacing.xl,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    gap: spacing.md,
  },
  rowHovered: {
    backgroundColor: colors.cardElevated,
  },
  rowPressed: {
    backgroundColor: colors.cardElevated,
    opacity: 0.8,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  displayName: {
    ...typography.bodyBold,
    color: colors.text,
  },
  username: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 1,
  },
  bio: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  followWrap: {
    justifyContent: 'center',
    paddingTop: spacing.xs,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },

  placeholder: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  placeholderText: {
    ...typography.small,
    color: colors.textMuted,
    paddingVertical: spacing.lg,
    textAlign: 'center',
  },

  seeMore: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'flex-start',
  },
  seeMoreHovered: {
    opacity: 0.85,
  },
  seeMoreText: {
    ...typography.bodyBold,
    color: colors.purpleLight,
  },
});
