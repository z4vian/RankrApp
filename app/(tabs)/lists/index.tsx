import { supabase } from '@/lib/supabase';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';

const PURPLE = '#7C3AED';
const PURPLE_LIGHT = '#A78BFA';
const BG = '#0f0f13';
const CARD = '#1a1a24';
const BORDER = '#2a2a38';

type List = {
  id: string;
  title: string;
  description: string;
  category: string;
  created_at: string;
  item_count?: number;
  top_image?: string;
};

export default function ListsScreen() {
  const router = useRouter();
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLists = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('lists')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const enriched = await Promise.all(
        data.map(async (list) => {
          const { count } = await supabase
            .from('list_items')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', list.id);

          const { data: topItem } = await supabase
            .from('list_items')
            .select('image_url')
            .eq('list_id', list.id)
            .order('rank', { ascending: false, nullsFirst: false })
            .limit(1)
            .single();

          return {
            ...list,
            item_count: count ?? 0,
            top_image: topItem?.image_url ?? null,
          };
        })
      );
      setLists(enriched);
    }
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchLists(); }, []));

  const handleDelete = (list: List) => {
    Alert.alert(
      'Delete List',
      `Are you sure you want to delete "${list.title}"? This will also delete all items in it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('lists').delete().eq('id', list.id);
            fetchLists();
          },
        },
      ]
    );
  };

  const categoryIcon = (category: string) => {
    if (category === 'movies') return 'film';
    if (category === 'music') return 'musical-notes';
    return 'game-controller';
  };

  const categoryLabel = (category: string) => {
    if (category === 'movies') return 'Movies';
    if (category === 'music') return 'Music';
    return 'Games';
  };

  const renderRightActions = (list: List) => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={() => handleDelete(list)}
    >
      <Ionicons name="trash-outline" size={22} color="#fff" />
      <Text style={styles.deleteActionText}>Delete</Text>
    </TouchableOpacity>
  );

  const renderList = ({ item }: { item: List }) => (
    <Swipeable renderRightActions={() => renderRightActions(item)}>
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({
          pathname: '/(tabs)/lists/[id]',
          params: { id: item.id, title: item.title, description: item.description ?? '' }
        } as any)}
        activeOpacity={0.8}
      >
        <View style={styles.cardCover}>
          {item.top_image ? (
            <Image source={{ uri: item.top_image }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name={categoryIcon(item.category) as any} size={32} color={PURPLE_LIGHT} />
            </View>
          )}
          <View style={styles.coverOverlay} />
          <View style={styles.coverContent}>
            <View style={styles.categoryBadge}>
              <Ionicons name={categoryIcon(item.category) as any} size={12} color="#fff" />
              <Text style={styles.categoryBadgeText}>{categoryLabel(item.category)}</Text>
            </View>
          </View>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardMain}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.description ? (
              <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>
            ) : null}
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.cardCount}>{item.item_count}</Text>
            <Text style={styles.cardCountLabel}>items</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Lists</Text>
          <TouchableOpacity
            style={styles.newButton}
            onPress={() => router.push('/(tabs)/lists/create' as any)}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.newButtonText}>New</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={PURPLE_LIGHT} style={{ marginTop: 40 }} />
        ) : lists.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="list" size={40} color={PURPLE_LIGHT} />
            </View>
            <Text style={styles.emptyText}>No lists yet</Text>
            <Text style={styles.emptySubtext}>Create your first ranked list</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(tabs)/lists/create' as any)}
            >
              <Text style={styles.emptyButtonText}>Create a List</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={lists}
            keyExtractor={(item) => item.id}
            renderItem={renderList}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20,
  },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  newButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: PURPLE, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  newButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  card: {
    backgroundColor: CARD, borderRadius: 16, marginBottom: 16,
    overflow: 'hidden', borderWidth: 1, borderColor: BORDER,
  },
  cardCover: { height: 120, position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: {
    width: '100%', height: '100%', backgroundColor: '#1e1a2e',
    justifyContent: 'center', alignItems: 'center',
  },
  coverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  coverContent: { position: 'absolute', bottom: 10, left: 12 },
  categoryBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: PURPLE, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4,
  },
  categoryBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  cardBody: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, justifyContent: 'space-between',
  },
  cardMain: { flex: 1 },
  cardTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', marginBottom: 2 },
  cardDesc: { color: '#888', fontSize: 13 },
  cardMeta: { alignItems: 'center', marginLeft: 12 },
  cardCount: { color: PURPLE_LIGHT, fontSize: 22, fontWeight: 'bold' },
  cardCountLabel: { color: '#666', fontSize: 11 },
  deleteAction: {
    backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center',
    width: 80, borderRadius: 16, marginBottom: 16, gap: 4,
  },
  deleteActionText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#1e1a2e', justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyText: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  emptySubtext: { color: '#666', fontSize: 14, marginBottom: 24 },
  emptyButton: {
    backgroundColor: PURPLE, borderRadius: 20,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  emptyButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});