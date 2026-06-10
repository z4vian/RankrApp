import { useReducedMotion } from '@/lib/a11y';
import { colors } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  const reducedMotion = useReducedMotion();
  const backdropOpacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const cardScale = useRef(new Animated.Value(reducedMotion ? 1 : 0.92)).current;
  const cardOpacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (!newItem || !compareItem) return;
    if (reducedMotion) {
      backdropOpacity.setValue(1);
      cardScale.setValue(1);
      cardOpacity.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 6,
        speed: 14,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [newItem, compareItem, reducedMotion, backdropOpacity, cardScale, cardOpacity]);

  if (!newItem || !compareItem) return null;

  const choose = (which: 'new' | 'existing') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (which === 'new') onChooseNew();
    else onChooseExisting();
  };

  return (
    <Animated.View style={[styles.overlay, { opacity: backdropOpacity }]}>
      <Animated.View style={[styles.card, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}>
        <Text style={styles.title}>Which do you prefer?</Text>
        <Text style={styles.hint}>Tap the one you like more</Text>

        <View style={styles.compareRow}>
          <TouchableOpacity
            style={styles.option}
            onPress={() => choose('new')}
            accessibilityRole="button"
            accessibilityLabel={`Prefer ${newItem.title} (new)`}
          >
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

          <TouchableOpacity
            style={styles.option}
            onPress={() => choose('existing')}
            accessibilityRole="button"
            accessibilityLabel={`Prefer ${compareItem.title}, ranked ${Number(compareItem.rank).toFixed(1)}`}
          >
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

        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Cancel comparison"
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
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
    borderWidth: 1, borderColor: colors.border,
  },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 },
  hint: { color: '#666', fontSize: 13, textAlign: 'center', marginBottom: 24 },
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  option: {
    flex: 1, backgroundColor: colors.card, borderRadius: 16,
    padding: 12, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  image: { width: '100%', height: 100, borderRadius: 10 },
  imagePlaceholder: {
    width: '100%', height: 100, borderRadius: 10,
    backgroundColor: '#111', justifyContent: 'center', alignItems: 'center',
  },
  optionTitle: { color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  newBadge: {
    backgroundColor: colors.purple, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  newBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  existingScore: { color: '#A78BFA', fontSize: 14, fontWeight: 'bold' },
  vsCol: { alignItems: 'center', width: 30 },
  vs: { color: '#555', fontSize: 16, fontWeight: 'bold' },
  cancelBtn: { marginTop: 20, alignItems: 'center', padding: 10 },
  cancelText: { color: '#555', fontSize: 14 },
});