import { colors } from '@/lib/theme';
import { StyleSheet, Text, View } from 'react-native';

/** Shared geometric mark from the approved Rankr landing page. */
export function BrandWordmark() {
  return <View style={styles.row}>
    <View style={styles.mark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.shortBar} /><View style={styles.tallBar} />
    </View>
    <Text style={styles.name}>Rankr</Text>
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 28 },
  shortBar: { width: 8, height: 18, borderRadius: 2, backgroundColor: colors.purpleLight },
  tallBar: { width: 8, height: 28, borderRadius: 2, backgroundColor: colors.purpleLight },
  name: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
});
