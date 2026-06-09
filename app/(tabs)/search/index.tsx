import { colors, glow } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const CATEGORIES = [
  {
    key: 'movies',
    label: 'Movies',
    icon: 'film' as const,
    description: 'Films & documentaries',
    color: '#6366f1',
    route: '/search/movies',
  },
  {
    key: 'tv',
    label: 'TV Shows',
    icon: 'tv-outline' as const,
    description: 'Series & streaming',
    color: '#f97316',
    route: '/search/tv',
  },
  {
    key: 'music',
    label: 'Music',
    icon: 'musical-notes' as const,
    description: 'Tracks & albums',
    color: '#ec4899',
    route: '/search/music',
  },
  {
    key: 'games',
    label: 'Games',
    icon: 'game-controller' as const,
    description: 'All platforms',
    color: '#22c55e',
    route: '/search/games',
  },
  {
    key: 'books',
    label: 'Books',
    icon: 'book-outline' as const,
    description: 'Novels & non-fiction',
    color: '#0ea5e9',
    route: '/search/books',
  },
];

export default function SearchLanding() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Search</Text>
          <Text style={styles.headerSubtitle}>Find something to rank</Text>
        </View>

        {/* Phase 7 — Discover entry. Full-width purple-tinted card sits ABOVE
            the category grid so it's the first thing the eye lands on, and
            visually distinct from the 5 search-category cards below. */}
        <TouchableOpacity
          style={styles.discoverCard}
          onPress={() => router.push('/discover' as any)}
          activeOpacity={0.85}
        >
          <View style={styles.discoverIconWrap}>
            <Ionicons name="compass-outline" size={28} color="#fff" />
          </View>
          <View style={styles.discoverInfo}>
            <Text style={styles.discoverLabel}>Discover public lists</Text>
            <Text style={styles.discoverDesc}>
              Browse rankings from the community
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>

        <View style={styles.grid}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={styles.gridCard}
              onPress={() => router.push(cat.route as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.gridIcon, { backgroundColor: cat.color + '22' }]}>
                <Ionicons name={cat.icon} size={28} color={cat.color} />
              </View>
              <Text style={styles.gridLabel}>{cat.label}</Text>
              <Text style={styles.gridDesc} numberOfLines={1}>{cat.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.tipBox}>
          <Ionicons name="information-circle-outline" size={16} color={colors.purpleLight} />
          <Text style={styles.tipText}>
            Open a list first, then search to add items directly to it
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20,
  },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 4 },
  headerSubtitle: { color: '#666', fontSize: 15 },

  // Phase 7 — Discover entry card. Purple-tinted, full-width, sits above the
  // 5-category grid as the primary visual anchor.
  discoverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.purple,
    borderRadius: 16,
    ...glow.purple,
  },
  discoverIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  discoverInfo: { flex: 1 },
  discoverLabel: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 3 },
  discoverDesc: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 12,
  },
  gridCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    // 2-col layout: take ~half the available width, minus the row gap.
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 130,
    justifyContent: 'flex-start',
  },
  gridIcon: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  gridLabel: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 3 },
  gridDesc: { color: '#666', fontSize: 12 },
  tipBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: 16, marginTop: 24,
    backgroundColor: '#1e1a2e', borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: '#2e2a4e',
  },
  tipText: { flex: 1, color: '#888', fontSize: 13, lineHeight: 18 },
});
