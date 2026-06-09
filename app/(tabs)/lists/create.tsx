import { useToast } from '@/components';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator, ScrollView, StyleSheet, Text,
    TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Phase 5: extend to 5 categories. `lists.category` is text with no DB CHECK,
// so adding new values requires no SQL change.
const CATEGORIES = ['movies', 'tv', 'music', 'games', 'books'] as const;
type Category = typeof CATEGORIES[number];

type Visibility = 'public' | 'private';

export default function CreateList() {
  const router = useRouter();
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('movies');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: insertError } = await supabase.from('lists').insert({
        title: title.trim(),
        description: description.trim(),
        category,
        visibility,
        user_id: user?.id,
      });
      if (insertError) {
        // Most likely cause if this fails: the `visibility` column doesn't
        // exist yet because the migration hasn't been applied.
        const isMissingColumn =
          /column.*visibility/i.test(insertError.message) ||
          /schema.*cache/i.test(insertError.message);
        if (isMissingColumn) {
          showToast(
            "Couldn't create list. Make sure the database migration has been applied.",
            { tone: 'error' },
          );
        } else {
          setError(insertError.message);
        }
      } else {
        router.back();
      }
    } catch (err: any) {
      showToast(
        err?.message ?? "Couldn't create list. Make sure the database migration has been applied.",
        { tone: 'error' },
      );
    } finally {
      setLoading(false);
    }
  };

  const categoryIcon = (cat: Category) => {
    if (cat === 'movies') return 'film-outline';
    if (cat === 'tv') return 'tv-outline';
    if (cat === 'music') return 'musical-notes-outline';
    if (cat === 'books') return 'book-outline';
    return 'game-controller-outline';
  };

  const categoryLabel = (cat: Category) => {
    if (cat === 'tv') return 'TV';
    return cat.charAt(0).toUpperCase() + cat.slice(1);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header with back button — the parent Stack has headerShown: false,
          so we provide our own. Avoids the form sitting flush against the
          notch / status bar. */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New List</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.label}>Title</Text>
        <TextInput style={styles.input} placeholder="e.g. My Favorite Movies" placeholderTextColor="#aaa" value={title} onChangeText={setTitle} />
        <Text style={styles.label}>Description (optional)</Text>
        <TextInput style={[styles.input, styles.textArea]} placeholder="What is this list about?" placeholderTextColor="#aaa" value={description} onChangeText={setDescription} multiline numberOfLines={3} />
        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryButton, category === cat && styles.categoryButtonActive]}
              onPress={() => setCategory(cat)}
            >
              <Ionicons name={categoryIcon(cat)} size={18} color={category === cat ? '#fff' : '#aaa'} />
              <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>
                {categoryLabel(cat)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

      {/* Visibility toggle */}
      <Text style={styles.label}>Who can see this list?</Text>
      <View style={styles.visibilityRow}>
        <TouchableOpacity
          style={[
            styles.visibilityPill,
            visibility === 'private' && styles.visibilityPillActive,
          ]}
          onPress={() => setVisibility('private')}
          activeOpacity={0.85}
        >
          <Ionicons
            name="lock-closed"
            size={18}
            color={visibility === 'private' ? '#fff' : '#888'}
          />
          <View style={styles.visibilityTextWrap}>
            <Text
              style={[
                styles.visibilityTitle,
                visibility === 'private' && styles.visibilityTitleActive,
              ]}
            >
              Private
            </Text>
            <Text
              style={[
                styles.visibilitySubtitle,
                visibility === 'private' && styles.visibilitySubtitleActive,
              ]}
            >
              Only you
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.visibilityPill,
            visibility === 'public' && styles.visibilityPillActive,
          ]}
          onPress={() => setVisibility('public')}
          activeOpacity={0.85}
        >
          <Ionicons
            name="globe-outline"
            size={18}
            color={visibility === 'public' ? '#fff' : '#888'}
          />
          <View style={styles.visibilityTextWrap}>
            <Text
              style={[
                styles.visibilityTitle,
                visibility === 'public' && styles.visibilityTitleActive,
              ]}
            >
              Public
            </Text>
            <Text
              style={[
                styles.visibilitySubtitle,
                visibility === 'public' && styles.visibilitySubtitleActive,
              ]}
            >
              Anyone can view
            </Text>
          </View>
        </TouchableOpacity>
      </View>

        <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create List</Text>}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  headerBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },
  headerSpacer: { width: 36 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },
  label: { color: '#aaa', fontSize: 13, marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: colors.card, color: '#fff', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 4, borderWidth: 1, borderColor: colors.border },
  textArea: { height: 90, textAlignVertical: 'top' },
  // 5 pills — allow wrapping to a second row on narrow screens.
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  categoryButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, gap: 6,
    borderWidth: 1, borderColor: colors.border,
    // Grow to fill row but keep a sane minimum so labels never clip.
    flexGrow: 1, flexBasis: 88,
  },
  categoryButtonActive: { backgroundColor: colors.purple, borderColor: colors.purple },
  categoryText: { color: '#aaa', fontSize: 13 },
  categoryTextActive: { color: '#fff', fontWeight: '600' },

  // Visibility toggle
  visibilityRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  visibilityPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  visibilityPillActive: { backgroundColor: colors.purple, borderColor: colors.purple },
  visibilityTextWrap: { flexShrink: 1 },
  visibilityTitle: { color: '#ddd', fontSize: 14, fontWeight: '600' },
  visibilityTitleActive: { color: '#fff' },
  visibilitySubtitle: { color: '#666', fontSize: 11, marginTop: 1 },
  visibilitySubtitleActive: { color: colors.purpleLight },

  button: { backgroundColor: colors.purple, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#ef4444', marginBottom: 12, textAlign: 'center' },
});
