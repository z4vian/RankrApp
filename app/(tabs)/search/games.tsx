import ComparisonSheet, { RankedItem } from '@/lib/ComparisonSheet';
import { supabase } from '@/lib/supabase';
import Ionicons from '@expo/vector-icons/Ionicons';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

const API_KEY = '1011d870d7cc4f368b013fd7d15101e0';
const PURPLE = '#7C3AED';
const PURPLE_LIGHT = '#A78BFA';
const BG = '#0f0f13';
const CARD = '#1a1a24';
const BORDER = '#2a2a38';

type Game = {
  id: number;
  name: string;
  background_image: string | null;
};

type UserList = {
  id: string;
  title: string;
  category: string;
};

type SelectedItem = {
  title: string;
  subtitle: string;
  image_url: string;
  external_id: string;
  category: string;
};

type Sentiment = 'liked' | 'didnt_care' | 'didnt_like';
type SheetStep = 'sentiment' | 'pick_list' | 'notes';

const sentimentRange = (s: Sentiment) => {
  if (s === 'liked') return { min: 7, max: 10 };
  if (s === 'didnt_care') return { min: 4, max: 6.99 };
  return { min: 1, max: 3.99 };
};

export default function GamesSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['60%', '90%'], []);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [sheetStep, setSheetStep] = useState<SheetStep>('sentiment');
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [userLists, setUserLists] = useState<UserList[]>([]);
  const [selectedList, setSelectedList] = useState<UserList | null>(null);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [newItemId, setNewItemId] = useState<string | null>(null);

  const [showComparison, setShowComparison] = useState(false);
  const [rankedPool, setRankedPool] = useState<RankedItem[]>([]);
  const [compLo, setCompLo] = useState(0);
  const [compHi, setCompHi] = useState(0);
  const [compMid, setCompMid] = useState(0);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => searchGames(query), 500);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [query]);

  const searchGames = async (searchQuery: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `https://api.rawg.io/api/games?key=${API_KEY}&search=${encodeURIComponent(searchQuery)}&page_size=20`
      );
      const data = await response.json();
      setResults(data.results ?? []);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openSheet = async (item: SelectedItem) => {
    setSelectedItem(item);
    setSheetStep('sentiment');
    setSentiment(null);
    setSelectedList(null);
    setNotes('');
    setPhotos([]);
    setSaveError('');
    setNewItemId(null);
    const { data } = await supabase
      .from('lists')
      .select('id, title, category')
      .eq('category', item.category);
    setUserLists(data ?? []);
    bottomSheetRef.current?.expand();
  };

  const handleSentiment = (s: Sentiment) => {
    setSentiment(s);
    setSheetStep('pick_list');
  };

  const handlePickList = (list: UserList) => {
    setSelectedList(list);
    setSheetStep('notes');
  };

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setPhotos(prev => [...prev, ...result.assets.map(a => a.uri)]);
    }
  };

  const handleSaveBookmark = async (list: UserList) => {
    if (!selectedItem) return;
    setSaving(true);
    setSaveError('');

    const { data: existing } = await supabase
      .from('list_items')
      .select('id')
      .eq('list_id', list.id)
      .eq('external_id', selectedItem.external_id)
      .single();

    if (existing) {
      setSaveError('Already in your list!');
      setSaving(false);
      return;
    }

    await supabase.from('list_items').insert({
      list_id: list.id,
      title: selectedItem.title,
      subtitle: selectedItem.subtitle,
      image_url: selectedItem.image_url,
      external_id: selectedItem.external_id,
      category: selectedItem.category,
      bookmarked: true,
      rank: null,
      sentiment: null,
    });

    setSaving(false);
    bottomSheetRef.current?.close();
  };

  const handleSave = async () => {
    if (!selectedList || !selectedItem || !sentiment) return;
    setSaving(true);
    setSaveError('');

    const { data: existing } = await supabase
      .from('list_items')
      .select('id')
      .eq('list_id', selectedList.id)
      .eq('external_id', selectedItem.external_id)
      .single();

    if (existing) {
      setSaveError('This item is already in your list!');
      setSaving(false);
      return;
    }

    const { data: inserted, error: insertError } = await supabase
      .from('list_items')
      .insert({
        list_id: selectedList.id,
        title: selectedItem.title,
        subtitle: selectedItem.subtitle,
        image_url: selectedItem.image_url,
        external_id: selectedItem.external_id,
        category: selectedItem.category,
        sentiment,
        notes,
        photo_urls: photos,
        rank: null,
        bookmarked: false,
      })
      .select()
      .single();

    if (insertError || !inserted) {
      setSaveError('Failed to save. Please try again.');
      setSaving(false);
      return;
    }

    setNewItemId(inserted.id);

    const { data: allRanked } = await supabase
      .from('list_items')
      .select('id, title, image_url, rank, sentiment')
      .eq('list_id', selectedList.id)
      .not('rank', 'is', null)
      .order('rank', { ascending: false });

    const ranked = (allRanked ?? []) as RankedItem[];

    if (ranked.length === 0) {
      const { data: allUnranked } = await supabase
        .from('list_items')
        .select('id, sentiment')
        .eq('list_id', selectedList.id)
        .is('rank', null)
        .eq('bookmarked', false);

      if (allUnranked && allUnranked.length >= 10) {
        await Promise.all(
          allUnranked.map((item, index) => {
            const itemSentiment = (item.sentiment as Sentiment) ?? sentiment;
            const r = sentimentRange(itemSentiment);
            const rank = parseFloat(
              (r.max - index * ((r.max - r.min) / Math.max(allUnranked.length - 1, 1))).toFixed(2)
            );
            return supabase.from('list_items').update({ rank }).eq('id', item.id);
          })
        );
      }
      setSaving(false);
      bottomSheetRef.current?.close();
      return;
    }

    const range = sentimentRange(sentiment);
    const pool = ranked.filter(i => {
      const r = i.rank ?? 0;
      return r >= range.min && r <= range.max;
    });

    if (pool.length === 0) {
      const midRank = parseFloat(((range.min + range.max) / 2).toFixed(2));
      await supabase.from('list_items').update({ rank: midRank }).eq('id', inserted.id);
      setSaving(false);
      bottomSheetRef.current?.close();
      return;
    }

    const lo = 0;
    const hi = pool.length - 1;
    const mid = Math.floor((lo + hi) / 2);
    setRankedPool(pool);
    setCompLo(lo);
    setCompHi(hi);
    setCompMid(mid);
    setSaving(false);
    setShowComparison(true);
  };

  const handleComparisonChoice = async (preferNew: boolean) => {
    let newLo = compLo;
    let newHi = compHi;

    if (preferNew) {
      newLo = compMid + 1;
    } else {
      newHi = compMid - 1;
    }

    if (newLo > newHi || !newItemId) {
      let newRank: number;
      if (newLo >= rankedPool.length) {
        newRank = (rankedPool[0]?.rank ?? 10) + 0.5;
      } else if (newHi < 0) {
        newRank = (rankedPool[rankedPool.length - 1]?.rank ?? 1) - 0.5;
      } else {
        const above = rankedPool[newHi]?.rank ?? 10;
        const below = rankedPool[newLo]?.rank ?? 1;
        newRank = parseFloat(((above + below) / 2).toFixed(2));
      }

      await supabase.from('list_items').update({ rank: newRank }).eq('id', newItemId);
      setShowComparison(false);
      bottomSheetRef.current?.close();
    } else {
      const newMid = Math.floor((newLo + newHi) / 2);
      setCompLo(newLo);
      setCompHi(newHi);
      setCompMid(newMid);
    }
  };

  const renderGame = ({ item }: { item: Game }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => openSheet({
        title: item.name,
        subtitle: '',
        image_url: item.background_image ?? '',
        external_id: item.id.toString(),
        category: 'games',
      })}
      activeOpacity={0.8}
    >
      {item.background_image ? (
        <Image source={{ uri: item.background_image }} style={styles.cover} />
      ) : (
        <View style={styles.noImage}>
          <Ionicons name="game-controller-outline" size={20} color="#555" />
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{item.name}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.container}>
        <TextInput
          style={styles.input}
          placeholder="Search games..."
          placeholderTextColor="#555"
          value={query}
          onChangeText={setQuery}
        />
        {loading && <ActivityIndicator color={PURPLE_LIGHT} style={{ marginTop: 20 }} />}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && query.trim() && results.length === 0 && (
          <Text style={styles.noResults}>No games found.</Text>
        )}
        <FlatList
          data={results}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderGame}
          contentContainerStyle={{ paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        />
      </View>

      {showComparison && selectedItem && rankedPool[compMid] && (
        <ComparisonSheet
          newItem={{ title: selectedItem.title, image_url: selectedItem.image_url }}
          compareItem={rankedPool[compMid]}
          onChooseNew={() => handleComparisonChoice(true)}
          onChooseExisting={() => handleComparisonChoice(false)}
          onDismiss={() => setShowComparison(false)}
        />
      )}

      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={{ backgroundColor: '#444' }}
      >
        <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
          {selectedItem && (
            <>
              <View style={styles.sheetHeader}>
                {selectedItem.image_url ? (
                  <Image source={{ uri: selectedItem.image_url }} style={styles.sheetImage} />
                ) : (
                  <View style={styles.sheetImagePlaceholder}>
                    <Ionicons name="game-controller-outline" size={28} color="#555" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>{selectedItem.title}</Text>
                  {selectedItem.subtitle ? (
                    <Text style={styles.sheetSubtitle}>{selectedItem.subtitle}</Text>
                  ) : null}
                </View>
              </View>

              {sheetStep === 'sentiment' && (
                <>
                  <Text style={styles.sheetQuestion}>What did you think?</Text>
                  <TouchableOpacity
                    style={[styles.sentimentButton, { backgroundColor: '#2e7d32' }]}
                    onPress={() => handleSentiment('liked')}
                  >
                    <Text style={styles.sentimentText}>👍 Liked it</Text>
                    <Text style={styles.sentimentRange}>Score range: 7–10</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sentimentButton, { backgroundColor: '#444' }]}
                    onPress={() => handleSentiment('didnt_care')}
                  >
                    <Text style={styles.sentimentText}>😐 Didn't care for it</Text>
                    <Text style={styles.sentimentRange}>Score range: 4–7</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sentimentButton, { backgroundColor: '#c62828' }]}
                    onPress={() => handleSentiment('didnt_like')}
                  >
                    <Text style={styles.sentimentText}>👎 Didn't like it</Text>
                    <Text style={styles.sentimentRange}>Score range: 1–4</Text>
                  </TouchableOpacity>
                  <View style={styles.divider} />
                  <TouchableOpacity
                    style={styles.bookmarkButton}
                    onPress={() => {
                      setSentiment(null);
                      setSheetStep('pick_list');
                    }}
                  >
                    <Ionicons name="bookmark-outline" size={20} color={PURPLE_LIGHT} />
                    <Text style={styles.bookmarkText}>Save for Later</Text>
                  </TouchableOpacity>
                </>
              )}

              {sheetStep === 'pick_list' && (
                <>
                  <Text style={styles.sheetQuestion}>
                    {sentiment ? 'Add to which list?' : 'Save to which list?'}
                  </Text>
                  {userLists.length === 0 ? (
                    <Text style={styles.noLists}>No game lists found. Create one in the Lists tab!</Text>
                  ) : (
                    userLists.map(list => (
                      <TouchableOpacity
                        key={list.id}
                        style={styles.listOption}
                        onPress={() => {
                          if (sentiment) {
                            handlePickList(list);
                          } else {
                            handleSaveBookmark(list);
                          }
                        }}
                      >
                        <Ionicons name="list-outline" size={20} color={PURPLE_LIGHT} />
                        <Text style={styles.listOptionText}>{list.title}</Text>
                        <Ionicons name="chevron-forward" size={18} color="#555" />
                      </TouchableOpacity>
                    ))
                  )}
                  <TouchableOpacity onPress={() => setSheetStep('sentiment')} style={styles.backButton}>
                    <Text style={styles.backButtonText}>← Back</Text>
                  </TouchableOpacity>
                </>
              )}

              {sheetStep === 'notes' && (
                <>
                  <Text style={styles.sheetQuestion}>Add notes or photos</Text>
                  <Text style={styles.sheetSubtext}>Optional — adding to: {selectedList?.title}</Text>
                  <TextInput
                    style={styles.notesInput}
                    placeholder="Write your thoughts..."
                    placeholderTextColor="#555"
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={4}
                  />
                  <TouchableOpacity style={styles.photoButton} onPress={handlePickPhoto}>
                    <Ionicons name="camera-outline" size={20} color={PURPLE_LIGHT} />
                    <Text style={styles.photoButtonText}>Add Photos</Text>
                  </TouchableOpacity>
                  {photos.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                      {photos.map((uri, i) => (
                        <Image key={i} source={{ uri }} style={styles.photoThumb} />
                      ))}
                    </ScrollView>
                  )}
                  {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
                  <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save & Add to List</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.skipButton} onPress={handleSave} disabled={saving}>
                    <Text style={styles.skipText}>Skip & Add Without Notes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setSheetStep('pick_list')} style={styles.backButton}>
                    <Text style={styles.backButtonText}>← Back</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, padding: 16 },
  input: {
    backgroundColor: CARD, color: '#fff', borderRadius: 14,
    padding: 14, fontSize: 15, marginBottom: 16,
    borderWidth: 1, borderColor: BORDER,
  },
  card: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 12,
    backgroundColor: CARD, borderRadius: 14,
    overflow: 'hidden', borderWidth: 1, borderColor: BORDER,
  },
  cover: { width: 100, height: 70 },
  noImage: { width: 100, height: 70, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, padding: 12 },
  title: { color: '#fff', fontSize: 14, fontWeight: '600' },
  error: { color: '#ef4444', textAlign: 'center', marginTop: 10 },
  noResults: { color: '#555', textAlign: 'center', marginTop: 20 },
  sheetBg: { backgroundColor: '#15151e', borderRadius: 24 },
  sheetContent: { padding: 20, paddingBottom: 40 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  sheetImage: { width: 80, height: 56, borderRadius: 10 },
  sheetImagePlaceholder: { width: 80, height: 56, backgroundColor: CARD, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  sheetTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  sheetSubtitle: { color: '#777', fontSize: 14 },
  sheetQuestion: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  sheetSubtext: { color: '#666', fontSize: 13, marginBottom: 16 },
  sentimentButton: { borderRadius: 14, padding: 16, marginBottom: 10 },
  sentimentText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  sentimentRange: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 16 },
  bookmarkButton: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: CARD, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: BORDER,
  },
  bookmarkText: { color: PURPLE_LIGHT, fontSize: 15, fontWeight: '600' },
  listOption: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD, borderRadius: 14,
    padding: 16, marginBottom: 10, gap: 12,
    borderWidth: 1, borderColor: BORDER,
  },
  listOptionText: { flex: 1, color: '#fff', fontSize: 15 },
  noLists: { color: '#666', textAlign: 'center', marginVertical: 20 },
  backButton: { alignItems: 'center', padding: 12, marginTop: 4 },
  backButtonText: { color: PURPLE_LIGHT, fontSize: 14 },
  notesInput: {
    backgroundColor: CARD, color: '#fff', borderRadius: 12, padding: 14,
    fontSize: 14, textAlignVertical: 'top', minHeight: 100,
    marginBottom: 16, borderWidth: 1, borderColor: BORDER,
  },
  photoButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: CARD, borderRadius: 12, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: BORDER,
  },
  photoButtonText: { color: PURPLE_LIGHT, fontSize: 14 },
  photoThumb: { width: 80, height: 80, borderRadius: 10, marginRight: 8 },
  saveButton: { backgroundColor: PURPLE, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 10 },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  skipButton: { alignItems: 'center', padding: 10, marginBottom: 8 },
  skipText: { color: '#666', fontSize: 14 },
  saveError: { color: '#ef4444', textAlign: 'center', marginBottom: 10 },
});