/**
 * app/discover.tsx
 *
 * Phase 7 — Public list discovery.
 *
 * Standalone top-level route (not inside (tabs)). Entry point is the
 * "Discover public lists" card at the top of the Search tab landing.
 *
 * Layout:
 *   - Header bar with back button + "Discover" title
 *   - Horizontal scroll of 6 filter chips (All / Movies / TV / Games / Music / Books)
 *   - FlatList of <PublicListCard> fed by fetchPublicLists(activeCategory, 30)
 *   - Pull-to-refresh, empty state, loading state
 *
 * Tapping a card → /(tabs)/lists/[id] (existing list detail handles public
 * via RLS). Tapping the owner row → /profile/{username}.
 */

import { EmptyState, LoadingState, PublicListCard } from '@/components';
import { fetchPublicLists, type PublicListSummary } from '@/lib/queries';
import { colors, radius, spacing, typography } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type FilterKey = 'all' | 'movies' | 'tv' | 'games' | 'music' | 'books';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'movies', label: 'Movies' },
  { key: 'tv', label: 'TV' },
  { key: 'games', label: 'Games' },
  { key: 'music', label: 'Music' },
  { key: 'books', label: 'Books' },
];

export default function DiscoverScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [lists, setLists] = useState<PublicListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (filter: FilterKey, isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      // 'all' → undefined, anything else → the category string.
      const categoryArg = filter === 'all' ? undefined : filter;
      const data = await fetchPublicLists(categoryArg, 30);
      setLists(data);
      if (!isRefresh) setLoading(false);
    },
    [],
  );

  // Refetch on filter change.
  useEffect(() => {
    load(activeFilter);
  }, [activeFilter, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(activeFilter, true);
    setRefreshing(false);
  }, [activeFilter, load]);

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
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Discover</Text>
          <Text style={styles.headerSubtitle}>Public lists from the community</Text>
        </View>
      </View>

      {/* Category filter chips — horizontal scroll so 6 chips always fit. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
        {FILTERS.map((f) => {
          const active = f.key === activeFilter;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setActiveFilter(f.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={lists}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PublicListCard
            title={item.title}
            description={item.description}
            category={item.category}
            itemCount={item.item_count}
            owner={{
              username: item.owner.username,
              display_name: item.owner.display_name,
              avatar_url: item.owner.avatar_url,
            }}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/lists/[id]',
                params: {
                  id: item.id,
                  title: item.title,
                  description: item.description ?? '',
                },
              } as any)
            }
            onOwnerPress={
              item.owner.username
                ? () => router.push(`/profile/${item.owner.username}` as any)
                : undefined
            }
            style={styles.card}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.purpleLight}
            colors={[colors.purple]}
          />
        }
        ListEmptyComponent={
          loading ? (
            <LoadingState label="Loading public lists…" />
          ) : (
            <View style={styles.emptyWrap}>
              <EmptyState
                icon="globe-outline"
                title="No public lists yet"
                subtitle="Be the first — create a list and toggle it public."
              />
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
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
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { ...typography.h3, color: colors.text, fontWeight: '700' },
  headerSubtitle: { ...typography.small, color: colors.textMuted, marginTop: 2 },

  filterScroll: { flexGrow: 0 },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardElevated,
  },
  chipActive: {
    backgroundColor: colors.purpleSoft,
    borderColor: colors.purple,
  },
  chipText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.text },

  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 60 },
  card: { marginBottom: spacing.md },
  emptyWrap: { paddingTop: spacing.xxxl },
});
