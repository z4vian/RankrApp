/**
 * app/profile/[username]/following.tsx
 * Following list for the profile owner identified by [username].
 */

import { fetchProfileByUsername } from '@/lib/profile';
import {
  followUser,
  getFollowing,
  isFollowing as checkIsFollowing,
  unfollowUser,
  type FollowUser,
} from '@/lib/social';
import {
  EmptyState,
  FollowButton,
  LoadingState,
  UserRow,
} from '@/components';
import { colors, spacing, typography } from '@/lib/theme';
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

/** Mirrors followers.tsx — username is required for navigation. */
type LinkableUser = FollowUser & { username: string };

type RowState = {
  user: LinkableUser;
  isFollowing: boolean;
  loading: boolean;
  isSelf: boolean;
};

export default function FollowingScreen() {
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username: string }>();
  const usernameStr = (username ?? '').toLowerCase();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [rows, setRows] = useState<RowState[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const profile = await fetchProfileByUsername(usernameStr);
    if (!profile) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setNotFound(false);
    const rawUsers = await getFollowing(profile.id, 50);
    // Drop legacy rows without a username — they have no stable handle to
    // navigate to and would render "@undefined".
    const users: LinkableUser[] = rawUsers
      .filter((u): u is LinkableUser => typeof u.username === 'string' && u.username.length > 0);
    const { data: { user: current } } = await supabase.auth.getUser();
    const followingFlags = await Promise.all(
      users.map((u) =>
        current?.id === u.id ? Promise.resolve(false) : checkIsFollowing(u.id),
      ),
    );
    setRows(
      users.map((u, i) => ({
        user: u,
        isFollowing: followingFlags[i],
        loading: false,
        isSelf: current?.id === u.id,
      })),
    );
    setLoading(false);
  }, [usernameStr]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleRow = async (index: number) => {
    const row = rows[index];
    if (!row || row.loading || row.isSelf) return;
    const next = !row.isFollowing;
    setRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...row, isFollowing: next, loading: true };
      return copy;
    });
    try {
      if (next) {
        await followUser(row.user.id);
      } else {
        await unfollowUser(row.user.id);
      }
    } catch (err: any) {
      setRows((prev) => {
        const copy = [...prev];
        copy[index] = { ...row, isFollowing: !next, loading: false };
        return copy;
      });
      Alert.alert('Something went wrong', err?.message ?? 'Please try again.');
      return;
    }
    setRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...row, isFollowing: next, loading: false };
      return copy;
    });
  };

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
        <Text style={styles.headerTitle}>Following</Text>
        <Text style={styles.headerSub}>@{usernameStr}</Text>
      </View>

      {loading ? (
        <LoadingState label="Loading following…" />
      ) : notFound ? (
        <EmptyState
          icon="person-outline"
          title="User not found"
          subtitle={`We couldn't find @${usernameStr}.`}
          actionLabel="Go Back"
          onAction={() => router.back()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="Not following anyone yet"
          subtitle="Tap the find-friends icon to discover users."
        />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        >
          {rows.map((row, i) => (
            <UserRow
              key={row.user.id}
              avatarUri={row.user.avatar_url}
              displayName={row.user.display_name ?? row.user.username}
              username={row.user.username}
              bio={row.user.bio}
              onPress={() => router.push(`/profile/${row.user.username}` as any)}
              trailing={
                row.isSelf ? undefined : (
                  <FollowButton
                    following={row.isFollowing}
                    loading={row.loading}
                    size="sm"
                    onPress={() => toggleRow(i)}
                  />
                )
              }
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    marginBottom: spacing.sm,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
  },
  headerSub: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 2,
  },
});
