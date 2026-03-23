import { supabase } from '@/lib/supabase';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

const PURPLE = '#7C3AED';
const PURPLE_LIGHT = '#A78BFA';
const BG = '#0f0f13';
const CARD = '#1a1a24';
const BORDER = '#2a2a38';

type RecentItem = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  rank: number | null;
  sentiment: string | null;
  list_title: string;
  created_at: string;
};

const scoreColor = (rank: number | null) => {
  if (rank === null) return '#555';
  if (rank >= 8) return '#22c55e';
  if (rank >= 6) return '#eab308';
  if (rank >= 4) return '#f97316';
  return '#ef4444';
};

export default function HomeScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHome = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setUsername(user?.email?.split('@')[0] ?? '');

    // Fetch recent items with list name
    const { data: items } = await supabase
      .from('list_items')
      .select('id, title, subtitle, image_url, rank, sentiment, created_at, list_id')
      .order('created_at', { ascending: false })
      .limit(20);

    if (items) {
      const enriched = await Promise.all(
        items.map(async (item) => {
          const { data: list } = await supabase
            .from('lists')
            .select('title')
            .eq('id', item.list_id)
            .single();
          return { ...item, list_title: list?.title ?? 'Unknown List' };
        })
      );
      setRecentItems(enriched);
    }
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchHome(); }, []));

  const renderItem = ({ item }: { item: RecentItem }) => (
    <View style={styles.activityCard}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.activityImage} />
      ) : (
        <View style={styles.activityImagePlaceholder}>
          <Ionicons name="image-outline" size={20} color="#555" />
        </View>
      )}
      <View style={styles.activityInfo}>
        <Text style={styles.activityTitle} numberOfLines={1}>{item.title}</Text>
        {item.subtitle ? (
          <Text style={styles.activitySubtitle} numberOfLines={1}>{item.subtitle}</Text>
        ) : null}
        <Text style={styles.activityList}>📋 {item.list_title}</Text>
      </View>
      {item.rank !== null ? (
        <View style={[styles.scoreBadge, { borderColor: scoreColor(item.rank) }]}>
          <Text style={[styles.scoreText, { color: scoreColor(item.rank) }]}>
            {Number(item.rank).toFixed(1)}
          </Text>
        </View>
      ) : (
        <View style={[styles.scoreBadge, { borderColor: '#333' }]}>
          <Text style={[styles.scoreText, { color: '#444' }]}>—</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={recentItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <View>
            {/* Greeting */}
            <View style={styles.greeting}>
              <View>
                <Text style={styles.greetingHello}>Hello,</Text>
                <Text style={styles.greetingName}>@{username} 👋</Text>
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => router.push('/(tabs)/search' as any)}
              >
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Quick actions */}
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => router.push('/(tabs)/lists' as any)}
              >
                <View style={[styles.quickIcon, { backgroundColor: '#7C3AED22' }]}>
                  <Ionicons name="list" size={20} color={PURPLE_LIGHT} />
                </View>
                <Text style={styles.quickLabel}>My Lists</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => router.push('/(tabs)/search' as any)}
              >
                <View style={[styles.quickIcon, { backgroundColor: '#6366f122' }]}>
                  <Ionicons name="search" size={20} color="#818cf8" />
                </View>
                <Text style={styles.quickLabel}>Search</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => router.push('/(tabs)/lists/create' as any)}
              >
                <View style={[styles.quickIcon, { backgroundColor: '#22c55e22' }]}>
                  <Ionicons name="add-circle" size={20} color="#22c55e" />
                </View>
                <Text style={styles.quickLabel}>New List</Text>
              </TouchableOpacity>
            </View>

            {/* Recent activity header */}
            {loading ? (
              <ActivityIndicator color={PURPLE_LIGHT} style={{ marginTop: 40 }} />
            ) : recentItems.length > 0 ? (
              <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
            ) : (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="trophy-outline" size={40} color={PURPLE_LIGHT} />
                </View>
                <Text style={styles.emptyText}>Nothing ranked yet</Text>
                <Text style={styles.emptySubtext}>
                  Start by creating a list and searching for items
                </Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => router.push('/(tabs)/lists/create' as any)}
                >
                  <Text style={styles.emptyButtonText}>Create First List</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  greeting: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 24,
  },
  greetingHello: { color: '#666', fontSize: 16 },
  greetingName: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  addButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: PURPLE, justifyContent: 'center', alignItems: 'center',
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8,
  },

  quickActions: {
    flexDirection: 'row', paddingHorizontal: 16,
    gap: 10, marginBottom: 28,
  },
  quickAction: {
    flex: 1, backgroundColor: CARD, borderRadius: 14,
    padding: 14, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: BORDER,
  },
  quickIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  quickLabel: { color: '#aaa', fontSize: 12, fontWeight: '500' },

  sectionTitle: {
    color: '#555', fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, paddingHorizontal: 20, marginBottom: 12,
  },

  activityCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER, overflow: 'hidden',
  },
  activityImage: { width: 56, height: 56 },
  activityImagePlaceholder: {
    width: 56, height: 56, backgroundColor: '#111',
    justifyContent: 'center', alignItems: 'center',
  },
  activityInfo: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  activityTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  activitySubtitle: { color: '#666', fontSize: 12, marginBottom: 2 },
  activityList: { color: '#555', fontSize: 11 },
  scoreBadge: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center', marginHorizontal: 10,
  },
  scoreText: { fontSize: 12, fontWeight: 'bold' },

  empty: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 32 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#1e1a2e', justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyText: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  emptySubtext: { color: '#666', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyButton: {
    backgroundColor: PURPLE, borderRadius: 20,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  emptyButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});