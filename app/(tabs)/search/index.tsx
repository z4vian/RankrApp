import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const PURPLE = '#7C3AED';
const PURPLE_LIGHT = '#A78BFA';
const BG = '#0f0f13';
const CARD = '#1a1a24';
const BORDER = '#2a2a38';

const CATEGORIES = [
  {
    key: 'movies',
    label: 'Movies',
    icon: 'film' as const,
    description: 'Films, series & documentaries',
    color: '#6366f1',
    route: '/search/movies',
  },
  {
    key: 'music',
    label: 'Music',
    icon: 'musical-notes' as const,
    description: 'Tracks, albums & artists',
    color: '#ec4899',
    route: '/search/music',
  },
  {
    key: 'games',
    label: 'Video Games',
    icon: 'game-controller' as const,
    description: 'Games across all platforms',
    color: '#22c55e',
    route: '/search/games',
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

        <View style={styles.categories}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={styles.categoryCard}
              onPress={() => router.push(cat.route as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.categoryIcon, { backgroundColor: cat.color + '22' }]}>
                <Ionicons name={cat.icon} size={32} color={cat.color} />
              </View>
              <View style={styles.categoryInfo}>
                <Text style={styles.categoryLabel}>{cat.label}</Text>
                <Text style={styles.categoryDesc}>{cat.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#444" />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.tipBox}>
          <Ionicons name="information-circle-outline" size={16} color={PURPLE_LIGHT} />
          <Text style={styles.tipText}>
            Open a list first, then search to add items directly to it
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  container: { flex: 1, backgroundColor: BG },
  header: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24,
  },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 4 },
  headerSubtitle: { color: '#666', fontSize: 15 },
  categories: { paddingHorizontal: 16, gap: 12 },
  categoryCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: BORDER, gap: 14,
  },
  categoryIcon: {
    width: 56, height: 56, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  categoryInfo: { flex: 1 },
  categoryLabel: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 3 },
  categoryDesc: { color: '#666', fontSize: 13 },
  tipBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: 16, marginTop: 24,
    backgroundColor: '#1e1a2e', borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: '#2e2a4e',
  },
  tipText: { flex: 1, color: '#888', fontSize: 13, lineHeight: 18 },
});