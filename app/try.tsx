import { BrandWordmark } from '@/components/BrandWordmark';
import { Button } from '@/components/Button';
import { ScoreProgress } from '@/components/ScoreProgress';
import { guestScore } from '@/lib/scoreProgress';
import { clearGuestDraft, createGuestDraft, getGuestDraft, GUEST_DRAFT_MAX_ITEMS, isGuestDraftPersistenceAvailable, saveGuestDraft, type GuestCategory, type GuestDraft, type GuestDraftItem } from '@/lib/guestDraft';
import media from '@/lib/marketing-media.json';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

const categories: { value: GuestCategory; label: string; catalog: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { value: 'movies', label: 'Movies', catalog: 'Movies', icon: 'film-outline' },
  { value: 'tv', label: 'TV shows', catalog: 'TV shows', icon: 'tv-outline' },
  { value: 'games', label: 'Games', catalog: 'Games', icon: 'game-controller-outline' },
  { value: 'music', label: 'Music', catalog: 'Music', icon: 'musical-notes-outline' },
  { value: 'books', label: 'Books', catalog: 'Books', icon: 'book-outline' },
];

function artworkUri(uri: string): string {
  return Platform.OS !== 'web' && uri.startsWith('/media/')
    ? `https://rankr-app.vercel.app${uri}`
    : uri;
}

export default function TryRankr() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState<GuestDraft | null>(null);
  const [category, setCategory] = useState<GuestCategory>('movies');
  const [title, setTitle] = useState('My favorite movies');
  const [entry, setEntry] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [persistent, setPersistent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [undoItems, setUndoItems] = useState<GuestDraftItem[] | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(false);

  useEffect(() => {
    const restored = getGuestDraft();
    setDraft(restored);
    if (restored) { setCategory(restored.category); setTitle(restored.title); }
    setPersistent(isGuestDraftPersistenceAvailable());
    setReady(true);
  }, []);

  const persist = (next: GuestDraft): boolean => {
    try {
      saveGuestDraft(next); setDraft(next); setPersistent(isGuestDraftPersistenceAvailable()); setError(''); return true;
    } catch { setError('This change could not be saved. Please shorten the title and try again.'); return false; }
  };
  const start = () => {
    if (!title.trim()) { setError('Give your list a name to get started.'); return; }
    try { persist(createGuestDraft(category, title.trim())); } catch (e) { setError(e instanceof Error ? e.message : 'Could not start your list. Please try again.'); }
  };
  const add = (name: string, image?: string) => {
    if (!draft || !name.trim()) return;
    if (draft.items.length >= GUEST_DRAFT_MAX_ITEMS) { setError('Your guest list can hold 20 favorites. Save it to your account to keep building.'); return; }
    if (draft.items.some(i => i.title.toLowerCase() === name.trim().toLowerCase())) { setError('That title is already on your list. You can change its place below.'); return; }
    let itemId: string;
    try { itemId = createGuestDraft(draft.category, name.trim()).id; }
    catch { setError('Could not add this title. Please try again.'); return; }
    if (persist({ ...draft, items: [...draft.items, { id: itemId, title: name.trim(), ...(image ? { image_url: image } : {}) }] })) {
      setEntry(''); setStatus(draft.items.length === 9 ? `${name.trim()} added. Ten favorites reached — scores are unlocked.` : `${name.trim()} added to your list.`); setUndoItems(null);
    }
  };
  const move = (index: number, delta: number) => {
    if (!draft || index + delta < 0 || index + delta >= draft.items.length) return;
    const items = [...draft.items]; [items[index], items[index + delta]] = [items[index + delta], items[index]];
    if (persist({ ...draft, items })) { setStatus(`${draft.items[index].title} moved to number ${index + delta + 1}.`); setUndoItems(null); setComparing(false); }
  };
  const choose = (id: string) => {
    if (!draft) return;
    const winner = draft.items.find(i => i.id === id)!;
    const items = [winner, ...draft.items.filter(i => i.id !== id)];
    if (persist({ ...draft, items })) { setUndoItems(draft.items); setComparing(false); setStatus(`${winner.title} is your number one. Your ranking is taking shape.`); }
  };
  const handoff = async (login = false) => {
    if (!draft?.items.length || saving || !persist(draft)) return;
    setSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      router.push((data.session ? '/save-list' : login ? '/login?from=guest' : '/signup?from=guest') as any);
    } catch { setError('Could not open account setup. Your list is still here. Try again.'); }
    finally { setSaving(false); }
  };
  const activeCategory = categories.find(c => c.value === (draft?.category ?? category))!;
  const suggestions = media.filter(m => m.category === activeCategory.catalog && !draft?.items.some(i => i.title.toLowerCase() === m.title.toLowerCase()) && (!entry.trim() || m.title.toLowerCase().includes(entry.trim().toLowerCase()))).slice(0, 4);
  const wide = width >= 900;

  if (!ready) return <View style={styles.loading}><ActivityIndicator color={colors.purpleLight} accessibilityLabel="Loading your guest list" /></View>;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <View style={styles.nav}>
      <Pressable accessibilityRole="link" accessibilityLabel="Rankr home" onPress={() => router.push('/landing' as any)}><BrandWordmark /></Pressable>
      <Text style={styles.localLabel}>Guest list</Text>
    </View>
    {!draft ? <View style={styles.setup}>
      <Text accessibilityRole="header" style={styles.title}>Start with what you love.</Text>
      <Text style={styles.lead}>Make a list, add a few favorites, and put them in order. No account needed to try it.</Text>
      <Text style={styles.helper}>Add 10 favorites to unlock numeric scores. You can save a smaller list anytime.</Text>
      <Text style={styles.label}>What are you ranking?</Text>
      <View style={styles.categories}>{categories.map(c => <Pressable key={c.value} accessibilityRole="button" accessibilityState={{ selected: c.value === category }} accessibilityLabel={c.label} onPress={() => { setCategory(c.value); if (title.startsWith('My favorite ')) setTitle(`My favorite ${c.label.toLowerCase()}`); }} style={[styles.category, c.value === category && styles.selected]}>
        <Ionicons name={c.icon} size={24} color={c.value === category ? colors.purpleLight : colors.textMuted} /><Text style={[styles.categoryLabel, c.value === category && { color: colors.text }]}>{c.label}</Text>
      </Pressable>)}</View>
      <Text style={styles.label}>Name your list</Text>
      <TextInput accessibilityLabel="List name" value={title} onChangeText={setTitle} maxLength={200} placeholder="My favorite movies" placeholderTextColor={colors.textPlaceholder} style={styles.input} onSubmitEditing={start} returnKeyType="go" />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Button label="Add your first favorite" onPress={start} icon="arrow-forward" style={{ marginTop: 20 }} />
      <Text style={styles.notice}>{persistent ? 'Your guest list is stored in this browser, unencrypted, for up to 7 days after your last edit. Avoid sensitive information on a shared device.' : 'Browser storage is unavailable. You can try a list in this session, but it may be lost when you refresh or leave.'}</Text>
    </View> : <>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>{draft.title}</Text>
        <Text style={styles.lead}>{draft.items.length === 0 ? 'Add two favorites. Then decide which one comes first.' : draft.items.length === 1 ? 'One favorite down. Add another to try a head-to-head pick.' : 'Your favorites, in your order. Compare two or move an item to fine-tune your list.'}</Text>
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={[styles.workspace, wide && styles.workspaceWide]}>
        <View style={[styles.addColumn, wide && { width: 320 }]}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Add a favorite</Text>
          <Text style={styles.label}>Title</Text>
          <View style={styles.addRow}>
            <TextInput accessibilityLabel="Favorite title" value={entry} onChangeText={setEntry} maxLength={200} placeholder={`A ${draft.category === 'music' ? 'song or album' : draft.category === 'tv' ? 'TV show' : draft.category === 'movies' ? 'movie' : draft.category === 'games' ? 'game' : 'book'} you love`} placeholderTextColor={colors.textPlaceholder} style={[styles.input, { flex: 1 }]} onSubmitEditing={() => add(entry)} returnKeyType="done" />
            <Pressable accessibilityRole="button" accessibilityLabel="Add favorite" accessibilityState={{ disabled: !entry.trim() || draft.items.length >= GUEST_DRAFT_MAX_ITEMS }} disabled={!entry.trim() || draft.items.length >= GUEST_DRAFT_MAX_ITEMS} onPress={() => add(entry)} style={[styles.addButton, (!entry.trim() || draft.items.length >= GUEST_DRAFT_MAX_ITEMS) && styles.disabled]}><Ionicons name="add" size={24} color={colors.text} /></Pressable>
          </View>
          <Text style={styles.helper}>Type any title and add it. Up to 20 favorites before saving.</Text>
          {suggestions.length ? <View style={styles.suggestions}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: suggestionsExpanded }} onPress={() => setSuggestionsExpanded(value => !value)} style={styles.suggestionsToggle}>
              <Text style={styles.link}>{suggestionsExpanded ? 'Hide starter titles' : 'Browse starter titles'}</Text>
              <Ionicons name={suggestionsExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.purpleLight} />
            </Pressable>
            {suggestionsExpanded ? <View>
            {suggestions.map(m => <Pressable key={m.title} accessibilityRole="button" accessibilityLabel={`Add ${m.title}`} disabled={draft.items.length >= GUEST_DRAFT_MAX_ITEMS} onPress={() => add(m.title, m.image)} style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}>
              <Image source={{ uri: artworkUri(m.image) }} accessibilityLabel={m.alt} style={styles.suggestionImage} contentFit="cover" />
              <Text style={styles.suggestionTitle}>{m.title}</Text><Ionicons name="add-outline" size={22} color={colors.purpleLight} />
            </Pressable>)}
            <Pressable accessibilityRole="link" onPress={() => router.push('/image-credits' as any)} style={styles.textLink}><Text style={styles.link}>Artwork credits</Text></Pressable>
            </View> : null}
          </View> : null}
        </View>
        <View style={styles.rankingColumn}>
          <View style={styles.rankingHeading}><Text accessibilityRole="header" style={styles.sectionTitle}>Your ranking</Text><Text style={styles.helper}>{draft.items.length} / 20</Text></View>
          <ScoreProgress count={draft.items.length} guest />
          {!draft.items.length ? <View style={styles.empty}><Ionicons name="list-outline" size={36} color={colors.textMuted} /><Text style={styles.emptyText}>Your first favorite goes here.</Text><Text style={styles.helper}>Add a title to begin your ranking.</Text></View> : <>
            {draft.items.map((item, index) => <View key={item.id} style={styles.rankedRow}>
              <Text style={styles.rank} accessibilityLabel={`Rank ${index + 1}`}>{index + 1}</Text>
              {item.image_url ? <Image source={{ uri: artworkUri(item.image_url) }} accessibilityLabel={`Artwork for ${item.title}`} style={styles.rankedImage} contentFit="cover" /> : <View style={styles.rankedImagePlaceholder}><Ionicons name={activeCategory.icon} size={22} color={colors.textMuted} /></View>}
              <Text style={styles.itemTitle}>{item.title}</Text>
              {guestScore(index, draft.items.length) !== null ? <Text accessibilityLabel={`Score ${guestScore(index, draft.items.length)?.toFixed(1)} out of 10`} style={styles.score}>{guestScore(index, draft.items.length)?.toFixed(1)}</Text> : null}
              <View style={styles.rowActions}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Move ${item.title} up`} disabled={index === 0} accessibilityState={{ disabled: index === 0 }} onPress={() => move(index, -1)} style={[styles.iconButton, index === 0 && styles.disabled]}><Ionicons name="arrow-up" size={18} color={colors.textMuted} /></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Move ${item.title} down`} disabled={index === draft.items.length - 1} accessibilityState={{ disabled: index === draft.items.length - 1 }} onPress={() => move(index, 1)} style={[styles.iconButton, index === draft.items.length - 1 && styles.disabled]}><Ionicons name="arrow-down" size={18} color={colors.textMuted} /></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.title}`} onPress={() => { if (persist({ ...draft, items: draft.items.filter(i => i.id !== item.id) })) { setStatus(`${item.title} removed.`); setUndoItems(null); setComparing(false); } }} style={styles.iconButton}><Ionicons name="close" size={18} color={colors.textMuted} /></Pressable>
              </View>
            </View>)}
            {draft.items.length >= 2 && !comparing ? <Button label="Compare your top two" variant="secondary" onPress={() => { setComparing(true); setUndoItems(null); }} style={{ marginTop: 20 }} /> : null}
            {comparing && draft.items.length >= 2 ? <View style={styles.comparison}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Which do you love more?</Text>
              <View style={styles.choices}>{draft.items.slice(0, 2).map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Choose ${item.title}`} onPress={() => choose(item.id)} style={({ pressed }) => [styles.choice, pressed && styles.pressed]}><Text style={styles.choiceTitle}>{item.title}</Text><Text style={styles.link}>Put this first</Text></Pressable>)}</View>
              <Pressable accessibilityRole="button" onPress={() => setComparing(false)} style={styles.textLink}><Text style={styles.link}>Keep this order</Text></Pressable>
            </View> : null}
            {status ? <Text accessibilityLiveRegion="polite" style={styles.status}>{status}</Text> : null}
            {undoItems ? <Pressable accessibilityRole="button" onPress={() => { if (persist({ ...draft, items: undoItems })) { setUndoItems(null); setStatus('Previous order restored.'); } }} style={styles.textLink}><Text style={styles.link}>Undo last comparison</Text></Pressable> : null}
            <View style={styles.saveArea}><Button label="Save my list" onPress={() => { void handoff(); }} loading={saving} icon="arrow-forward" /><Text style={styles.saveNote}>Create an account to keep this list and add more later. You choose what to share.</Text><Pressable accessibilityRole="link" onPress={() => { void handoff(true); }} disabled={saving} style={styles.textLink}><Text style={styles.link}>Already have an account? Log in to save</Text></Pressable></View>
          </>}
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.notice}>{persistent ? 'Stored in this browser, unencrypted, for up to 7 days after your last edit. Clearing browser storage removes your guest list. It is not saved to an account yet.' : 'Browser storage is unavailable. This list may be lost when you refresh, leave, or use an external sign-in flow. Copy your titles before continuing.'}</Text>
        {confirmDiscard ? <View style={styles.discard}><Text style={styles.helper}>Discard this guest list and start again?</Text><View style={styles.discardActions}><Button label="Keep my list" variant="secondary" onPress={() => setConfirmDiscard(false)} /><Button label="Discard list" variant="ghost" onPress={() => { clearGuestDraft(); setDraft(null); setStatus(''); setError(''); setUndoItems(null); setConfirmDiscard(false); setComparing(false); }} /></View></View> : <Pressable accessibilityRole="button" onPress={() => setConfirmDiscard(true)} style={styles.textLink}><Text style={styles.link}>Start a different list</Text></Pressable>}
      </View>
    </>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, loading: { flex: 1, justifyContent: 'center', backgroundColor: colors.bg },
  page: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 24, paddingBottom: 48 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 88, gap: 16 }, localLabel: { color: colors.textMuted, fontSize: 14 },
  setup: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingTop: 44 },
  title: { color: colors.text, fontSize: 32, lineHeight: 39, fontWeight: '800', letterSpacing: -0.8 }, lead: { color: colors.textMuted, fontSize: 16, lineHeight: 25, marginTop: 12, maxWidth: 680 },
  label: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '600', marginTop: 24, marginBottom: 10 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6 }, category: { minWidth: 90, flexGrow: 1, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 16 }, selected: { borderColor: colors.purpleLight, backgroundColor: colors.purpleSoft }, categoryLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  input: { backgroundColor: colors.card, color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 8, minHeight: 52, paddingHorizontal: 14, fontSize: 16, minWidth: 0 },
  error: { color: '#ff8585', fontSize: 14, lineHeight: 22, marginTop: 14 }, notice: { color: colors.textMuted, fontSize: 13, lineHeight: 21, marginTop: 22, maxWidth: 650 },
  heading: { paddingTop: 24, paddingBottom: 36 }, workspace: { gap: 36 }, workspaceWide: { flexDirection: 'row', gap: 56 }, addColumn: { flexShrink: 0 }, rankingColumn: { flex: 1, minWidth: 0 }, sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '600', lineHeight: 27 },
  addRow: { flexDirection: 'row', gap: 8 }, addButton: { width: 52, height: 52, backgroundColor: colors.purple, justifyContent: 'center', alignItems: 'center', borderRadius: 8 }, disabled: { opacity: 0.45 }, helper: { color: colors.textMuted, fontSize: 13, lineHeight: 21, marginTop: 8 },
  suggestions: { marginTop: 8 }, suggestionsToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingVertical: 10 }, suggestion: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 70, borderBottomWidth: 1, borderBottomColor: colors.borderSoft, paddingVertical: 10 }, suggestionImage: { width: 36, height: 48, borderRadius: 4, backgroundColor: colors.card }, suggestionTitle: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 21 }, pressed: { opacity: 0.7 },
  rankingHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, empty: { minHeight: 210, alignItems: 'center', justifyContent: 'center', gap: 8, borderTopWidth: 1, borderTopColor: colors.border }, emptyText: { color: colors.text, fontSize: 16 },
  score: { color: colors.purpleLight, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  rankedRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }, rank: { color: colors.textMuted, fontSize: 16, width: 20, fontVariant: ['tabular-nums'] }, rankedImage: { width: 38, height: 50, borderRadius: 4, backgroundColor: colors.card }, rankedImagePlaceholder: { width: 38, height: 50, borderRadius: 4, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center' }, itemTitle: { color: colors.text, fontSize: 16, fontWeight: '600', lineHeight: 23, flex: 1, minWidth: 110 }, rowActions: { flexDirection: 'row', marginLeft: 'auto' }, iconButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 6 },
  comparison: { marginTop: 28 }, choices: { flexDirection: 'row', gap: 12, marginTop: 14 }, choice: { flex: 1, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.card, borderRadius: 12, padding: 16, justifyContent: 'space-between', gap: 24 }, choiceTitle: { color: colors.text, fontSize: 16, fontWeight: '600', lineHeight: 24 }, status: { color: colors.textMuted, fontSize: 14, lineHeight: 23, marginTop: 16 },
  textLink: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingVertical: 10 }, link: { color: colors.purpleLight, fontSize: 14, lineHeight: 22, fontWeight: '600' }, saveArea: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 24, paddingTop: 24 }, saveNote: { color: colors.textMuted, fontSize: 14, lineHeight: 22, marginTop: 12 }, footer: { marginTop: 28, borderTopWidth: 1, borderTopColor: colors.border }, discard: { marginTop: 16 }, discardActions: { flexDirection: 'row', gap: 12, marginTop: 12, flexWrap: 'wrap' },
});
