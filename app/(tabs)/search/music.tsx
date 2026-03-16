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

type Track = {
  trackId: number;
  name: string;
  artist: string;
  album: string;
  image: string | null;
};

export default function MusicSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
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
      searchTracks(query);
    }, 500);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  const searchTracks = async (searchQuery: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&media=music&entity=song&limit=20`
      );
      const data = await response.json();
      const formatted: Track[] = data.results.map((t: any) => ({
        trackId: t.trackId,
        name: t.trackName,
        artist: t.artistName,
        album: t.collectionName,
        image: t.artworkUrl100 ?? null,
      }));
      setResults(formatted);
    } catch (e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderTrack = ({ item }: { item: Track }) => (
    <TouchableOpacity style={styles.card}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.artwork} />
      ) : (
        <View style={styles.noImage}>
          <Text style={styles.noImageText}>No Image</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.artist} numberOfLines={1}>{item.artist}</Text>
        <Text style={styles.album} numberOfLines={1}>{item.album}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Search tracks..."
        placeholderTextColor="#aaa"
        value={query}
        onChangeText={setQuery}
      />

      {loading && <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && query.trim() && results.length === 0 && (
        <Text style={styles.noResults}>No tracks found.</Text>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.trackId.toString()}
        renderItem={renderTrack}
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
  artwork: {
    width: 64,
    height: 64,
  },
  noImage: {
    width: 64,
    height: 64,
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
    marginBottom: 2,
  },
  artist: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 2,
  },
  album: {
    color: '#777',
    fontSize: 12,
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