import { supabase } from '@/lib/supabase';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator, StyleSheet, Text,
    TextInput, TouchableOpacity, View,
} from 'react-native';

const CATEGORIES = ['movies', 'music', 'games'] as const;
type Category = typeof CATEGORIES[number];

export default function CreateList() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('movies');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    setLoading(true);
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('lists').insert({
      title: title.trim(),
      description: description.trim(),
      category,
      user_id: user?.id,
    });
    if (error) { setError(error.message); } else { router.back(); }
    setLoading(false);
  };

  const categoryIcon = (cat: Category) => {
    if (cat === 'movies') return 'film-outline';
    if (cat === 'music') return 'musical-notes-outline';
    return 'game-controller-outline';
  };

  return (
    <View style={styles.container}>
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
            <Ionicons name={categoryIcon(cat)} size={20} color={category === cat ? '#fff' : '#aaa'} />
            <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create List</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#25292e', padding: 24 },
  label: { color: '#aaa', fontSize: 13, marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: '#3a3f47', color: '#fff', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 4 },
  textArea: { height: 90, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  categoryButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#3a3f47', borderRadius: 10, padding: 12, gap: 6 },
  categoryButtonActive: { backgroundColor: '#4a90e2' },
  categoryText: { color: '#aaa', fontSize: 13 },
  categoryTextActive: { color: '#fff', fontWeight: '600' },
  button: { backgroundColor: '#4a90e2', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: 'red', marginBottom: 12, textAlign: 'center' },
});