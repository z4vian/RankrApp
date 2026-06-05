/**
 * app/(tabs)/recommendations.tsx
 * "For You" feed — per-list recommendations, Movies / Games / Music tabs.
 *
 * Architecture:
 *  - Each category tab shows a vertical list of SECTIONS, one per user list.
 *  - Each section has a horizontal scroll of RecItem cards.
 *  - If the list had no ranked items, the section shows trending picks with
 *    subtitle "Trending right now" (is_trending = true).
 *  - Data + cache helpers live in lib/queries.ts, lib/recommendations.ts,
 *    and lib/recommendationsCache.ts (single source of truth).
 */

import {
  fetchUserLists,
  type UserList,
} from '@/lib/queries';
import {
  fetchRecommendationsForList,
  type RecItem,
  type RecsForList,
} from '@/lib/recommendations';
import {
  getCachedRecsForList,
  setCachedRecsForList,
  invalidateRecsCacheForList,
} from '@/lib/recommendationsCache';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PURPLE = '#7C3AED';
const PURPLE_LIGHT = '#A78BFA';
const BG = '#0f0f13';
const CARD_BG = '#1a1a24';
const BORDER = '#2a2a38';
const INACTIVE_TAB = '#1e1e2e';
const SECTION_BG = '#14141e';

// Horizontal card dimensions — comfortable in a side-scroll
const H_CARD_W = 130;
const H_CARD_GAP = 10;

type Category = 'movies' | 'tv' | 'games' | 'music' | 'books';

// Aspect ratios per category (width / height). TV uses the same 2:3 portrait
// as movies (matches TMDB poster orientation); books also use 2:3 (book
// covers are tall portraits).
const ASPECT: Record<Category, number> = {
  movies: 2 / 3,  // portrait poster
  tv: 2 / 3,      // portrait poster (TMDB)
  games: 16 / 9,  // landscape cover
  music: 1,       // square artwork
  books: 2 / 3,   // portrait cover
};

const TABS: { key: Category; label: string; icon: 'film' | 'tv' | 'game-controller' | 'musical-notes' | 'book' }[] = [
  { key: 'movies', label: 'Movies', icon: 'film' },
  { key: 'tv', label: 'TV', icon: 'tv' },
  { key: 'games', label: 'Games', icon: 'game-controller' },
  { key: 'music', label: 'Music', icon: 'musical-notes' },
  { key: 'books', label: 'Books', icon: 'book' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function imageHeightFor(category: string): number {
  // Defensive default: aspect lookup may receive 'books' / 'tv' from RecItem
  // (lib/recommendations.ts widened RecCategory in Phase 5). Unknown values
  // fall through to the music (1:1) aspect.
  const aspect = (ASPECT as Record<string, number>)[category] ?? ASPECT.music;
  return Math.round(H_CARD_W / aspect);
}

// ---------------------------------------------------------------------------
// HorizontalRecCard — compact card for horizontal scroll
// ---------------------------------------------------------------------------

type HRecCardProps = {
  item: RecItem;
  onPress: () => void;
};

function HRecCard({ item, onPress }: HRecCardProps) {
  const imgH = imageHeightFor(item.category);
  return (
    <TouchableOpacity
      style={[styles.hCard, { width: H_CARD_W }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {item.image_url ? (
        <Image
          source={{ uri: item.image_url }}
          style={[styles.hCardImage, { height: imgH }]}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[styles.hCardImagePlaceholder, { height: imgH }]}>
          <Ionicons name="image-outline" size={22} color="#444" />
        </View>
      )}
      <View style={styles.hCardBody}>
        <Text style={styles.hCardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {item.subtitle ? (
          <Text style={styles.hCardSubtitle} numberOfLines={1}>
            {item.subtitle}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// SectionView — one list's recommendation strip
// ---------------------------------------------------------------------------

type SectionState =
  | { status: 'loading' }
  | { status: 'ok'; result: RecsForList }
  | { status: 'error' };

type SectionViewProps = {
  list: UserList;
  onCardPress: (item: RecItem) => void;
};

function SectionView({ list, onCardPress }: SectionViewProps) {
  const [state, setState] = useState<SectionState>({ status: 'loading' });

  const loadRecs = useCallback(
    async (skipCache = false) => {
      setState({ status: 'loading' });
      try {
        if (!skipCache) {
          const cached = await getCachedRecsForList(list.id);
          if (cached) {
            // Reconstruct a minimal RecsForList from cache — is_trending can't
            // be recovered from cache alone, default false (ranked items implied).
            setState({
              status: 'ok',
              result: {
                list_id: list.id,
                list_title: list.title,
                category: list.category,
                items: cached,
                is_trending: false,
              },
            });
            return;
          }
        }

        const result = await fetchRecommendationsForList(
          list.id,
          list.title,
          list.category
        );
        // Phase 5 bug-5 diagnostic: surface the three relevant numbers so the
        // user can confirm in dev tools why an empty section appeared. This
        // is a triage aid — safe to leave in until trending-API reliability
        // is confirmed.
        console.log('[recs section]', {
          list_id: list.id,
          list_title: list.title,
          category: list.category,
          is_trending: result.is_trending,
          item_count: result.items.length,
        });
        await setCachedRecsForList(list.id, result.items);
        setState({ status: 'ok', result });
      } catch (err) {
        console.error('[SectionView] fetch error', list.id, err);
        setState({ status: 'error' });
      }
    },
    [list]
  );

  useEffect(() => {
    loadRecs();
  }, [loadRecs]);

  const subtitle =
    state.status === 'ok' && state.result.is_trending
      ? 'Trending right now'
      : 'Because you ranked items in this list';

  return (
    <View style={styles.section}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <Text style={styles.sectionTitle}>{list.title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#555" />
      </View>

      {/* Section body */}
      {state.status === 'loading' ? (
        <View style={styles.sectionLoadingRow}>
          <ActivityIndicator size="small" color={PURPLE_LIGHT} />
        </View>
      ) : state.status === 'error' ? (
        <View style={styles.sectionErrorRow}>
          <Text style={styles.sectionErrorText}>Couldn't load recommendations</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => loadRecs(true)}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : state.result.items.length === 0 ? (
        // Phase 5 bug-5: previous copy ("try ranking more items") was wrong
        // when is_trending=true — the lib already fell back to trending, so
        // the empty result is a trending-API miss, not a user-data problem.
        // Use contextual copy + a retry button so the user has agency.
        <View style={styles.sectionEmptyRow}>
          <Text style={styles.sectionEmptyText}>
            {state.result.is_trending
              ? 'Trending picks are unavailable right now. Pull to refresh.'
              : "We couldn't find recs based on this list yet. Try again soon."}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { marginTop: 8, alignSelf: 'flex-start' }]}
            onPress={() => loadRecs(true)}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={state.result.items}
          horizontal
          keyExtractor={(item) => item.external_id}
          renderItem={({ item }) => (
            <HRecCard item={item} onPress={() => onCardPress(item)} />
          )}
          ItemSeparatorComponent={() => <View style={{ width: H_CARD_GAP }} />}
          contentContainerStyle={styles.hScrollContent}
          showsHorizontalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// FeedView — one category's full feed (list of sections + pull-to-refresh)
// ---------------------------------------------------------------------------

type FeedViewProps = {
  category: Category;
  isActive: boolean;
};

function FeedView({ category, isActive }: FeedViewProps) {
  const router = useRouter();
  const [lists, setLists] = useState<UserList[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Bump this to force SectionView instances to re-mount and re-fetch
  const [refreshKey, setRefreshKey] = useState(0);
  const hasFetched = useRef(false);

  const loadLists = useCallback(async () => {
    setListsLoading(true);
    const result = await fetchUserLists(category);
    setLists(result);
    setListsLoading(false);
  }, [category]);

  useEffect(() => {
    if (isActive && !hasFetched.current) {
      hasFetched.current = true;
      loadLists();
    }
  }, [isActive, loadLists]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Re-fetch lists first (in case user created a new list)
    const freshLists = await fetchUserLists(category);
    // Invalidate per-list cache in parallel
    await Promise.all(
      freshLists.map((l) => invalidateRecsCacheForList(l.id))
    );
    setLists(freshLists);
    // Bump refresh key so SectionViews remount and refetch
    setRefreshKey((k) => k + 1);
    setRefreshing(false);
  }, [category]);

  const handleCardPress = useCallback(
    (item: RecItem) => {
      router.push(`/item/${item.category}/${item.external_id}` as any);
    },
    [router]
  );

  // First-load spinner (before even knowing how many lists there are)
  if (listsLoading) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="large" color={PURPLE_LIGHT} />
        <Text style={[styles.stateSubtitle, { marginTop: 16 }]}>
          Loading recommendations…
        </Text>
      </View>
    );
  }

  // No lists in this category
  if (!listsLoading && lists.length === 0) {
    const categoryLabel: string =
      category === 'movies' ? 'Movies'
      : category === 'tv' ? 'TV'
      : category === 'games' ? 'Games'
      : category === 'music' ? 'Music'
      : category === 'books' ? 'Books'
      : 'Movies';
    return (
      <ScrollView
        contentContainerStyle={styles.centeredState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={PURPLE_LIGHT}
            colors={[PURPLE]}
          />
        }
      >
        <View style={styles.stateIconWrap}>
          <Ionicons name="sparkles-outline" size={40} color={PURPLE_LIGHT} />
        </View>
        <Text style={styles.stateTitle}>No {categoryLabel} lists yet</Text>
        <Text style={styles.stateSubtitle}>
          Create a {categoryLabel} list to see recommendations
        </Text>
        <TouchableOpacity
          style={styles.stateButton}
          onPress={() => router.push('/(tabs)/lists/create' as any)}
        >
          <Text style={styles.stateButtonText}>Create a List</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.feedScroll}
      contentContainerStyle={styles.feedContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={PURPLE_LIGHT}
          colors={[PURPLE]}
        />
      }
    >
      {lists.map((list) => (
        <SectionView
          key={`${list.id}-${refreshKey}`}
          list={list}
          onCardPress={handleCardPress}
        />
      ))}
      {/* Bottom padding so last section clears the tab bar */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function RecommendationsScreen() {
  const [activeCategory, setActiveCategory] = useState<Category>('movies');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="sparkles" size={22} color={PURPLE_LIGHT} />
          <Text style={styles.headerTitle}>For You</Text>
        </View>
      </View>

      {/* Category pill tabs — horizontal scroll so 5 pills always fit even on
          narrow phones. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
        style={styles.tabScroll}
      >
        {TABS.map((tab) => {
          const active = tab.key === activeCategory;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabPill,
                active ? styles.tabPillActive : styles.tabPillInactive,
              ]}
              onPress={() => setActiveCategory(tab.key)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={tab.icon}
                size={14}
                color={active ? '#fff' : '#666'}
                style={{ marginRight: 5 }}
              />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Feed — mount all tabs so state/cache persists on switch */}
      <View style={{ flex: 1 }}>
        {TABS.map((tab) => (
          <View
            key={tab.key}
            style={[
              StyleSheet.absoluteFillObject,
              {
                opacity: activeCategory === tab.key ? 1 : 0,
                zIndex: activeCategory === tab.key ? 1 : 0,
                pointerEvents: activeCategory === tab.key ? 'auto' : 'none',
              },
            ]}
          >
            <FeedView category={tab.key} isActive={activeCategory === tab.key} />
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
  },

  // ---- Header ----
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },

  // ---- Category tabs ----
  // tabScroll wraps a horizontal ScrollView. flexGrow: 0 keeps the row at its
  // intrinsic height instead of taking the remaining vertical space.
  tabScroll: {
    flexGrow: 0,
    marginBottom: 16,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabPillActive: {
    backgroundColor: PURPLE,
    borderColor: PURPLE,
  },
  tabPillInactive: {
    backgroundColor: INACTIVE_TAB,
    borderColor: BORDER,
  },
  tabLabel: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#fff',
  },

  // ---- Feed ----
  feedScroll: {
    flex: 1,
  },
  feedContent: {
    paddingTop: 4,
  },

  // ---- Section ----
  section: {
    marginBottom: 8,
    backgroundColor: SECTION_BG,
    paddingTop: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flex: 1,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  sectionSubtitle: {
    color: '#888',
    fontSize: 12,
  },

  // Section states
  sectionLoadingRow: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionErrorRow: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  sectionErrorText: {
    color: '#888',
    fontSize: 13,
  },
  retryButton: {
    backgroundColor: PURPLE,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionEmptyRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionEmptyText: {
    color: '#666',
    fontSize: 13,
    fontStyle: 'italic',
  },

  // Horizontal scroll
  hScrollContent: {
    paddingHorizontal: 16,
  },

  // ---- HRecCard ----
  hCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  hCardImage: {
    width: '100%',
  },
  hCardImagePlaceholder: {
    width: '100%',
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hCardBody: {
    padding: 8,
    gap: 2,
  },
  hCardTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  hCardSubtitle: {
    color: '#666',
    fontSize: 11,
  },

  // ---- Full-screen empty/error states ----
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 40,
  },
  stateIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1e1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  stateTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  stateSubtitle: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  stateButton: {
    backgroundColor: PURPLE,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  stateButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
