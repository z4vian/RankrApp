import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const API_KEY = 'e5fa459f5262da4fbe03fa3ea7441eb9';

type Movie = { 
  id: number;
  title: string;
  release_date: string; 
  poster_path: string | null; 
  overview: string; 
}; 

type Game = { 
  id: number;
  name: string;
  released: string; 
  background_image: string | null; 
  description: string;
}

export default function Search() { 
  const[query, setQuery] = useState('');
  const [results, setResults] = useState<Movie[]>([]); 
  const [loading, setLoading] = useState(false); 
  const [error,setError] = useState(''); 
  const debounceTimer = useRef <ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) { 
      setResults([]);
      return;
    }

    //debounce -- wait 500 ms after user to stop typing 
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      searchMovies(query);
    }, 500);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  const searchMovies = async (searchQuery: string) => {
    setLoading(true);
    setError('');
    try { 
      const response = await fetch (`https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(searchQuery)}`);
    const data = await response.json();
    setResults (data.results ?? []);
    } catch (e) {
      setError('Something went wrong. Please try again.'); 
    } finally {
      setLoading(false);
    }
  };

  const renderMovie = ({ item }: { item: Movie }) => (
    <TouchableOpacity style={styles.card}>
      {item.poster_path ? (
        <Image source={{ uri: `https://image.tmdb.org/t/p/w92${item.poster_path}` }} 
        style={styles.poster} />
      ) : (
        <View style = {styles.noPoster}>
          <Text style={styles.noPosterText}>No Image</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.year}>
          {item.release_date ? item.release_date.slice(0, 4) : 'Unknown year'}
        </Text>
        <Text style={styles.overview} numberOfLines={2}>{item.overview}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Search movies..."
        placeholderTextColor="#aaa"
        value={query}
        onChangeText={setQuery}
      />

      {loading && <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && query.trim() && results.length === 0 && (
        <Text style={styles.noResults}>No movies found.</Text>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMovie}
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
    marginBottom: 16,
    backgroundColor: '#3a3f47',
    borderRadius: 10,
    overflow: 'hidden',
  },
  poster: {
    width: 64,
    height: 96,
  },
  noPoster: {
    width: 64,
    height: 96,
    backgroundColor: '#555',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPosterText: {
    color: '#aaa',
    fontSize: 10,
    textAlign: 'center',
  },
  info: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  year: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 6,
  },
  overview: {
    color: '#ccc',
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