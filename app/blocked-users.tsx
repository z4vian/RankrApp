/**
 * app/blocked-users.tsx
 *
 * Pre-beta Session 1 — Blocked-users management screen. Entered from
 * profile-settings ("Privacy → Blocked users"). Lists everyone the current
 * user has blocked, with an "Unblock" button per row.
 *
 * Empty state is the default UX: most users will never block anyone, so the
 * affordance has to make sense in the zero-row case.
 *
 * No back-end churn here — uses `getBlockedUsers` and `unblockUser` from
 * `@/lib/moderation`. Optimistically removes the row on tap and re-inserts
 * it if the unblock call fails.
 */

import {
  EmptyState,
  LoadingState,
  UserRow,
  useToast,
} from '@/components';
import { getBlockedUsers, unblockUser, type BlockedUser } from '@/lib/moderation';
import { colors, radius, spacing, typography } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BlockedUsersScreen() {
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await getBlockedUsers();
    setBlocked(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUnblock = useCallback(
    async (user: BlockedUser) => {
      if (busyId) return;
      setBusyId(user.id);
      const prev = blocked;
      // Optimistic remove.
      setBlocked((curr) => curr.filter((u) => u.id !== user.id));
      try {
        await unblockUser(user.id);
        showToast(
          user.username ? `Unblocked @${user.username}` : 'Unblocked',
          { tone: 'success' },
        );
      } catch (err: any) {
        // Rollback on failure.
        setBlocked(prev);
        showToast(err?.message ?? 'Could not unblock', { tone: 'error' });
      } finally {
        setBusyId(null);
      }
    },
    [blocked, busyId, showToast],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Blocked users</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <LoadingState label="Loading…" />
      ) : blocked.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="ban-outline"
            title="No one is blocked"
            subtitle="When you block someone, they'll show up here. They won't appear in your feed or be able to interact with your activity."
          />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list}>
          <Text style={styles.intro}>
            People you've blocked don't appear in your feed and can't interact
            with your activity. Unblocking lets them see your public content
            again, but does not automatically refollow them.
          </Text>
          {blocked.map((user) => {
            const username = user.username ?? 'unknown';
            const displayName = user.display_name ?? user.username ?? 'user';
            const busy = busyId === user.id;
            return (
              <View key={user.id} style={styles.row}>
                <UserRow
                  avatarUri={user.avatar_url}
                  displayName={displayName}
                  username={username}
                  trailing={
                    <TouchableOpacity
                      onPress={() => handleUnblock(user)}
                      disabled={busy}
                      activeOpacity={0.7}
                      style={[styles.unblockBtn, busy && styles.unblockBtnDisabled]}
                      accessibilityRole="button"
                      accessibilityLabel={
                        user.username
                          ? `Unblock @${user.username}`
                          : 'Unblock user'
                      }
                    >
                      <Text style={styles.unblockBtnText}>
                        {busy ? 'Working…' : 'Unblock'}
                      </Text>
                    </TouchableOpacity>
                  }
                  onPress={
                    user.username
                      ? () => router.push(`/profile/${user.username}` as any)
                      : undefined
                  }
                />
              </View>
            );
          })}
          <View style={{ height: spacing.xxxl }} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.h3,
    color: colors.text,
  },
  list: {
    paddingTop: spacing.md,
  },
  intro: {
    ...typography.small,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    lineHeight: 18,
  },
  row: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },

  // Compact Unblock pill — UserRow has its own padding, so the button just
  // needs to look like a tappable secondary action inside the trailing slot.
  unblockBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unblockBtnDisabled: {
    opacity: 0.5,
  },
  unblockBtnText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
});
