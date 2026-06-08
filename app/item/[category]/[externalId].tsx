/**
 * app/item/[category]/[externalId].tsx
 *
 * Detail screen for a single recommendation item.
 * Renders over the tab bar (lives outside the (tabs) group).
 * Branches on `category` to show category-specific sections.
 */

import {
  fetchGameDetail,
  fetchMovieDetail,
  fetchMusicDetail,
  GameDetail,
  MovieDetail,
  MusicDetail,
} from '@/lib/itemDetails';
import { supabase } from '@/lib/supabase';
import Ionicons from '@expo/vector-icons/Ionicons';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
const CARD = '#1a1a24';
const BORDER = '#2a2a38';

const { width: SCREEN_W } = Dimensions.get('window');

type Category = 'movies' | 'games' | 'music';
type AnyDetail = MovieDetail | GameDetail | MusicDetail;

type UserList = { id: string; title: string; category: string };
type SheetMode = 'add' | 'save';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isMovieDetail(d: AnyDetail): d is MovieDetail {
  return d.category === 'movies';
}
function isGameDetail(d: AnyDetail): d is GameDetail {
  return d.category === 'games';
}
function isMusicDetail(d: AnyDetail): d is MusicDetail {
  return d.category === 'music';
}

function heroHeight(category: Category): number {
  if (category === 'movies') return Math.round(SCREEN_W * 1.4);
  if (category === 'games') return Math.round(SCREEN_W * 0.6);
  return Math.round(SCREEN_W * 1.0); // square for music
}

function detailSubtitle(detail: AnyDetail): string {
  if (isMovieDetail(detail)) {
    const parts: string[] = [];
    if (detail.release_year) parts.push(detail.release_year);
    if (detail.runtime_minutes) {
      const h = Math.floor(detail.runtime_minutes / 60);
      const m = detail.runtime_minutes % 60;
      parts.push(h > 0 ? `${h}h ${m}m` : `${m}m`);
    }
    return parts.join(' · ');
  }
  if (isGameDetail(detail)) {
    const parts: string[] = [];
    if (detail.release_year) parts.push(detail.release_year);
    if (detail.platforms.length > 0) parts.push(detail.platforms.slice(0, 2).join(', '));
    return parts.join(' · ');
  }
  if (isMusicDetail(detail)) {
    const parts: string[] = [];
    if (detail.artist) parts.push(detail.artist);
    if (detail.album) parts.push(detail.album);
    return parts.join(' · ');
  }
  return '';
}

function detailDescription(detail: AnyDetail): string | null {
  if (isMovieDetail(detail)) return detail.overview;
  if (isGameDetail(detail)) return detail.description;
  return null; // music has no description
}

// ---------------------------------------------------------------------------
// Small sub-components
// ---------------------------------------------------------------------------

function CastScroll({ cast }: { cast: MovieDetail['cast'] }) {
  if (cast.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>CAST</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 16 }}>
        {cast.map((member, i) => (
          <View key={i} style={styles.castMember}>
            {member.profile_url ? (
              <Image
                source={{ uri: member.profile_url }}
                style={styles.castAvatar}
                contentFit="cover"
              />
            ) : (
              <View style={styles.castAvatarPlaceholder}>
                <Ionicons name="person" size={20} color="#444" />
              </View>
            )}
            <Text style={styles.castName} numberOfLines={1}>{member.name}</Text>
            <Text style={styles.castRole} numberOfLines={1}>{member.character}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function WatchProviderRow({ providers }: { providers: MovieDetail['watch_providers'] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>WHERE TO WATCH</Text>
      {providers.length === 0 ? (
        <Text style={styles.sectionEmpty}>Not available on streaming in your region.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
          {providers.map((p, i) => (
            <View key={i} style={styles.providerItem}>
              {p.logo_url ? (
                <Image source={{ uri: p.logo_url }} style={styles.providerLogo} contentFit="contain" />
              ) : null}
              <Text style={styles.providerName} numberOfLines={1}>{p.name}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function PlatformChips({ platforms }: { platforms: string[] }) {
  if (platforms.length === 0) return null;
  return (
    <View style={styles.chipsWrap}>
      {platforms.map((p, i) => (
        <View key={i} style={styles.chip}>
          <Text style={styles.chipText}>{p}</Text>
        </View>
      ))}
    </View>
  );
}

function ScreenshotScroll({ screenshots }: { screenshots: string[] }) {
  if (screenshots.length === 0) return null;
  const ssH = Math.round(SCREEN_W * 0.35);
  const ssW = Math.round(ssH * (16 / 9));
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>SCREENSHOTS</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
        {screenshots.map((uri, i) => (
          <Image
            key={i}
            source={{ uri }}
            style={{ width: ssW, height: ssH, borderRadius: 10 }}
            contentFit="cover"
          />
        ))}
      </ScrollView>
    </View>
  );
}

function PreviewButton({ previewUrl }: { previewUrl: string | null }) {
  const handlePress = async () => {
    if (!previewUrl) return;
    await WebBrowser.openBrowserAsync(previewUrl);
  };
  if (!previewUrl) return null;
  return (
    <TouchableOpacity style={styles.previewButton} onPress={handlePress} activeOpacity={0.85}>
      <Ionicons name="play-circle" size={20} color="#fff" />
      <Text style={styles.previewButtonText}>Preview (30s)</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function ItemDetailScreen() {
  const router = useRouter();
  const { category, externalId } = useLocalSearchParams<{ category: string; externalId: string }>();

  const [detail, setDetail] = useState<AnyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // Bottom sheet (list picker)
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '80%'], []);
  const [sheetMode, setSheetMode] = useState<SheetMode>('add');
  const [userLists, setUserLists] = useState<UserList[]>([]);
  const [saving, setSaving] = useState(false);

  // Fetch detail on mount
  useEffect(() => {
    if (!category || !externalId) return;
    const load = async () => {
      setLoading(true);
      setFetchError(false);
      let result: AnyDetail | null = null;
      let hadError = false;
      try {
        if (category === 'movies') result = await fetchMovieDetail(externalId);
        else if (category === 'games') result = await fetchGameDetail(externalId);
        else if (category === 'music') result = await fetchMusicDetail(externalId);
      } catch {
        hadError = true;
      }
      if (!result && !hadError) hadError = true;
      setFetchError(hadError);
      setDetail(result);
      setLoading(false);
    };
    load();
  }, [category, externalId]);

  const openListPicker = useCallback(async (mode: SheetMode) => {
    if (!category) return;
    setSheetMode(mode);
    // SECURITY: scope the list picker to the current user — without this
    // filter, public lists from OTHER users would appear here.
    const { data: { user: pickerUser } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('lists')
      .select('id, title, category')
      .eq('category', category)
      .eq('user_id', pickerUser?.id ?? '00000000-0000-0000-0000-000000000000');
    setUserLists(data ?? []);
    bottomSheetRef.current?.expand();
  }, [category]);

  const handlePickList = useCallback(async (list: UserList) => {
    if (!detail) return;
    setSaving(true);

    const imageUrl = detail.image_url;
    const title = detail.title;
    const sub: string | null = isMovieDetail(detail)
      ? (detail.release_year ?? null)
      : isGameDetail(detail)
      ? (detail.platforms[0] ?? null)
      : isMusicDetail(detail)
      ? detail.artist
      : null;

    // Dedup check
    const { data: existing } = await supabase
      .from('list_items')
      .select('id')
      .eq('list_id', list.id)
      .eq('external_id', externalId)
      .single();

    if (existing) {
      setSaving(false);
      Alert.alert('Already in list', `"${title}" is already in "${list.title}".`);
      return;
    }

    const { error } = await supabase.from('list_items').insert({
      list_id: list.id,
      title,
      subtitle: sub ?? null,
      image_url: imageUrl,
      external_id: externalId,
      category,
      bookmarked: sheetMode === 'save',
      rank: null,
      sentiment: null,
    });

    setSaving(false);
    bottomSheetRef.current?.close();

    if (error) {
      Alert.alert('Error', 'Could not add to list. Please try again.');
    } else {
      Alert.alert(
        'Added!',
        sheetMode === 'save'
          ? `"${title}" saved for later in "${list.title}".`
          : `"${title}" added to "${list.title}".`,
        [{ text: 'OK' }]
      );
    }
  }, [detail, externalId, category, sheetMode]);

  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PURPLE_LIGHT} />
      </View>
    );
  }

  // Error state
  if (fetchError || !detail) {
    return (
      <SafeAreaView style={styles.errorContainer} edges={['top']}>
        <View style={styles.errorContent}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.errorTitle}>Couldn&apos;t load this item</Text>
          <Text style={styles.errorSubtitle}>Something went wrong fetching the details.</Text>
          <TouchableOpacity style={styles.errorButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={16} color="#fff" />
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const hH = heroHeight(category as Category);
  const description = detailDescription(detail);
  const subtitle = detailSubtitle(detail);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero image */}
        <View style={[styles.heroContainer, { height: hH }]}>
          {detail.image_url ? (
            <Image
              source={{ uri: detail.image_url }}
              style={styles.heroImage}
              contentFit="cover"
              transition={300}
            />
          ) : (
            <View style={styles.heroImagePlaceholder} />
          )}
          {/* Gradient overlay at bottom */}
          <View style={styles.heroGradient} />

          {/* Back button */}
          <SafeAreaView edges={['top']} style={styles.backButtonWrap}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        {/* Title / subtitle */}
        <View style={styles.titleSection}>
          <Text style={styles.detailTitle}>{detail.title}</Text>
          {subtitle ? <Text style={styles.detailSubtitle}>{subtitle}</Text> : null}
        </View>

        {/* Description */}
        {description ? (
          <View style={styles.section}>
            <Text style={styles.descriptionText}>{description}</Text>
          </View>
        ) : null}

        {/* Category-specific sections */}
        {isMovieDetail(detail) && (
          <>
            <CastScroll cast={detail.cast} />
            <WatchProviderRow providers={detail.watch_providers} />
          </>
        )}

        {isGameDetail(detail) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PLATFORMS &amp; RATING</Text>
            <PlatformChips platforms={detail.platforms} />
            {detail.esrb_rating ? (
              <View style={[styles.chip, styles.esrbChip]}>
                <Text style={styles.chipText}>ESRB: {detail.esrb_rating}</Text>
              </View>
            ) : null}
            <ScreenshotScroll screenshots={detail.screenshots} />
          </View>
        )}

        {isMusicDetail(detail) && (
          <View style={styles.section}>
            {detail.genre ? (
              <View style={styles.chipsWrap}>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{detail.genre}</Text>
                </View>
              </View>
            ) : null}
            <PreviewButton previewUrl={detail.preview_url} />
          </View>
        )}
      </ScrollView>

      {/* Sticky action bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.actionButtonFilled}
          onPress={() => openListPicker('add')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.actionButtonFilledText}>Add to List</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButtonOutlined}
          onPress={() => openListPicker('save')}
          activeOpacity={0.85}
        >
          <Ionicons name="bookmark-outline" size={18} color={PURPLE_LIGHT} />
          <Text style={styles.actionButtonOutlinedText}>Save for Later</Text>
        </TouchableOpacity>
      </View>

      {/* List picker sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={{ backgroundColor: '#444' }}
      >
        <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
          <Text style={styles.sheetTitle}>
            {sheetMode === 'add' ? 'Add to which list?' : 'Save to which list?'}
          </Text>
          {userLists.length === 0 ? (
            <Text style={styles.sheetEmpty}>
              No {category} lists found. Create one in the Lists tab first!
            </Text>
          ) : (
            userLists.map((list) => (
              <TouchableOpacity
                key={list.id}
                style={styles.listOption}
                onPress={() => handlePickList(list)}
                disabled={saving}
              >
                <Ionicons name="list-outline" size={20} color={PURPLE_LIGHT} />
                <Text style={styles.listOptionText}>{list.title}</Text>
                {saving ? (
                  <ActivityIndicator size="small" color={PURPLE_LIGHT} />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color="#555" />
                )}
              </TouchableOpacity>
            ))
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: BG,
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  errorSubtitle: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  errorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PURPLE,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 8,
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Hero
  heroContainer: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#111',
  },
  heroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroImagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1a1228',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    // Simulated gradient via semi-transparent overlay — expo-linear-gradient not available
    backgroundColor: 'transparent',
    // We'll use a shadow/overlay trick
  },
  backButtonWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  backButton: {
    marginTop: 12,
    marginLeft: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },

  // Title section
  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  detailTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  detailSubtitle: {
    color: '#888',
    fontSize: 14,
  },

  // Generic section
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  sectionTitle: {
    color: '#555',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  sectionEmpty: {
    color: '#666',
    fontSize: 13,
    fontStyle: 'italic',
  },
  descriptionText: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 22,
  },

  // Cast
  castMember: {
    width: 72,
    alignItems: 'center',
    gap: 5,
  },
  castAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#111',
  },
  castAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1a1a24',
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  castName: {
    color: '#ddd',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    width: 72,
  },
  castRole: {
    color: '#666',
    fontSize: 10,
    textAlign: 'center',
    width: 72,
  },

  // Providers
  providerItem: {
    alignItems: 'center',
    gap: 5,
    width: 64,
  },
  providerLogo: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#1a1a24',
  },
  providerName: {
    color: '#888',
    fontSize: 10,
    textAlign: 'center',
    width: 64,
  },

  // Chips
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    backgroundColor: '#2a2a3a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: BORDER,
  },
  esrbChip: {
    backgroundColor: '#2a1a1a',
    borderColor: '#3a2222',
    marginBottom: 16,
  },
  chipText: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '500',
  },

  // Music preview
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: PURPLE,
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
    justifyContent: 'center',
  },
  previewButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Action bar
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 16,
    backgroundColor: 'rgba(15,15,19,0.95)',
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  actionButtonFilled: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PURPLE,
    borderRadius: 14,
    paddingVertical: 15,
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  actionButtonFilledText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  actionButtonOutlined: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    borderRadius: 14,
    paddingVertical: 15,
    borderWidth: 1.5,
    borderColor: PURPLE,
  },
  actionButtonOutlinedText: {
    color: PURPLE_LIGHT,
    fontSize: 15,
    fontWeight: '600',
  },

  // List picker sheet
  sheetBg: { backgroundColor: '#15151e', borderRadius: 24 },
  sheetContent: { padding: 20, paddingBottom: 40 },
  sheetTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  sheetEmpty: { color: '#666', textAlign: 'center', marginVertical: 20, fontSize: 14 },
  listOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  listOptionText: { flex: 1, color: '#fff', fontSize: 15 },
});
