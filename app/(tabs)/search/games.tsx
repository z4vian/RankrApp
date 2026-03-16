import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const API_KEY = '1011d870d7cc4f368b013fd7d15101e0';

type Game = {
  id: number;
  name: string;
  background_image: string | null;
};

export default function GamesSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      searchGames(query);
    }, 500);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
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
    } catch (e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderGame = ({ item }: { item: Game }) => (
    <TouchableOpacity style={styles.card}>
      {item.background_image ? (
        <Image source={{ uri: item.background_image }} style={styles.cover} />
      ) : (
        <View style={styles.noImage}>
          <Text style={styles.noImageText}>No Image</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{item.name}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Search games..."
        placeholderTextColor="#aaa"
        value={query}
        onChangeText={setQuery}
      />

      {loading && <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && query.trim() && results.length === 0 && (
        <Text style={styles.noResults}>No games found.</Text>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderGame}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
    padding: 16,
  },
  input: {
    backgroundColor: '#3a3f47',
    color: '#fff',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3a3f47',
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cover: {
    width: 100,
    height: 70,
  },
  noImage: {
    width: 100,
    height: 70,
    backgroundColor: '#555',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    color: '#aaa',
    fontSize: 10,
  },
  info: {
    flex: 1,
    padding: 12,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  error: {
    color: 'red',
    textAlign: 'center',
    marginTop: 10,
  },
  noResults: {
    color: '#aaa',
    textAlign: 'center',
    marginTop: 20,
  },
});