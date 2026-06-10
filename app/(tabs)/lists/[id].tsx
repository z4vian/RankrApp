import { AnimatedNumber, useToast } from '@/components';
import { useActiveList } from '@/lib/ListContext';
import { uploadListItemPhoto } from '@/lib/photoUpload';
import { supabase } from '@/lib/supabase';
import { colors, glow, scoreColor, sentimentColor } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';

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


type Visibility = 'public' | 'private';

// Phase 7 — categories accepted by the edit-list sheet. Matches lists/create.tsx.
type Category = 'movies' | 'tv' | 'games' | 'music' | 'books';
const CATEGORIES: { key: Category; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'movies', label: 'Movies', icon: 'film-outline' },
  { key: 'tv', label: 'TV', icon: 'tv-outline' },
  { key: 'games', label: 'Games', icon: 'game-controller-outline' },
  { key: 'music', label: 'Music', icon: 'musical-notes-outline' },
  { key: 'books', label: 'Books', icon: 'book-outline' },
];

export default function ListDetail() {
  const { id, title, description } = useLocalSearchParams<{
    id: string; title: string; description: string;
  }>();
  const router = useRouter();
  const { showToast } = useToast();
  const { setActiveList } = useActiveList();
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'rankings' | 'saved'>('rankings');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [visibilityUpdating, setVisibilityUpdating] = useState(false);

  // Phase 7 — list metadata (loaded by fetchListMeta) + ownership check.
  // Initial display title / description come from useLocalSearchParams but
  // we mirror them into state so an edit can update the screen without a
  // full route round-trip.
  const [listTitle, setListTitle] = useState<string>((title as string) ?? '');
  const [listDescription, setListDescription] = useState<string>((description as string) ?? '');
  const [listCategory, setListCategory] = useState<Category>('movies');
  const [listOwnerId, setListOwnerId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['70%', '95%'], []);
  const [editingItem, setEditingItem] = useState<ListItem | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [editSentiment, setEditSentiment] = useState<Sentiment | null>(null);
  const [saving, setSaving] = useState(false);

  // Phase 7 — separate bottom sheet for the list-metadata edit flow. Kept
  // separate from the existing item-edit sheet so the two flows can't
  // collide and the legacy item-edit path stays untouched.
  const listEditSheetRef = useRef<BottomSheet>(null);
  const listEditSnapPoints = useMemo(() => ['65%', '90%'], []);
  const [listEditOpen, setListEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState<Category>('movies');
  const [editVisibility, setEditVisibility] = useState<Visibility>('private');
  const [listSaving, setListSaving] = useState(false);

  // T1 Fix 3 — in-list search. Filters the already-loaded items array by
  // title (case-insensitive substring). No debounce — local filter is
  // instant.
  const [searchQuery, setSearchQuery] = useState('');

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

  const fetchListMeta = async () => {
    // Phase 7 — pull the full editable metadata, not just visibility. We use
    // these to gate the Edit button (owner-only) and pre-fill the edit sheet.
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);

    const { data, error } = await supabase
      .from('lists')
      .select('user_id, title, description, category, visibility')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return;

    setListOwnerId((data.user_id as string | null) ?? null);
    const t = (data.title as string | null) ?? '';
    const d = (data.description as string | null) ?? '';
    const c = (data.category as string | null) ?? 'movies';
    if (t) setListTitle(t);
    setListDescription(d);
    if (c === 'movies' || c === 'tv' || c === 'games' || c === 'music' || c === 'books') {
      setListCategory(c);
    }
    const v = (data.visibility as string | null) ?? null;
    if (v === 'public' || v === 'private') setVisibility(v);
  };

  const toggleVisibility = async () => {
    if (visibilityUpdating) return;
    const next: Visibility = visibility === 'public' ? 'private' : 'public';
    const prev = visibility;
    setVisibility(next); // optimistic
    setVisibilityUpdating(true);
    const { error } = await supabase
      .from('lists')
      .update({ visibility: next })
      .eq('id', id);
    setVisibilityUpdating(false);
    if (error) {
      setVisibility(prev); // revert
      const isMissingColumn =
        /column.*visibility/i.test(error.message) ||
        /schema.*cache/i.test(error.message);
      Alert.alert(
        "Couldn't update visibility",
        isMissingColumn
          ? 'Make sure the database migration has been applied.'
          : error.message,
      );
    }
  };

  useFocusEffect(useCallback(() => {
    fetchItems();
    fetchListMeta();
    setActiveList({ id: id as string, title: title as string, category: '' });
    return () => setActiveList(null);
  }, [id, title]));

  // Phase 7 — list-edit sheet handlers
  const openListEditSheet = () => {
    setEditTitle(listTitle);
    setEditDescription(listDescription);
    setEditCategory(listCategory);
    setEditVisibility(visibility);
    setListEditOpen(true);
    listEditSheetRef.current?.expand();
  };

  const closeListEditSheet = () => {
    setListEditOpen(false);
    listEditSheetRef.current?.close();
  };

  const handleSaveListMeta = async () => {
    const trimmedTitle = editTitle.trim();
    const trimmedDesc = editDescription.trim();
    if (trimmedTitle.length === 0) {
      showToast('Title is required.', { tone: 'error' });
      return;
    }
    if (trimmedTitle.length > 80) {
      showToast('Title must be 80 characters or fewer.', { tone: 'error' });
      return;
    }
    if (trimmedDesc.length > 280) {
      showToast('Description must be 280 characters or fewer.', { tone: 'error' });
      return;
    }

    // Optimistic local state — snapshot for rollback on failure.
    const prev = {
      title: listTitle,
      description: listDescription,
      category: listCategory,
      visibility,
    };
    setListTitle(trimmedTitle);
    setListDescription(trimmedDesc);
    setListCategory(editCategory);
    setVisibility(editVisibility);

    setListSaving(true);
    const { error } = await supabase
      .from('lists')
      .update({
        title: trimmedTitle,
        description: trimmedDesc,
        category: editCategory,
        visibility: editVisibility,
      })
      .eq('id', id);
    setListSaving(false);

    if (error) {
      // Revert optimistic update.
      setListTitle(prev.title);
      setListDescription(prev.description);
      setListCategory(prev.category);
      setVisibility(prev.visibility);
      showToast(error.message || 'Could not save changes.', { tone: 'error' });
      return;
    }

    showToast('List updated', { tone: 'success' });
    setListEditOpen(false);
    listEditSheetRef.current?.close();
  };

  const bookmarkedItems = items.filter(i => i.bookmarked);
  const rankableItems = items.filter(i => !i.bookmarked);
  const rankedItems = rankableItems
    .filter(i => i.rank !== null)
    .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));
  const unrankedItems = rankableItems.filter(i => i.rank === null);
  const allRankableItems = [...rankedItems, ...unrankedItems];
  const tabItems = activeTab === 'rankings' ? allRankableItems : bookmarkedItems;
  // T1 Fix 3 — apply local search filter on top of the active tab's items.
  // Case-insensitive substring match against item.title.
  const searchTrimmed = searchQuery.trim().toLowerCase();
  const displayItems = searchTrimmed.length === 0
    ? tabItems
    : tabItems.filter(i => i.title.toLowerCase().includes(searchTrimmed));

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
    if (Platform.OS === 'web') {
      Alert.alert('Unavailable', 'Photos are only available on iOS and Android.');
      return;
    }
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      Alert.alert('Not signed in', 'You must be signed in to save changes.');
      return;
    }

    // Only upload photos that are still local URIs (not already-uploaded public HTTPS URLs).
    let finalPhotoUrls: string[] = [];
    try {
      finalPhotoUrls = await Promise.all(
        editPhotos.map((uri) => {
          if (uri.startsWith('http://') || uri.startsWith('https://')) {
            return Promise.resolve(uri);
          }
          return uploadListItemPhoto(uri, user.id);
        })
      );
    } catch (err: any) {
      setSaving(false);
      Alert.alert('Upload failed', err?.message ?? 'Could not upload photos.');
      return;
    }

    await supabase
      .from('list_items')
      .update({ notes: editNotes, photo_urls: finalPhotoUrls, sentiment: editSentiment })
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
          onPress={() => router.push(`/list-item/${item.id}` as any)}
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
              <Ionicons name="bookmark" size={14} color={colors.purpleLight} />
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
          <ActivityIndicator color={colors.purpleLight} style={{ marginTop: 40 }} />
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
                    <Text style={styles.coverTitle}>{listTitle || title}</Text>
                    {listDescription ? (
                      <Text style={styles.coverDesc}>{listDescription}</Text>
                    ) : null}
                    <View style={styles.coverPillRow}>
                      <TouchableOpacity
                        style={[
                          styles.visibilityPill,
                          visibility === 'public' && styles.visibilityPillPublic,
                        ]}
                        onPress={toggleVisibility}
                        activeOpacity={0.8}
                        disabled={visibilityUpdating}
                      >
                        <Ionicons
                          name={visibility === 'public' ? 'globe-outline' : 'lock-closed'}
                          size={12}
                          color={visibility === 'public' ? '#fff' : '#bbb'}
                        />
                        <Text
                          style={[
                            styles.visibilityPillText,
                            visibility === 'public' && styles.visibilityPillTextPublic,
                          ]}
                        >
                          {visibility === 'public' ? 'Public' : 'Private'}
                        </Text>
                      </TouchableOpacity>
                      {/* Phase 7 — Edit list. Owner-only, sits next to the
                          visibility pill. Falsey listOwnerId means we
                          haven't loaded metadata yet; hide until we know. */}
                      {listOwnerId && currentUserId && listOwnerId === currentUserId ? (
                        <TouchableOpacity
                          style={styles.editListPill}
                          onPress={openListEditSheet}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="pencil-outline" size={12} color="#bbb" />
                          <Text style={styles.editListPillText}>Edit list</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* Stats */}
                <View style={styles.statsBar}>
                  <View style={styles.statItem}>
                    <AnimatedNumber value={allRankableItems.length} style={styles.statValue} />
                    <Text style={styles.statLabel}>Items</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    {avgScore ? (
                      <AnimatedNumber
                        value={parseFloat(avgScore)}
                        decimals={1}
                        style={[styles.statValue, { color: scoreColor(parseFloat(avgScore)) }]}
                      />
                    ) : (
                      <Text style={styles.statValue}>—</Text>
                    )}
                    <Text style={styles.statLabel}>Avg Score</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <AnimatedNumber value={bookmarkedItems.length} style={styles.statValue} />
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

                {/* T1 Fix 3 — in-list search. Sits above the Rankings /
                    Saved tab toggle. Filters the local `items` array
                    in-memory (no server roundtrip). */}
                <View style={styles.searchRow}>
                  <Ionicons
                    name="search"
                    size={16}
                    color={colors.textMuted}
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search items"
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                  />
                  {searchQuery.length > 0 ? (
                    <TouchableOpacity
                      onPress={() => setSearchQuery('')}
                      hitSlop={8}
                      style={styles.searchClearBtn}
                    >
                      <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  ) : null}
                </View>

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

                {displayItems.length === 0 && searchTrimmed.length > 0 && (
                  // T1 Fix 3 — inline empty state for no-matches search.
                  // Smaller than the default empty state, just enough to
                  // tell the user their query had no hits.
                  <View style={styles.searchEmpty}>
                    <Ionicons name="search" size={18} color={colors.textMuted} />
                    <Text style={styles.searchEmptyText}>
                      No items match &ldquo;{searchQuery.trim()}&rdquo;.
                    </Text>
                  </View>
                )}

                {displayItems.length === 0 && searchTrimmed.length === 0 && (
                  <View style={styles.empty}>
                    <View style={styles.emptyIcon}>
                      <Ionicons
                        name={activeTab === 'rankings' ? 'add-circle-outline' : 'bookmark-outline'}
                        size={40}
                        color={colors.purpleLight}
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
                      <Ionicons name="bookmark" size={12} color={colors.purpleLight} />
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
                <Ionicons name="camera-outline" size={20} color={colors.purpleLight} />
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
                  <Ionicons name="trophy-outline" size={16} color={colors.purpleLight} />
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

      {/* ---- Phase 7: Edit-list-metadata bottom sheet ---- */}
      <BottomSheet
        ref={listEditSheetRef}
        index={-1}
        snapPoints={listEditSnapPoints}
        enablePanDownToClose
        onClose={() => setListEditOpen(false)}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={{ backgroundColor: '#444' }}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
        >
          {listEditOpen && (
            <>
              <View style={styles.listEditHeader}>
                <Text style={styles.listEditTitle}>Edit list</Text>
                <TouchableOpacity
                  onPress={closeListEditSheet}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Close edit list"
                >
                  <Ionicons name="close" size={22} color="#888" />
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionLabel}>Title</Text>
              <TextInput
                style={styles.listEditInput}
                placeholder="My favourite movies"
                placeholderTextColor="#555"
                value={editTitle}
                onChangeText={setEditTitle}
                maxLength={80}
              />
              <Text style={styles.fieldHint}>{editTitle.length}/80</Text>

              <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Description</Text>
              <TextInput
                style={[styles.listEditInput, styles.listEditTextarea]}
                placeholder="A short description (optional)"
                placeholderTextColor="#555"
                value={editDescription}
                onChangeText={setEditDescription}
                multiline
                numberOfLines={3}
                maxLength={280}
              />
              <Text style={styles.fieldHint}>{editDescription.length}/280</Text>

              <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Category</Text>
              {items.length > 0 ? (
                <Text style={styles.fieldHint}>
                  Can&apos;t change category once items are added (would invalidate rankings)
                </Text>
              ) : null}
              <View
                style={[
                  styles.catGrid,
                  // Visually disable + block touches when the list has items.
                  items.length > 0 && styles.catGridLocked,
                ]}
                pointerEvents={items.length > 0 ? 'none' : 'auto'}
              >
                {CATEGORIES.map((cat) => {
                  const active = editCategory === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[
                        styles.catBtn,
                        active && styles.catBtnActive,
                      ]}
                      onPress={() => setEditCategory(cat.key)}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name={cat.icon}
                        size={18}
                        color={active ? '#fff' : '#aaa'}
                      />
                      <Text style={[styles.catBtnText, active && styles.catBtnTextActive]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Who can see this list?</Text>
              <View style={styles.visRow}>
                <TouchableOpacity
                  style={[
                    styles.visPill,
                    editVisibility === 'private' && styles.visPillActive,
                  ]}
                  onPress={() => setEditVisibility('private')}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="lock-closed"
                    size={16}
                    color={editVisibility === 'private' ? '#fff' : '#888'}
                  />
                  <View style={{ flexShrink: 1 }}>
                    <Text style={[styles.visTitle, editVisibility === 'private' && styles.visTitleActive]}>
                      Private
                    </Text>
                    <Text style={[styles.visSubtitle, editVisibility === 'private' && styles.visSubtitleActive]}>
                      Only you
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.visPill,
                    editVisibility === 'public' && styles.visPillActive,
                  ]}
                  onPress={() => setEditVisibility('public')}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="globe-outline"
                    size={16}
                    color={editVisibility === 'public' ? '#fff' : '#888'}
                  />
                  <View style={{ flexShrink: 1 }}>
                    <Text style={[styles.visTitle, editVisibility === 'public' && styles.visTitleActive]}>
                      Public
                    </Text>
                    <Text style={[styles.visSubtitle, editVisibility === 'public' && styles.visSubtitleActive]}>
                      Anyone can view
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, listSaving && { opacity: 0.6 }]}
                onPress={handleSaveListMeta}
                disabled={listSaving}
              >
                {listSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeListEditSheet}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
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
  visibilityPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', marginTop: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: colors.border,
  },
  visibilityPillPublic: { backgroundColor: colors.purple, borderColor: colors.purple },
  visibilityPillText: { color: '#bbb', fontSize: 11, fontWeight: '600' },
  visibilityPillTextPublic: { color: '#fff' },
  statsBar: {
    flexDirection: 'row', backgroundColor: colors.card,
    marginHorizontal: 16, marginTop: -20,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 20, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  statLabel: { color: '#666', fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.border },
  progressBox: {
    marginHorizontal: 16, marginTop: 12, backgroundColor: colors.card,
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressText: { color: '#888', fontSize: 13 },
  progressPercent: { color: colors.purpleLight, fontSize: 13, fontWeight: '600' },
  progressBarBg: { height: 4, backgroundColor: '#2a2a38', borderRadius: 2 },
  progressBarFill: { height: 4, backgroundColor: colors.purple, borderRadius: 2 },

  // T1 Fix 3 — in-list search input. Subtle cardElevated background so it
  // doesn't compete with the tab toggle below.
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    height: 38,
    backgroundColor: colors.cardElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    padding: 0,
  },
  searchClearBtn: {
    marginLeft: 8,
    padding: 2,
  },
  searchEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 16,
  },
  searchEmptyText: {
    color: colors.textMuted,
    fontSize: 13,
  },

  tabToggle: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 16,
    backgroundColor: colors.card, borderRadius: 12,
    padding: 4, borderWidth: 1, borderColor: colors.border,
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabBtnActive: { backgroundColor: colors.purple },
  tabBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabBtnText: { color: '#666', fontSize: 14, fontWeight: '600' },
  tabBtnTextActive: { color: '#fff' },
  tabBadge: {
    backgroundColor: colors.purpleLight, borderRadius: 10,
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
    backgroundColor: colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  itemCardActive: {
    opacity: 0.9,
    ...glow.purple,
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
    backgroundColor: colors.purple, width: 56, height: 56,
    borderRadius: 28, justifyContent: 'center', alignItems: 'center',
    ...glow.purpleStrong,
  },
  sheetBg: { backgroundColor: '#15151e', borderRadius: 24 },
  sheetContent: { padding: 20, paddingBottom: 40 },
  sheetHeader: { flexDirection: 'row', gap: 14, marginBottom: 24, alignItems: 'flex-start' },
  sheetImage: { width: 64, height: 64, borderRadius: 10 },
  sheetImagePlaceholder: {
    width: 64, height: 64, borderRadius: 10,
    backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center',
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
  bookmarkBadgeText: { color: colors.purpleLight, fontSize: 12 },
  sectionLabel: {
    color: '#666', fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, marginBottom: 10, textTransform: 'uppercase',
  },
  sentimentRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  sentimentBtn: {
    flex: 1, alignItems: 'center', padding: 12,
    borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, gap: 4,
  },
  sentimentEmoji: { fontSize: 22 },
  sentimentLabel: { color: '#777', fontSize: 12, fontWeight: '500' },
  notesInput: {
    backgroundColor: colors.card, color: '#fff', borderRadius: 12, padding: 14,
    fontSize: 14, textAlignVertical: 'top', minHeight: 100,
    marginBottom: 24, borderWidth: 1, borderColor: colors.border,
  },
  photoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.card, borderRadius: 12, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: colors.border,
  },
  photoBtnText: { color: colors.purpleLight, fontSize: 14 },
  photoThumb: { width: 80, height: 80, borderRadius: 10 },
  removePhoto: { position: 'absolute', top: -4, right: -4 },
  saveBtn: { backgroundColor: colors.purple, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 12 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  moveToRankingsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 14, marginBottom: 4,
    backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
  },
  moveToRankingsText: { color: colors.purpleLight, fontSize: 14, fontWeight: '600' },
  removeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14 },
  removeBtnText: { color: '#ef4444', fontSize: 14 },

  // ---- Phase 7: list-edit pill in cover ----
  coverPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  editListPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: colors.border,
  },
  editListPillText: { color: '#bbb', fontSize: 11, fontWeight: '600' },

  // ---- Phase 7: list-edit sheet ----
  listEditHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20,
  },
  listEditTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  listEditInput: {
    backgroundColor: colors.card, color: '#fff', borderRadius: 10,
    padding: 14, fontSize: 15,
    borderWidth: 1, borderColor: colors.border,
  },
  listEditTextarea: { height: 90, textAlignVertical: 'top' },
  fieldHint: { color: '#666', fontSize: 11, marginTop: 4 },
  // Category grid (5 chips, wrap to 2 rows on narrow widths)
  catGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8,
  },
  catGridLocked: {
    opacity: 0.4,
  },
  catBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, gap: 6,
    borderWidth: 1, borderColor: colors.border,
    flexGrow: 1, flexBasis: 88,
  },
  catBtnActive: { backgroundColor: colors.purple, borderColor: colors.purple },
  catBtnText: { color: '#aaa', fontSize: 13 },
  catBtnTextActive: { color: '#fff', fontWeight: '600' },
  // Visibility row
  visRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  visPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  visPillActive: { backgroundColor: colors.purple, borderColor: colors.purple },
  visTitle: { color: '#ddd', fontSize: 14, fontWeight: '600' },
  visTitleActive: { color: '#fff' },
  visSubtitle: { color: '#666', fontSize: 11, marginTop: 1 },
  visSubtitleActive: { color: colors.purpleLight },
  cancelBtn: { alignItems: 'center', padding: 14, marginTop: 4 },
  cancelBtnText: { color: '#888', fontSize: 14 },
});