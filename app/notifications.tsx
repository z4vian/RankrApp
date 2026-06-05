/**
 * app/notifications.tsx
 *
 * Standalone notifications screen. Header + FlatList of NotificationRows.
 * Pull-to-refresh re-fetches the feed; markNotificationsAsSeen fires once
 * after the items load so the unread badge clears.
 */

import {
  getNotifications,
  markNotificationsAsSeen,
  type Notification,
} from '@/lib/notifications';
import { colors, spacing, typography } from '@/lib/theme';
import { EmptyState, LoadingState, NotificationRow } from '@/components';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
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
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Initial load + every time the screen regains focus. After items render,
  // mark them as seen so the unread badge clears.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        const fresh = await getNotifications(50);
        if (cancelled) return;
        setItems(fresh);
        setLoading(false);
        // Fire-and-forget — failure here is non-critical, just leaves the
        // badge stale for a moment.
        markNotificationsAsSeen().catch(() => {});
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const fresh = await getNotifications(50);
    setItems(fresh);
    setRefreshing(false);
    markNotificationsAsSeen().catch(() => {});
  }, []);

  const handlePress = useCallback(
    (n: Notification) => {
      // All three kinds (like / comment / tagged_watched_with) route to the
      // list-item detail screen — backend-dev's Notification.list_item is
      // required for all three.
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
          hitSlop={10}
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
            <NotificationRow
              kind={item.kind}
              actor={item.actor}
              itemTitle={item.list_item.title}
              itemImageUrl={item.list_item.image_url}
              commentPreview={item.comment_preview}
              createdAtIso={item.created_at}
              isUnread={item.is_unread}
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
});
