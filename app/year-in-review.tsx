/**
 * app/year-in-review.tsx
 *
 * Phase 5 — Year-in-review recap.
 *
 * Sections (in render order):
 *   1. By the numbers      — 4 StatNumber tiles
 *   2. Top 5 ranked        — list of cards (clickable → /list-item)
 *   3. Sentiment breakdown — three counters tinted by sentiment color
 *   4. Categories          — horizontal bar widget per category
 *   5. Most active month   — single sentence
 *
 * If total_items_ranked === 0, replaces all sections with an EmptyState.
 */

import {
  EmptyState,
  InsightSection,
  LoadingState,
  StatNumber,
  type StatNumberTone,
} from '@/components';
import { categoryIcon } from '@/components/_categoryIcon';
import { getYearInsights, type YearInsights } from '@/lib/insights';
import { colors, radius, spacing, typography } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April',
  'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December',
];

function scoreColor(rank: number): string {
  if (rank >= 8) return colors.success;
  if (rank >= 6) return colors.warning;
  if (rank >= 4) return colors.attention;
  return colors.error;
}

/**
 * Map an average rank to one of StatNumber's three canonical tones.
 * StatNumber doesn't accept arbitrary colors, so we coarse-bucket:
 * - 8+ → success (green)
 * - 6+ → purple (default-ish brand color)
 * - else → default (white text)
 */
function rankTone(rank: number | null): StatNumberTone {
  if (rank === null) return 'default';
  if (rank >= 8) return 'success';
  if (rank >= 6) return 'purple';
  return 'default';
}

export default function YearInReviewScreen() {
  const router = useRouter();
  const [insights, setInsights] = useState<YearInsights | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getYearInsights();
    setInsights(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header onBack={() => router.back()} title="Year in Review" />
        <LoadingState label="Crunching your year…" />
      </SafeAreaView>
    );
  }

  if (!insights) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header onBack={() => router.back()} title="Year in Review" />
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="sparkles-outline"
            title="Couldn't load recap"
            subtitle="Please try again in a moment."
            actionLabel="Go Back"
            onAction={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (insights.total_items_ranked === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header onBack={() => router.back()} title={`${insights.year} in Review`} />
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="sparkles-outline"
            title="Nothing to recap yet"
            subtitle="Rank a few things this year and check back."
          />
        </View>
      </SafeAreaView>
    );
  }

  // Sort categories by count desc for the bar widget.
  const sortedCategories = Object.entries(insights.category_breakdown).sort(
    ([, a], [, b]) => b - a,
  );
  const maxCategoryCount = sortedCategories.length > 0
    ? Math.max(...sortedCategories.map(([, c]) => c))
    : 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header onBack={() => router.back()} title={`${insights.year} in Review`} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- By the numbers ---- */}
        <InsightSection title="By the numbers">
          <View style={styles.statsGrid}>
            <StatNumber value={insights.total_items_ranked} label="Items ranked" />
            <StatNumber value={insights.total_lists_created} label="Lists created" />
            <StatNumber value={insights.posts_made} label="Posts made" />
            <StatNumber
              value={insights.average_rank !== null ? insights.average_rank.toFixed(1) : '—'}
              label="Avg rank"
              tone={rankTone(insights.average_rank)}
            />
          </View>
        </InsightSection>

        {/* ---- Top 5 ranked ---- */}
        {insights.top_5_items.length > 0 ? (
          <InsightSection title="Top 5 ranked">
            {insights.top_5_items.map((entry, idx) => (
              <TouchableOpacity
                key={entry.list_item_id}
                style={styles.topRow}
                onPress={() => router.push(`/list-item/${entry.list_item_id}` as any)}
                activeOpacity={0.7}
              >
                <Text style={styles.topRank}>{idx + 1}</Text>
                <View style={styles.topIconWrap}>
                  <Ionicons
                    name={categoryIcon(entry.category)}
                    size={18}
                    color={colors.purpleLight}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.topTitle} numberOfLines={1}>{entry.title}</Text>
                  <Text style={styles.topSubtitle} numberOfLines={1}>
                    {entry.list_title}
                  </Text>
                </View>
                <View style={[styles.scoreChip, { borderColor: scoreColor(entry.rank) }]}>
                  <Text style={[styles.scoreText, { color: scoreColor(entry.rank) }]}>
                    {entry.rank.toFixed(1)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </InsightSection>
        ) : null}

        {/* ---- Sentiment breakdown ---- */}
        <InsightSection title="Sentiment breakdown">
          <View style={styles.sentimentRow}>
            <View style={[styles.sentimentBox, { borderColor: colors.success }]}>
              <Text style={styles.sentimentEmoji}>👍</Text>
              <Text style={[styles.sentimentCount, { color: colors.success }]}>
                {insights.sentiment_breakdown.liked}
              </Text>
              <Text style={styles.sentimentLabel}>Liked</Text>
            </View>
            <View style={[styles.sentimentBox, { borderColor: colors.warning }]}>
              <Text style={styles.sentimentEmoji}>😐</Text>
              <Text style={[styles.sentimentCount, { color: colors.warning }]}>
                {insights.sentiment_breakdown.didnt_care}
              </Text>
              <Text style={styles.sentimentLabel}>Meh</Text>
            </View>
            <View style={[styles.sentimentBox, { borderColor: colors.error }]}>
              <Text style={styles.sentimentEmoji}>👎</Text>
              <Text style={[styles.sentimentCount, { color: colors.error }]}>
                {insights.sentiment_breakdown.didnt_like}
              </Text>
              <Text style={styles.sentimentLabel}>Disliked</Text>
            </View>
          </View>
        </InsightSection>

        {/* ---- Categories ---- */}
        {sortedCategories.length > 0 ? (
          <InsightSection title="Categories">
            {sortedCategories.map(([cat, count]) => {
              const pct = Math.max(4, Math.round((count / maxCategoryCount) * 100));
              return (
                <View key={cat} style={styles.catRow}>
                  <View style={styles.catLeft}>
                    <Ionicons
                      name={categoryIcon(cat)}
                      size={16}
                      color={colors.purpleLight}
                    />
                    <Text style={styles.catLabel}>{cat}</Text>
                  </View>
                  <View style={styles.catBarTrack}>
                    <View style={[styles.catBarFill, { width: `${pct}%` as any }]} />
                  </View>
                  <Text style={styles.catCount}>{count}</Text>
                </View>
              );
            })}
          </InsightSection>
        ) : null}

        {/* ---- Most active month ----
            lib/insights.ts returns `month` as 1..12 (Jan = 1), so we subtract
            one to index into MONTH_NAMES (which is 0-indexed). Guard the index
            so a bad payload can't blow up the render. */}
        {insights.most_active_month ? (
          <InsightSection title="Most active month">
            <Text style={styles.activeMonthText}>
              You were most active in{' '}
              <Text style={styles.activeMonthAccent}>
                {MONTH_NAMES[Math.max(0, Math.min(11, insights.most_active_month.month - 1))]}
              </Text>
              {' '}with{' '}
              <Text style={styles.activeMonthAccent}>
                {insights.most_active_month.count}
              </Text>
              {' '}item{insights.most_active_month.count === 1 ? '' : 's'}.
            </Text>
          </InsightSection>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack}
        hitSlop={12}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    ...typography.h3,
    color: colors.text,
  },
  headerSpacer: {
    width: 36,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
  },

  // By the numbers
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  // Top 5
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  topRank: {
    ...typography.h3,
    color: colors.purpleLight,
    width: 22,
    textAlign: 'center',
  },
  topIconWrap: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.purpleSoft,
    justifyContent: 'center', alignItems: 'center',
  },
  topTitle: { ...typography.bodyBold, color: colors.text, marginBottom: 2 },
  topSubtitle: { ...typography.small, color: colors.textMuted },
  scoreChip: {
    minWidth: 44, paddingHorizontal: spacing.sm, height: 30,
    borderRadius: radius.pill, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
  },
  scoreText: { fontSize: 13, fontWeight: '700' },

  // Sentiment
  sentimentRow: { flexDirection: 'row', gap: spacing.sm },
  sentimentBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  sentimentEmoji: { fontSize: 24, marginBottom: 6 },
  sentimentCount: { fontSize: 22, fontWeight: 'bold', marginBottom: 2 },
  sentimentLabel: { color: colors.textMuted, fontSize: 12 },

  // Categories
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  catLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 90,
  },
  catLabel: {
    ...typography.small,
    color: colors.text,
    textTransform: 'capitalize',
  },
  catBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.borderSoft,
    borderRadius: 4,
    overflow: 'hidden',
  },
  catBarFill: {
    height: 8,
    backgroundColor: colors.purple,
    borderRadius: 4,
  },
  catCount: {
    ...typography.small,
    color: colors.textMuted,
    width: 32,
    textAlign: 'right',
  },

  // Most active month
  activeMonthText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 24,
  },
  activeMonthAccent: {
    color: colors.purpleLight,
    fontWeight: '700',
  },
});
