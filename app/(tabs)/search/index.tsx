
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function SearchLanding() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>What do you want to search for?</Text>

      <TouchableOpacity style={styles.button} onPress={() => router.push('/search/movies')}>
        <Ionicons name="film-outline" size={28} color="#fff" />
        <Text style={styles.buttonText}>Movies</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={() => router.push('/search/music')}>
        <Ionicons name="musical-notes-outline" size={28} color="#fff" />
        <Text style={styles.buttonText}>Music</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={() => router.push('/search/games')}>
        <Ionicons name="game-controller-outline" size={28} color="#fff" />
        <Text style={styles.buttonText}>Video Games</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  heading: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3a3f47',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    marginBottom: 16,
    gap: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});