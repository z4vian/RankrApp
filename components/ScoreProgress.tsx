import { getScoreProgress, SCORE_UNLOCK_COUNT } from '@/lib/scoreProgress';
import { colors } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

export function ScoreProgress({ count, guest = false, scored = true }: { count: number; guest?: boolean; scored?: boolean }) {
  const { remaining, unlocked, progress } = getScoreProgress(count);
  const title = unlocked ? scored ? 'Scores unlocked' : '10 favorites added' : `${remaining} more ${remaining === 1 ? 'favorite' : 'favorites'} to unlock scores`;
  const detail = unlocked
    ? guest ? 'Your score preview is based on this order. Save your list to keep it.' : scored ? 'Your list now shows numeric scores. Compare favorites to refine them.' : 'Your list is ready for scores. Add or compare a favorite to finish ranking.'
    : 'Numeric scores appear at 10 favorites. You can order and save your list before then. Saved-for-later items don’t count.';
  return <View style={styles.notice}>
    <View style={styles.header}>
      <Ionicons name={unlocked ? 'checkmark-circle-outline' : 'bar-chart-outline'} size={21} color={colors.purpleLight} />
      <Text accessibilityLiveRegion="polite" style={styles.title}>{title}</Text>
      <Text style={styles.count}>{progress}/{SCORE_UNLOCK_COUNT}</Text>
    </View>
    <View accessibilityRole="progressbar" accessibilityLabel="Favorites needed for scores" accessibilityValue={{ min: 0, max: SCORE_UNLOCK_COUNT, now: progress, text: `${progress} of ${SCORE_UNLOCK_COUNT} favorites${unlocked && scored ? ', scores unlocked' : ''}` }} style={styles.track}>
      <View style={[styles.fill, { width: `${progress / SCORE_UNLOCK_COUNT * 100}%` }]} />
    </View>
    <Text style={styles.detail}>{detail}</Text>
  </View>;
}
const styles = StyleSheet.create({
  notice: { paddingVertical: 18, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, marginBottom: 18, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600', lineHeight: 21 },
  count: { color: colors.purpleLight, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  track: { height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.purpleLight },
  detail: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
});
