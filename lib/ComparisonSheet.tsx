import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const PURPLE = '#7C3AED';
const CARD = '#1a1a24';
const BORDER = '#2a2a38';

export type RankedItem = {
  id: string;
  title: string;
  image_url: string | null;
  rank: number;
  sentiment: string | null;
};

type Props = {
  newItem: { title: string; image_url: string } | null;
  compareItem: RankedItem | null;
  onChooseNew: () => void;
  onChooseExisting: () => void;
  onDismiss: () => void;
};

export default function ComparisonSheet({
  newItem,
  compareItem,
  onChooseNew,
  onChooseExisting,
  onDismiss,
}: Props) {
  if (!newItem || !compareItem) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>Which do you prefer?</Text>
        <Text style={styles.hint}>Tap the one you like more</Text>

        <View style={styles.compareRow}>
          <TouchableOpacity style={styles.option} onPress={onChooseNew}>
            {newItem.image_url ? (
              <Image source={{ uri: newItem.image_url }} style={styles.image} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={28} color="#555" />
              </View>
            )}
            <Text style={styles.optionTitle} numberOfLines={2}>{newItem.title}</Text>
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.vsCol}>
            <Text style={styles.vs}>vs</Text>
          </View>

          <TouchableOpacity style={styles.option} onPress={onChooseExisting}>
            {compareItem.image_url ? (
              <Image source={{ uri: compareItem.image_url }} style={styles.image} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={28} color="#555" />
              </View>
            )}
            <Text style={styles.optionTitle} numberOfLines={2}>{compareItem.title}</Text>
            <Text style={styles.existingScore}>{Number(compareItem.rank).toFixed(1)}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.cancelBtn} onPress={onDismiss}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center', alignItems: 'center',
    padding: 20, zIndex: 1000,
  },
  card: {
    backgroundColor: '#15151e', borderRadius: 24,
    padding: 24, width: '100%',
    borderWidth: 1, borderColor: BORDER,
  },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 },
  hint: { color: '#666', fontSize: 13, textAlign: 'center', marginBottom: 24 },
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  option: {
    flex: 1, backgroundColor: CARD, borderRadius: 16,
    padding: 12, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: BORDER,
  },
  image: { width: '100%', height: 100, borderRadius: 10 },
  imagePlaceholder: {
    width: '100%', height: 100, borderRadius: 10,
    backgroundColor: '#111', justifyContent: 'center', alignItems: 'center',
  },
  optionTitle: { color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  newBadge: {
    backgroundColor: PURPLE, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  newBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  existingScore: { color: '#A78BFA', fontSize: 14, fontWeight: 'bold' },
  vsCol: { alignItems: 'center', width: 30 },
  vs: { color: '#555', fontSize: 16, fontWeight: 'bold' },
  cancelBtn: { marginTop: 20, alignItems: 'center', padding: 10 },
  cancelText: { color: '#555', fontSize: 14 },
});