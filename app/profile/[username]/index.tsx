/**
 * app/profile/[username]/index.tsx
 * Public profile page — header, stats, public lists.
 *
 * Composed entirely from ui-ux-dev's design-system components.
 */

import {
  deletePost,
  getPostsByUser,
  type Post,
} from '@/lib/posts';
import {
  fetchProfileByUsername,
  fetchProfileStats,
  type PublicProfile,
} from '@/lib/profile';
import { fetchPublicListsByUserId } from '@/lib/queries';
import type { UserList } from '@/lib/queries';
import {
  followUser,
  isFollowing as checkIsFollowing,
  unfollowUser,
} from '@/lib/social';
import {
  EmptyState,
  LoadingState,
  PostCard,
  ProfileHeader,
  useToast,
} from '@/components';
import { colors, radius, spacing, typography } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Stats shape returned by fetchProfileStats — kept local to avoid a re-export. */
type ProfileStats = {
  listsCount: number;
  itemsCount: number;
  followersCount: number;
  followingCount: number;
};

const categoryIcon = (category: string) => {
  if (category === 'movies') return 'film';
  if (category === 'music') return 'musical-notes';
  return 'game-controller';
};

export default function PublicProfileScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { username } = useLocalSearchParams<{ username: string }>();
  const usernameStr = (username ?? '').toLowerCase();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [lists, setLists] = useState<UserList[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSelf, setIsSelf] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const found = await fetchProfileByUsername(usernameStr);
    if (!found) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setProfile(found);

    const { data: { user } } = await supabase.auth.getUser();
    const self = user?.id === found.id;
    setCurrentUserId(user?.id ?? null);
    setIsSelf(self);

    const [statsResult, listsResult, postsResult, followingResult] = await Promise.all([
      fetchProfileStats(found.id),
      fetchPublicListsByUserId(found.id),
      getPostsByUser(found.id, 20),
      self ? Promise.resolve(false) : checkIsFollowing(found.id),
    ]);
    setStats(statsResult);
    setLists(listsResult);
    setPosts(postsResult);
    setFollowing(followingResult);
    setLoading(false);
  }, [usernameStr]);

  const handleDeletePost = useCallback(
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
                setPosts((prev) => prev.filter((p) => p.id !== postId));
              } catch (err: any) {
                showToast(err?.message ?? 'Could not delete post. Please try again.', { tone: 'error' });
              }
            },
          },
        ],
      );
    },
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleFollowToggle = async () => {
    if (!profile || followLoading) return;
    const next = !following;
    setFollowing(next); // optimistic
    setFollowLoading(true);
    try {
      if (next) {
        await followUser(profile.id);
      } else {
        await unfollowUser(profile.id);
      }
      // Refresh counts in the background.
      fetchProfileStats(profile.id).then(setStats).catch(() => {});
    } catch (err: any) {
      setFollowing(!next); // revert
      showToast(err?.message ?? 'Something went wrong. Please try again.', { tone: 'error' });
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <BackButton onPress={() => router.back()} />
        <LoadingState label="Loading profile…" />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <BackButton onPress={() => router.back()} />
        <View style={styles.notFoundWrap}>
          <EmptyState
            icon="person-outline"
            title="User not found"
            subtitle={`We couldn't find @${usernameStr}.`}
            actionLabel="Go Back"
            onAction={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const headerStats = stats ?? {
    listsCount: 0,
    itemsCount: 0,
    followersCount: 0,
    followingCount: 0,
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BackButton onPress={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ProfileHeader
          avatarUri={profile.avatar_url}
          displayName={profile.display_name ?? profile.username}
          username={profile.username}
          bio={profile.bio}
          stats={headerStats}
          isSelf={isSelf}
          isFollowing={following}
          followLoading={followLoading}
          onFollowToggle={handleFollowToggle}
          onEditProfile={() => router.push('/(tabs)/profile-settings' as any)}
          onFollowersPress={() =>
            router.push(`/profile/${profile.username}/followers` as any)
          }
          onFollowingPress={() =>
            router.push(`/profile/${profile.username}/following` as any)
          }
        />

        {/* Phase 7 — Compare button. Sits directly under ProfileHeader (which
            renders the Follow button inside it), so visually it's adjacent to
            Follow. Only shown for other users. */}
        {!isSelf ? (
          <View style={styles.compareActionRow}>
            <TouchableOpacity
              style={styles.compareBtn}
              onPress={() => router.push(`/profile/${profile.username}/compare` as any)}
              activeOpacity={0.85}
            >
              <Ionicons name="git-compare-outline" size={16} color={colors.purpleLight} />
              <Text style={styles.compareBtnText}>Compare with me</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Public Lists section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PUBLIC LISTS</Text>
          {lists.length === 0 ? (
            <EmptyState
              icon="list-outline"
              title="No public lists yet"
              subtitle={
                isSelf
                  ? 'Toggle a list to public from its detail page to share it.'
                  : `@${profile.username} hasn't shared any lists yet.`
              }
            />
          ) : (
            lists.map((list) => (
              <TouchableOpacity
                key={list.id}
                style={styles.listRow}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/lists/[id]',
                    params: {
                      id: list.id,
                      title: list.title,
                      description: '',
                    },
                  } as any)
                }
                activeOpacity={0.7}
              >
                <View style={styles.listIcon}>
                  <Ionicons
                    name={categoryIcon(list.category) as any}
                    size={20}
                    color={colors.purpleLight}
                  />
                </View>
                <View style={styles.listInfo}>
                  <Text style={styles.listTitle} numberOfLines={1}>
                    {list.title}
                  </Text>
                  <Text style={styles.listMeta}>{list.category}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Posts section. PostCard handles its own horizontal margin, so the
            section header lives in a padded sub-container while the cards
            render flush. */}
        <View style={styles.postsSection}>
          <Text style={[styles.sectionHeader, styles.postsSectionHeader]}>POSTS</Text>
          {posts.length === 0 ? (
            <Text style={styles.noPostsText}>No posts yet</Text>
          ) : (
            posts.map((post) => {
              const isOwn = currentUserId != null && post.user_id === currentUserId;
              const authorName =
                post.author.display_name ?? post.author.username ?? 'user';
              const attachedItemId = post.attached_item?.id ?? null;
              return (
                <PostCard
                  key={post.id}
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
                  onDelete={isOwn ? () => handleDeletePost(post.id) : undefined}
                />
              );
            })
          )}
        </View>

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.backBtn} onPress={onPress} hitSlop={10}>
      <Ionicons name="chevron-back" size={22} color={colors.text} />
    </TouchableOpacity>
  );
}

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
    paddingTop: spacing.lg,
  },
  notFoundWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  sectionHeader: {
    ...typography.micro,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  listIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.purpleSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listInfo: {
    flex: 1,
  },
  listTitle: {
    ...typography.bodyBold,
    color: colors.text,
    marginBottom: 2,
  },
  listMeta: {
    ...typography.small,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },

  // Posts section
  postsSection: {
    marginTop: spacing.lg,
  },
  postsSectionHeader: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  noPostsText: {
    ...typography.small,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },

  // Phase 7 — Compare button (sits below ProfileHeader)
  compareActionRow: {
    paddingHorizontal: spacing.lg,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  compareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.purpleSoft,
    borderWidth: 1, borderColor: colors.purple,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  compareBtnText: { ...typography.bodyBold, color: colors.purpleLight },
});
