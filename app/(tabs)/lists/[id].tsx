import { useActiveList } from '@/lib/ListContext';
import { supabase } from '@/lib/supabase';
import Ionicons from '@expo/vector-icons/Ionicons';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';

const PURPLE = '#7C3AED';
const PURPLE_LIGHT = '#A78BFA';
const BG = '#0f0f13';
const CARD = '#1a1a24';
const BORDER = '#2a2a38';

type ListItem = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  rank: number | null;
  notes: string | null;
  photo_urls: string[] | null;
  sentiment: string | null;
  category: string;
  bookmarked: boolean | null;
};

type Sentiment = 'liked' | 'didnt_care' | 'didnt_like';

const scoreColor = (rank: number | null) => {
  if (rank === null) return '#555';
  if (rank >= 8) return '#22c55e';
  if (rank >= 6) return '#eab308';
  if (rank >= 4) return '#f97316';
  return '#ef4444';
};

const sentimentColor = (s: string | null) => {
  if (s === 'liked') return '#22c55e';
  if (s === 'didnt_care') return '#9e9e9e';
  if (s === 'didnt_like') return '#ef4444';
  return PURPLE;
};

export default function ListDetail() {
  const { id, title, description } = useLocalSearchParams<{
    id: string; title: string; description: string;
  }>();
  const router = useRouter();
  const { setActiveList } = useActiveList();
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'rankings' | 'saved'>('rankings');

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['70%', '95%'], []);
  const [editingItem, setEditingItem] = useState<ListItem | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [editSentiment, setEditSentiment] = useState<Sentiment | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('list_items')
      .select('*')
      .eq('list_id', id)
      .order('rank', { ascending: false, nullsFirst: false });
    if (!error && data) setItems(data);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => {
    fetchItems();
    setActiveList({ id: id as string, title: title as string, category: '' });
    return () => setActiveList(null);
  }, [id, title]));

  const bookmarkedItems = items.filter(i => i.bookmarked);
  const rankableItems = items.filter(i => !i.bookmarked);
  const rankedItems = rankableItems
    .filter(i => i.rank !== null)
    .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));
  const unrankedItems = rankableItems.filter(i => i.rank === null);
  const allRankableItems = [...rankedItems, ...unrankedItems];
  const displayItems = activeTab === 'rankings' ? allRankableItems : bookmarkedItems;

  const avgScore = rankedItems.length > 0
    ? (rankedItems.reduce((sum, i) => sum + (i.rank ?? 0), 0) / rankedItems.length).toFixed(1)
    : null;

  const coverImage = allRankableItems.find(i => i.image_url)?.image_url;

  const handleDragEnd = async ({ data }: { data: ListItem[] }) => {
    const reordered = data.map((item, index) => ({
      ...item,
      rank: item.rank !== null
        ? parseFloat((10 - index * (9 / Math.max(data.length - 1, 1))).toFixed(2))
        : null,
    }));
    setItems(prev => {
      const bookmarks = prev.filter(i => i.bookmarked);
      return [...reordered, ...bookmarks];
    });
    await Promise.all(
      reordered
        .filter(i => i.rank !== null)
        .map(i => supabase.from('list_items').update({ rank: i.rank }).eq('id', i.id))
    );
  };

  const handleDeleteList = () => {
    Alert.alert(
      'Delete List',
      `Are you sure you want to delete "${title}"? This will also delete all ${items.length} items in it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await supabase.from('lists').delete().eq('id', id);
            router.back();
          },
        },
      ]
    );
  };

  const openEditSheet = (item: ListItem) => {
    setEditingItem(item);
    setEditNotes(item.notes ?? '');
    setEditPhotos(item.photo_urls ?? []);
    setEditSentiment((item.sentiment as Sentiment) ?? null);
    bottomSheetRef.current?.expand();
  };

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setEditPhotos(prev => [...prev, ...result.assets.map(a => a.uri)]);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    setSaving(true);
    await supabase
      .from('list_items')
      .update({ notes: editNotes, photo_urls: editPhotos, sentiment: editSentiment })
      .eq('id', editingItem.id);
    setSaving(false);
    bottomSheetRef.current?.close();
    fetchItems();
  };

  const handleMoveToRankings = async () => {
    if (!editingItem) return;
    await supabase
      .from('list_items')
      .update({ bookmarked: false })
      .eq('id', editingItem.id);
    bottomSheetRef.current?.close();
    fetchItems();
  };

  const handleRemoveItem = () => {
    if (!editingItem) return;
    Alert.alert(
      'Remove Item',
      `Remove "${editingItem.title}" from this list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            await supabase.from('list_items').delete().eq('id', editingItem.id);
            bottomSheetRef.current?.close();
            fetchItems();
          },
        },
      ]
    );
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<ListItem>) => {
    const position = allRankableItems.findIndex(i => i.id === item.id);
    const isRanked = item.rank !== null;

    return (
      <ScaleDecorator>
        <TouchableOpacity
          style={[styles.itemCard, isActive && styles.itemCardActive]}
          onPress={() => openEditSheet(item)}
          onLongPress={activeTab === 'rankings' ? drag : undefined}
          delayLongPress={200}
          activeOpacity={0.8}
        >
          <View style={styles.positionCol}>
            {activeTab === 'rankings' ? (
              isRanked ? (
                <Text style={styles.positionText}>{position + 1}</Text>
              ) : (
                <Text style={styles.positionDash}>—</Text>
              )
            ) : (
              <Ionicons name="bookmark" size={14} color={PURPLE_LIGHT} />
            )}
          </View>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.itemImage} />
          ) : (
            <View style={styles.noImage}>
              <Ionicons name="image-outline" size={18} color="#555" />
            </View>
          )}
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
            {item.subtitle ? (
              <Text style={styles.itemSubtitle} numberOfLines={1}>{item.subtitle}</Text>
            ) : null}
            {item.notes ? (
              <Text style={styles.itemNotes} numberOfLines={1}>📝 {item.notes}</Text>
            ) : null}
          </View>
          {activeTab === 'rankings' && (
            isRanked ? (
              <View style={[styles.scoreBadge, { borderColor: scoreColor(item.rank) }]}>
                <Text style={[styles.scoreText, { color: scoreColor(item.rank) }]}>
                  {Number(item.rank).toFixed(1)}
                </Text>
              </View>
            ) : (
              <View style={[styles.scoreBadge, { borderColor: '#333' }]}>
                <Text style={[styles.scoreText, { color: '#444' }]}>—</Text>
              </View>
            )
          )}
          {activeTab === 'rankings' && (
            <Ionicons name="reorder-two-outline" size={20} color="#333" style={{ marginLeft: 4, marginRight: 6 }} />
          )}
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.container}>
        {loading ? (
          <ActivityIndicator color={PURPLE_LIGHT} style={{ marginTop: 40 }} />
        ) : (
          <DraggableFlatList
            data={displayItems}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            onDragEnd={activeTab === 'rankings' ? handleDragEnd : undefined}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListHeaderComponent={
              <View>
                {/* Cover */}
                <View style={styles.coverContainer}>
                  {coverImage ? (
                    <Image source={{ uri: coverImage }} style={styles.coverImage} blurRadius={8} />
                  ) : (
                    <View style={styles.coverPlaceholder} />
                  )}
                  <View style={styles.coverOverlay} />
                  <View style={styles.coverTopRow}>
                    <TouchableOpacity style={styles.coverBtn} onPress={() => router.back()}>
                      <Ionicons name="chevron-back" size={22} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.coverBtn} onPress={handleDeleteList}>
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.coverTitleArea}>
                    <Text style={styles.coverTitle}>{title}</Text>
                    {description ? (
                      <Text style={styles.coverDesc}>{description}</Text>
                    ) : null}
                  </View>
                </View>

                {/* Stats */}
                <View style={styles.statsBar}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{allRankableItems.length}</Text>
                    <Text style={styles.statLabel}>Items</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, avgScore ? { color: scoreColor(parseFloat(avgScore)) } : {}]}>
                      {avgScore ?? '—'}
                    </Text>
                    <Text style={styles.statLabel}>Avg Score</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{bookmarkedItems.length}</Text>
                    <Text style={styles.statLabel}>Saved</Text>
                  </View>
                </View>

                {/* Progress */}
                {allRankableItems.length < 10 && allRankableItems.length > 0 && (
                  <View style={styles.progressBox}>
                    <View style={styles.progressHeader}>
                      <Text style={styles.progressText}>
                        {10 - allRankableItems.length} more to unlock ranking
                      </Text>
                      <Text style={styles.progressPercent}>{allRankableItems.length}/10</Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${(allRankableItems.length / 10) * 100}%` as any }]} />
                    </View>
                  </View>
                )}

                {/* Tab toggle */}
                <View style={styles.tabToggle}>
                  <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'rankings' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('rankings')}
                  >
                    <Text style={[styles.tabBtnText, activeTab === 'rankings' && styles.tabBtnTextActive]}>
                      Rankings
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'saved' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('saved')}
                  >
                    <View style={styles.tabBtnInner}>
                      <Text style={[styles.tabBtnText, activeTab === 'saved' && styles.tabBtnTextActive]}>
                        Saved for Later
                      </Text>
                      {bookmarkedItems.length > 0 && (
                        <View style={styles.tabBadge}>
                          <Text style={styles.tabBadgeText}>{bookmarkedItems.length}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>

                {displayItems.length === 0 && (
                  <View style={styles.empty}>
                    <View style={styles.emptyIcon}>
                      <Ionicons
                        name={activeTab === 'rankings' ? 'add-circle-outline' : 'bookmark-outline'}
                        size={40}
                        color={PURPLE_LIGHT}
                      />
                    </View>
                    <Text style={styles.emptyText}>
                      {activeTab === 'rankings' ? 'Nothing here yet' : 'No saved items'}
                    </Text>
                    <Text style={styles.emptySubtext}>
                      {activeTab === 'rankings'
                        ? 'Tap + to search and add items'
                        : 'Use "Save for Later" when searching'}
                    </Text>
                  </View>
                )}

                {displayItems.length > 0 && (
                  <View style={styles.listHeader}>
                    <Text style={styles.listHeaderText}>
                      {activeTab === 'rankings'
                        ? (rankedItems.length > 0 ? 'RANKINGS' : 'ITEMS')
                        : 'SAVED FOR LATER'}
                    </Text>
                    {activeTab === 'rankings' && (
                      <Text style={styles.listHeaderHint}>Hold to reorder</Text>
                    )}
                  </View>
                )}
              </View>
            }
          />
        )}

        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/(tabs)/search' as any)}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Edit Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={{ backgroundColor: '#444' }}
      >
        <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
          {editingItem && (
            <>
              <View style={styles.sheetHeader}>
                {editingItem.image_url ? (
                  <Image source={{ uri: editingItem.image_url }} style={styles.sheetImage} />
                ) : (
                  <View style={styles.sheetImagePlaceholder}>
                    <Ionicons name="image-outline" size={24} color="#555" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>{editingItem.title}</Text>
                  {editingItem.subtitle ? (
                    <Text style={styles.sheetSubtitle}>{editingItem.subtitle}</Text>
                  ) : null}
                  {editingItem.rank !== null && (
                    <View style={[styles.sheetScoreBadge, { borderColor: scoreColor(editingItem.rank) }]}>
                      <Text style={[styles.sheetScoreText, { color: scoreColor(editingItem.rank) }]}>
                        {Number(editingItem.rank).toFixed(1)}
                      </Text>
                    </View>
                  )}
                  {editingItem.bookmarked && (
                    <View style={styles.bookmarkBadge}>
                      <Ionicons name="bookmark" size={12} color={PURPLE_LIGHT} />
                      <Text style={styles.bookmarkBadgeText}>Saved for Later</Text>
                    </View>
                  )}
                </View>
              </View>

              {!editingItem.bookmarked && (
                <>
                  <Text style={styles.sectionLabel}>How did you feel?</Text>
                  <View style={styles.sentimentRow}>
                    {(['liked', 'didnt_care', 'didnt_like'] as Sentiment[]).map(s => (
                      <TouchableOpacity
                        key={s}
                        style={[
                          styles.sentimentBtn,
                          editSentiment === s && {
                            borderColor: sentimentColor(s),
                            backgroundColor: sentimentColor(s) + '22',
                          },
                        ]}
                        onPress={() => setEditSentiment(s)}
                      >
                        <Text style={styles.sentimentEmoji}>
                          {s === 'liked' ? '👍' : s === 'didnt_care' ? '😐' : '👎'}
                        </Text>
                        <Text style={[styles.sentimentLabel, editSentiment === s && { color: sentimentColor(s) }]}>
                          {s === 'liked' ? 'Liked' : s === 'didnt_care' ? 'Meh' : 'Disliked'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.sectionLabel}>Notes</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Write your thoughts..."
                placeholderTextColor="#555"
                value={editNotes}
                onChangeText={setEditNotes}
                multiline
                numberOfLines={4}
              />

              <Text style={styles.sectionLabel}>Photos</Text>
              <TouchableOpacity style={styles.photoBtn} onPress={handlePickPhoto}>
                <Ionicons name="camera-outline" size={20} color={PURPLE_LIGHT} />
                <Text style={styles.photoBtnText}>Add Photos</Text>
              </TouchableOpacity>
              {editPhotos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {editPhotos.map((uri, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => setEditPhotos(prev => prev.filter((_, idx) => idx !== i))}
                      style={{ marginRight: 8 }}
                    >
                      <Image source={{ uri }} style={styles.photoThumb} />
                      <View style={styles.removePhoto}>
                        <Ionicons name="close-circle" size={18} color="#fff" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
              </TouchableOpacity>

              {editingItem.bookmarked && (
                <TouchableOpacity style={styles.moveToRankingsBtn} onPress={handleMoveToRankings}>
                  <Ionicons name="trophy-outline" size={16} color={PURPLE_LIGHT} />
                  <Text style={styles.moveToRankingsText}>Move to Rankings</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.removeBtn} onPress={handleRemoveItem}>
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                <Text style={styles.removeBtnText}>Remove from List</Text>
              </TouchableOpacity>
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  coverContainer: { height: 220, position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { width: '100%', height: '100%', backgroundColor: '#1a1228' },
  coverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  coverTopRow: {
    position: 'absolute', top: 52, left: 16, right: 16,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  coverBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  coverTitleArea: { position: 'absolute', bottom: 20, left: 20, right: 20 },
  coverTitle: { color: '#fff', fontSize: 26, fontWeight: 'bold', marginBottom: 4 },
  coverDesc: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  statsBar: {
    flexDirection: 'row', backgroundColor: CARD,
    marginHorizontal: 16, marginTop: -20,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  statLabel: { color: '#666', fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: BORDER },
  progressBox: {
    marginHorizontal: 16, marginTop: 12, backgroundColor: CARD,
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: BORDER,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressText: { color: '#888', fontSize: 13 },
  progressPercent: { color: PURPLE_LIGHT, fontSize: 13, fontWeight: '600' },
  progressBarBg: { height: 4, backgroundColor: '#2a2a38', borderRadius: 2 },
  progressBarFill: { height: 4, backgroundColor: PURPLE, borderRadius: 2 },
  tabToggle: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 16,
    backgroundColor: CARD, borderRadius: 12,
    padding: 4, borderWidth: 1, borderColor: BORDER,
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabBtnActive: { backgroundColor: PURPLE },
  tabBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabBtnText: { color: '#666', fontSize: 14, fontWeight: '600' },
  tabBtnTextActive: { color: '#fff' },
  tabBadge: {
    backgroundColor: PURPLE_LIGHT, borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  listHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
  },
  listHeaderText: { color: '#666', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  listHeaderHint: { color: '#444', fontSize: 11 },
  empty: { alignItems: 'center', paddingTop: 40, paddingBottom: 20 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#1e1a2e', justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  emptySubtext: { color: '#666', fontSize: 14 },
  itemCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER, overflow: 'hidden',
  },
  itemCardActive: {
    opacity: 0.9, shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
  },
  positionCol: { width: 36, alignItems: 'center' },
  positionText: { color: '#666', fontSize: 13, fontWeight: '700' },
  positionDash: { color: '#444', fontSize: 13 },
  itemImage: { width: 52, height: 52 },
  noImage: { width: 52, height: 52, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  itemInfo: { flex: 1, paddingVertical: 10, paddingHorizontal: 10 },
  itemTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  itemSubtitle: { color: '#666', fontSize: 12, marginBottom: 2 },
  itemNotes: { color: '#555', fontSize: 11 },
  scoreBadge: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center', marginHorizontal: 6,
  },
  scoreText: { fontSize: 13, fontWeight: 'bold' },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    backgroundColor: PURPLE, width: 56, height: 56,
    borderRadius: 28, justifyContent: 'center', alignItems: 'center',
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 8, elevation: 8,
  },
  sheetBg: { backgroundColor: '#15151e', borderRadius: 24 },
  sheetContent: { padding: 20, paddingBottom: 40 },
  sheetHeader: { flexDirection: 'row', gap: 14, marginBottom: 24, alignItems: 'flex-start' },
  sheetImage: { width: 64, height: 64, borderRadius: 10 },
  sheetImagePlaceholder: {
    width: 64, height: 64, borderRadius: 10,
    backgroundColor: CARD, justifyContent: 'center', alignItems: 'center',
  },
  sheetTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 3 },
  sheetSubtitle: { color: '#777', fontSize: 14, marginBottom: 6 },
  sheetScoreBadge: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center', marginTop: 4,
  },
  sheetScoreText: { fontSize: 13, fontWeight: 'bold' },
  bookmarkBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 4,
  },
  bookmarkBadgeText: { color: PURPLE_LIGHT, fontSize: 12 },
  sectionLabel: {
    color: '#666', fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, marginBottom: 10, textTransform: 'uppercase',
  },
  sentimentRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  sentimentBtn: {
    flex: 1, alignItems: 'center', padding: 12,
    borderRadius: 12, borderWidth: 1.5, borderColor: BORDER, gap: 4,
  },
  sentimentEmoji: { fontSize: 22 },
  sentimentLabel: { color: '#777', fontSize: 12, fontWeight: '500' },
  notesInput: {
    backgroundColor: CARD, color: '#fff', borderRadius: 12, padding: 14,
    fontSize: 14, textAlignVertical: 'top', minHeight: 100,
    marginBottom: 24, borderWidth: 1, borderColor: BORDER,
  },
  photoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: CARD, borderRadius: 12, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: BORDER,
  },
  photoBtnText: { color: PURPLE_LIGHT, fontSize: 14 },
  photoThumb: { width: 80, height: 80, borderRadius: 10 },
  removePhoto: { position: 'absolute', top: -4, right: -4 },
  saveBtn: { backgroundColor: PURPLE, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 12 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  moveToRankingsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 14, marginBottom: 4,
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
  },
  moveToRankingsText: { color: PURPLE_LIGHT, fontSize: 14, fontWeight: '600' },
  removeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14 },
  removeBtnText: { color: '#ef4444', fontSize: 14 },
});