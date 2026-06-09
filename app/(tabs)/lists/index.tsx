import { ListCardSkeleton, PressableCard } from '@/components';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert, FlatList,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';

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
    // SECURITY: scope to the current user. Without this filter, public lists
    // owned by OTHER users would leak in here (RLS allows reading any
    // visibility='public' list — see docs/PHASE-1-MIGRATION.sql §4).
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) { setLists([]); setLoading(false); return; }
    // PERF: 2 queries instead of 2N+1. Embedded count gives per-list totals;
    // a single batched fetch over all list_items yields top images, grouped
    // in JS by list_id (rows arrive pre-ordered by rank).
    const { data, error } = await supabase
      .from('lists')
      .select('*, list_items(count)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const listIds = data.map((l) => l.id);
      const topImageByList: Record<string, string> = {};

      if (listIds.length > 0) {
        const { data: items } = await supabase
          .from('list_items')
          .select('list_id, image_url, rank')
          .in('list_id', listIds)
          .not('image_url', 'is', null)
          .order('rank', { ascending: false, nullsFirst: false });

        if (items) {
          for (const item of items) {
            if (!topImageByList[item.list_id] && item.image_url) {
              topImageByList[item.list_id] = item.image_url;
            }
          }
        }
      }

      const enriched = data.map((list: any) => ({
        ...list,
        item_count: list.list_items?.[0]?.count ?? 0,
        top_image: topImageByList[list.id] ?? null,
      }));
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
      <PressableCard
        style={styles.card}
        onPress={() => router.push({
          pathname: '/(tabs)/lists/[id]',
          params: { id: item.id, title: item.title, description: item.description ?? '' }
        } as any)}
        accessibilityLabel={`Open list ${item.title}`}
      >
        <View style={styles.cardCover}>
          {item.top_image ? (
            <Image
              source={{ uri: item.top_image }}
              style={styles.coverImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name={categoryIcon(item.category) as any} size={32} color={colors.purpleLight} />
            </View>
          )}
          <View style={styles.coverOverlay} />
          <View style={styles.coverContent}>
            <View style={styles.categoryBadge}>
              <Ionicons name={categoryIcon(item.category) as any} size={12} color={colors.purpleLight} />
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
      </PressableCard>
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
          <View style={{ padding: 16, paddingTop: 8 }}>
            <ListCardSkeleton />
            <ListCardSkeleton />
            <ListCardSkeleton />
          </View>
        ) : lists.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="list" size={40} color={colors.purpleLight} />
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
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20,
  },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  newButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.purple, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  newButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  card: {
    backgroundColor: colors.card, borderRadius: 16, marginBottom: 16,
    overflow: 'hidden', borderWidth: 1, borderColor: colors.border,
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
    backgroundColor: 'rgba(15,15,19,0.7)',
    borderWidth: 1, borderColor: colors.purpleSoft,
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4,
  },
  categoryBadgeText: { color: colors.purpleLight, fontSize: 11, fontWeight: '600' },
  cardBody: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, justifyContent: 'space-between',
  },
  cardMain: { flex: 1 },
  cardTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', marginBottom: 2 },
  cardDesc: { color: '#888', fontSize: 13 },
  cardMeta: { alignItems: 'center', marginLeft: 12 },
  cardCount: { color: colors.purpleLight, fontSize: 22, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
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
    backgroundColor: colors.purple, borderRadius: 20,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  emptyButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});