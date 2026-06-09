/**
 * app/list-item/[itemId].tsx
 *
 * Phase 3 focal screen — list-item detail with likes, comments, and
 * watched-with tags. Composes ui-ux-dev's design-system components
 * with backend-dev's engagement helpers.
 */

import {
  addComment,
  deleteComment,
  getComments,
  getLikeCount,
  getWatchedWithUsers,
  hasUserLiked,
  likeItem,
  tagWatchedWith,
  unlikeItem,
  untagWatchedWith,
  type Comment as EngagementComment,
  type TaggedUser,
} from '@/lib/engagement';
import { searchUsers } from '@/lib/profile';
import {
  fetchListItemWithOwner,
  type ListItemDetail,
} from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { colors, radius, scoreColor, spacing, typography } from '@/lib/theme';
import {
  CommentBubble,
  CommentInput,
  EmptyState,
  EngagementBar,
  LoadingState,
  UserRow,
  UserTagPicker,
  useToast,
  type TaggableUser,
} from '@/components';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sentimentMeta: Record<
  string,
  { label: string; color: string; emoji: string }
> = {
  liked: { label: 'Liked', color: colors.sentiment.loved, emoji: '👍' },
  didnt_care: { label: 'Meh', color: colors.sentiment.meh, emoji: '😐' },
  didnt_like: { label: 'Disliked', color: colors.sentiment.hated, emoji: '👎' },
};

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ListItemDetailScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ListItemDetail | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Engagement state
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [comments, setComments] = useState<EngagementComment[]>([]);
  const [watchedWith, setWatchedWith] = useState<TaggedUser[]>([]);
  const [engagementAllowed, setEngagementAllowed] = useState(false);

  // Modal state
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [watchedSheetOpen, setWatchedSheetOpen] = useState(false);

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  const load = useCallback(async () => {
    if (!itemId) return;
    setLoading(true);

    const result = await fetchListItemWithOwner(itemId);
    if (!result) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setDetail(result);

    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id ?? null;
    setCurrentUserId(uid);

    const isOwner = uid != null && uid === result.list_user_id;
    const isPublic = result.list_visibility === 'public';
    const canEngage = isOwner || isPublic;
    setEngagementAllowed(canEngage);

    if (canEngage) {
      // Wrap each query so one failure doesn't kill the whole load.
      const [lc, hl, cs, ww] = await Promise.all([
        getLikeCount(itemId).catch(() => 0),
        hasUserLiked(itemId).catch(() => false),
        getComments(itemId).catch(() => [] as EngagementComment[]),
        getWatchedWithUsers(itemId).catch(() => [] as TaggedUser[]),
      ]);
      setLikeCount(lc);
      setLiked(hl);
      setComments(cs);
      setWatchedWith(ww);
    } else {
      setLikeCount(0);
      setLiked(false);
      setComments([]);
      setWatchedWith([]);
    }

    setLoading(false);
  }, [itemId]);

  useEffect(() => {
    load();
  }, [load]);

  // -------------------------------------------------------------------------
  // Engagement handlers
  // -------------------------------------------------------------------------

  const handleToggleLike = useCallback(async () => {
    if (!detail || likeLoading) return;
    const next = !liked;
    // Optimistic
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    setLikeLoading(true);
    try {
      if (next) {
        await likeItem(detail.id);
      } else {
        await unlikeItem(detail.id);
      }
    } catch (err: any) {
      // Revert
      setLiked(!next);
      setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
      showToast(err?.message ?? 'Could not update like. Please try again.', { tone: 'error' });
    } finally {
      setLikeLoading(false);
    }
  }, [detail, liked, likeLoading]);

  const handleAddComment = useCallback(
    async (body: string): Promise<void> => {
      if (!detail) return;
      // `addComment` throws on failure — CommentInput already surfaces an
      // Alert in that case, so just re-throw to let it handle the UX.
      const created = await addComment(detail.id, body);
      setComments((prev) => [...prev, created]);
    },
    [detail],
  );

  const handleDeleteComment = useCallback(async (commentId: string) => {
    try {
      await deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err: any) {
      showToast(err?.message ?? 'Could not delete comment. Please try again.', { tone: 'error' });
    }
  }, [showToast]);

  const handleTagWatchedWith = useCallback(
    async (user: TaggableUser) => {
      if (!detail) return;
      setTagPickerOpen(false);
      // Optimistic
      const tagged: TaggedUser = {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
      };
      setWatchedWith((prev) => [...prev, tagged]);
      try {
        await tagWatchedWith(detail.id, user.id);
      } catch (err: any) {
        setWatchedWith((prev) => prev.filter((u) => u.id !== user.id));
        showToast(err?.message ?? 'Could not tag user. Please try again.', { tone: 'error' });
      }
    },
    [detail],
  );

  const handleUntagWatchedWith = useCallback(
    async (userId: string) => {
      if (!detail) return;
      const prev = watchedWith;
      setWatchedWith((p) => p.filter((u) => u.id !== userId));
      try {
        await untagWatchedWith(detail.id, userId);
      } catch (err: any) {
        setWatchedWith(prev);
        showToast(err?.message ?? 'Could not untag user. Please try again.', { tone: 'error' });
      }
    },
    [detail, watchedWith],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <BackButton onPress={() => router.back()} />
        <LoadingState label="Loading…" />
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <BackButton onPress={() => router.back()} />
        <View style={styles.notFoundWrap}>
          <EmptyState
            icon="alert-circle-outline"
            title="Item not found"
            subtitle="This item may have been removed or is private."
            actionLabel="Go Back"
            onAction={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const isOwner = currentUserId === detail.list_user_id;
  const sentimentInfo = detail.sentiment ? sentimentMeta[detail.sentiment] : null;
  const excludeUserIds = [
    ...watchedWith.map((u) => u.id),
    ...(currentUserId ? [currentUserId] : []),
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BackButton onPress={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ----- Hero ----- */}
        <View style={styles.hero}>
          {detail.image_url ? (
            <Image source={{ uri: detail.image_url }} style={styles.poster} />
          ) : (
            <View style={[styles.poster, styles.posterPlaceholder]}>
              <Ionicons name="image-outline" size={40} color={colors.textMuted} />
            </View>
          )}
          <View style={styles.heroInfo}>
            <Text style={styles.heroTitle}>{detail.title}</Text>
            {detail.subtitle ? (
              <Text style={styles.heroSubtitle}>{detail.subtitle}</Text>
            ) : null}
            <View style={styles.heroBadges}>
              {sentimentInfo ? (
                <View
                  style={[
                    styles.sentimentChip,
                    { borderColor: sentimentInfo.color },
                  ]}
                >
                  <Text style={styles.sentimentEmoji}>{sentimentInfo.emoji}</Text>
                  <Text style={[styles.sentimentLabel, { color: sentimentInfo.color }]}>
                    {sentimentInfo.label}
                  </Text>
                </View>
              ) : null}
              {detail.rank !== null ? (
                <View style={[styles.rankBadge, { borderColor: scoreColor(detail.rank) }]}>
                  <Text style={[styles.rankText, { color: scoreColor(detail.rank) }]}>
                    {Number(detail.rank).toFixed(1)}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.listContextRow}>
              <Ionicons name="list-outline" size={14} color={colors.textMuted} />
              <Text style={styles.listContextText}>
                in <Text style={styles.listContextName}>{detail.list_title}</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* ----- Owner-only action bar ----- */}
        {isOwner ? (
          <View style={styles.ownerBar}>
            <TouchableOpacity
              style={styles.ownerBarBtn}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/lists/[id]',
                  params: {
                    id: detail.list_id,
                    title: detail.list_title,
                    description: '',
                  },
                } as any)
              }
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={16} color={colors.text} />
              <Text style={styles.ownerBarBtnLabel}>Edit in list</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ownerBarBtn}
              onPress={() =>
                router.push(`/post/compose?listItemId=${detail.id}` as any)
              }
              activeOpacity={0.7}
            >
              <Ionicons name="share-outline" size={16} color={colors.text} />
              <Text style={styles.ownerBarBtnLabel}>Share</Text>
            </TouchableOpacity>
            {/* Phase 7 — Re-rank. Nulls out the current rank and routes to
                the category's search screen with ?relistItemId=, which the
                search screen catches on mount and pushes the item back into
                the comparison flow. */}
            <TouchableOpacity
              style={styles.ownerBarBtn}
              onPress={() =>
                Alert.alert(
                  'Re-rank this item?',
                  'The current score will be replaced once you compare it again.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Re-rank',
                      onPress: async () => {
                        const { error } = await supabase
                          .from('list_items')
                          .update({ rank: null })
                          .eq('id', detail.id);
                        if (error) {
                          showToast(error.message, { tone: 'error' });
                          return;
                        }
                        // Route to the category's search screen with the
                        // re-rank payload. Categories that aren't one of the
                        // five mapped screens fall back to movies; this
                        // shouldn't happen in practice but it's safer than a
                        // 404.
                        const cat = ['movies', 'tv', 'games', 'music', 'books'].includes(detail.category)
                          ? detail.category
                          : 'movies';
                        router.replace(
                          `/(tabs)/search/${cat}?relistItemId=${detail.id}` as any,
                        );
                      },
                    },
                  ],
                )
              }
              activeOpacity={0.7}
            >
              <Ionicons name="repeat-outline" size={16} color={colors.text} />
              <Text style={styles.ownerBarBtnLabel}>Re-rank</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ownerBarBtn}
              onPress={() =>
                Alert.alert(
                  detail.title,
                  undefined,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete from list',
                      style: 'destructive',
                      onPress: async () => {
                        const { error } = await supabase
                          .from('list_items')
                          .delete()
                          .eq('id', detail.id);
                        if (error) {
                          showToast(error.message, { tone: 'error' });
                        } else {
                          router.back();
                        }
                      },
                    },
                  ],
                )
              }
              activeOpacity={0.7}
            >
              <Ionicons name="ellipsis-horizontal" size={16} color={colors.text} />
              <Text style={styles.ownerBarBtnLabel}>More</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ----- Notes ----- */}
        {detail.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>NOTES</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{detail.notes}</Text>
            </View>
          </View>
        ) : null}

        {/* ----- Photos ----- */}
        {detail.photo_urls && detail.photo_urls.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PHOTOS</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoStrip}
            >
              {detail.photo_urls.map((uri, idx) => (
                <Image
                  key={`${uri}-${idx}`}
                  source={{ uri }}
                  style={styles.photoThumb}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* ----- Engagement bar ----- */}
        {engagementAllowed ? (
          <EngagementBar
            likeCount={likeCount}
            hasUserLiked={liked}
            onLikePress={handleToggleLike}
            likeLoading={likeLoading}
            commentCount={comments.length}
            onCommentsPress={() => {
              // Comments are inline below — no scroll-to needed in v1, but the
              // prop is required by EngagementBar. Future: pass a real scrollRef.
            }}
            watchedWithUsers={watchedWith}
            showAddWatchedWith={isOwner}
            onAddWatchedWithPress={
              isOwner
                ? () => setTagPickerOpen(true)
                : watchedWith.length > 0
                  ? () => setWatchedSheetOpen(true)
                  : undefined
            }
          />
        ) : null}

        {/* Tap the stack to see the full list (when there are tagged users) */}
        {engagementAllowed && watchedWith.length > 0 && !isOwner ? (
          <TouchableOpacity
            style={styles.viewAllWatchedBtn}
            onPress={() => setWatchedSheetOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllWatchedText}>See everyone tagged</Text>
          </TouchableOpacity>
        ) : null}

        {/* ----- Comments ----- */}
        {engagementAllowed ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>COMMENTS</Text>
            {comments.length === 0 ? (
              <Text style={styles.noComments}>Be the first to comment.</Text>
            ) : (
              comments.map((c) => {
                const authorName =
                  c.author.display_name ?? c.author.username ?? 'user';
                return (
                  <CommentBubble
                    key={c.id}
                    avatarUri={c.author.avatar_url}
                    authorName={authorName}
                    authorUsername={c.author.username}
                    body={c.body}
                    createdAtIso={c.created_at}
                    edited={c.edited_at != null}
                    isOwn={c.user_id === currentUserId}
                    onDelete={
                      c.user_id === currentUserId
                        ? () => handleDeleteComment(c.id)
                        : undefined
                    }
                    onPressAuthor={
                      c.author.username
                        ? () => router.push(`/profile/${c.author.username}` as any)
                        : undefined
                    }
                  />
                );
              })
            )}
          </View>
        ) : null}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>

      {engagementAllowed ? (
        <CommentInput onSubmit={handleAddComment} />
      ) : null}

      {/* ----- Tag-watched-with modal ----- */}
      <Modal
        visible={tagPickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setTagPickerOpen(false)}
      >
        <SafeAreaView style={styles.safe} edges={['top']}>
          <UserTagPicker
            search={async (q) => {
              const found = await searchUsers(q, 20);
              return found.map((u) => ({
                id: u.id,
                username: u.username,
                display_name: u.display_name,
                avatar_url: u.avatar_url,
              }));
            }}
            excludeUserIds={excludeUserIds}
            onSelectUser={handleTagWatchedWith}
            onClose={() => setTagPickerOpen(false)}
          />
        </SafeAreaView>
      </Modal>

      {/* ----- Watched-with full-list modal ----- */}
      <Modal
        visible={watchedSheetOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setWatchedSheetOpen(false)}
      >
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.watchedHeader}>
            <Text style={styles.watchedHeaderTitle}>Watched with</Text>
            <TouchableOpacity
              onPress={() => setWatchedSheetOpen(false)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close watched-with sheet"
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }}>
            {watchedWith.map((u) => {
              const username = u.username;
              return (
                <UserRow
                  key={u.id}
                  avatarUri={u.avatar_url}
                  displayName={u.display_name ?? username ?? 'unknown'}
                  username={username ?? 'unknown'}
                  onPress={
                    username
                      ? () => {
                          setWatchedSheetOpen(false);
                          router.push(`/profile/${username}` as any);
                        }
                      : undefined
                  }
                  trailing={
                    isOwner ? (
                      <TouchableOpacity
                        onPress={() => handleUntagWatchedWith(u.id)}
                        hitSlop={12}
                        style={styles.untagBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${u.display_name ?? u.username ?? 'user'}`}
                      >
                        <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                      </TouchableOpacity>
                    ) : undefined
                  }
                />
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Back button
// ---------------------------------------------------------------------------

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.backBtn}
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Ionicons name="chevron-back" size={22} color={colors.text} />
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  backBtn: {
    position: 'absolute',
    top: spacing.xxl + 8,
    left: spacing.lg,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingTop: spacing.xxl + 24,
  },
  notFoundWrap: {
    flex: 1,
    justifyContent: 'center',
  },

  // Hero
  hero: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  poster: {
    width: 110,
    height: 165,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
  },
  posterPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroInfo: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  heroTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  heroBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sentimentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: colors.card,
  },
  sentimentEmoji: {
    fontSize: 13,
  },
  sentimentLabel: {
    ...typography.caption,
    fontWeight: '700',
  },
  rankBadge: {
    minWidth: 44,
    paddingHorizontal: spacing.sm,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  rankText: {
    fontSize: 13,
    fontWeight: '700',
  },
  listContextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  listContextText: {
    ...typography.small,
    color: colors.textMuted,
    flexShrink: 1,
  },
  listContextName: {
    color: colors.text,
    fontWeight: '600',
  },

  // Owner action bar
  ownerBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  ownerBarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ownerBarBtnLabel: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },

  // Section
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  sectionLabel: {
    ...typography.micro,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },

  // Notes
  notesCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notesText: {
    ...typography.body,
    color: colors.text,
  },

  // Photos
  photoStrip: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  photoThumb: {
    width: 120,
    height: 120,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
  },

  // Comments
  noComments: {
    ...typography.small,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: spacing.sm,
  },

  viewAllWatchedBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  viewAllWatchedText: {
    ...typography.caption,
    color: colors.purpleLight,
    fontWeight: '600',
  },

  // Watched-with sheet
  watchedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  watchedHeaderTitle: {
    ...typography.h3,
    color: colors.text,
  },
  untagBtn: {
    padding: 4,
  },
});
