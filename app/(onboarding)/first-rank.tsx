/**
 * app/(onboarding)/first-rank.tsx
 *
 * Step 2 of 2 in onboarding. Explains binary comparison ranking, then offers
 * the 5 categories — tap one to create a default "My Top {Category}" list and
 * jump into search for that category. Bottom link to skip.
 *
 * Either path (pick a category OR skip) calls markOnboardingComplete() before
 * routing — the user is done with onboarding regardless of which they choose.
 */

import { useToast } from '@/components';
import { categoryIcon } from '@/components/_categoryIcon';
import { markOnboardingComplete } from '@/lib/onboarding';
import { supabase } from '@/lib/supabase';
import { colors, radius, shadow, spacing, typography } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Category = 'movies' | 'tv' | 'games' | 'music' | 'books';

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'movies', label: 'Movies' },
  { key: 'tv', label: 'TV Shows' },
  { key: 'games', label: 'Games' },
  { key: 'music', label: 'Music' },
  { key: 'books', label: 'Books' },
];

export default function FirstRankScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [creating, setCreating] = useState<Category | null>(null);
  const [skipping, setSkipping] = useState(false);

  const handlePickCategory = async (category: Category) => {
    if (creating) return;
    setCreating(category);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast('You must be signed in.', { tone: 'error' });
        setCreating(null);
        return;
      }

      const label = CATEGORIES.find((c) => c.key === category)?.label ?? category;
      const { error } = await supabase
        .from('lists')
        .insert({
          title: `My Top ${label}`,
          description: '',
          category,
          visibility: 'private',
          user_id: user.id,
        });

      if (error) {
        showToast(error.message, { tone: 'error' });
        setCreating(null);
        return;
      }

      // Mark onboarding done before navigating — the route guard reads this
      // on the next session-state change to decide whether to push the user
      // back here.
      await markOnboardingComplete().catch(() => {
        // Non-fatal: the guard's back-compat path (non-null username) will
        // still treat them as onboarded. Toast for visibility.
        showToast('We saved your list but couldn’t finish onboarding. You can ignore this.', {
          tone: 'info',
        });
      });

      // Route to the category's search screen. The list is created — the
      // user can search and add items right away.
      router.replace(`/(tabs)/search/${category}` as any);
    } catch (err: any) {
      showToast(err?.message ?? 'Could not create list', { tone: 'error' });
      setCreating(null);
    }
  };

  const handleSkip = async () => {
    if (skipping || creating) return;
    setSkipping(true);
    try {
      await markOnboardingComplete();
    } catch {
      // Best-effort — back-compat path covers us.
    }
    router.replace('/(tabs)' as any);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top progress indicator */}
      <View style={styles.progressBar}>
        <View style={[styles.progressDot, styles.progressDotActive]} />
        <View style={[styles.progressLine, styles.progressLineActive]} />
        <View style={[styles.progressDot, styles.progressDotActive]} />
      </View>
      <Text style={styles.stepLabel}>Step 2 of 2</Text>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>How ranking works</Text>
        <Text style={styles.subtitle}>
          We&apos;ll show you two items. Pick the one you like more. A 1–10 score
          emerges from your comparisons. No stars, no agonising.
        </Text>

        <View style={styles.explainerBox}>
          <View style={styles.explainerRow}>
            <View style={styles.explainerIcon}>
              <Ionicons name="add-circle-outline" size={20} color={colors.purpleLight} />
            </View>
            <Text style={styles.explainerText}>
              <Text style={styles.explainerStrong}>Add an item</Text> — search for something
              you watched, played, read, or listened to.
            </Text>
          </View>
          <View style={styles.explainerRow}>
            <View style={styles.explainerIcon}>
              <Ionicons name="swap-horizontal" size={20} color={colors.purpleLight} />
            </View>
            <Text style={styles.explainerText}>
              <Text style={styles.explainerStrong}>Pick winners</Text> — head-to-head, the one
              you like more.
            </Text>
          </View>
          <View style={styles.explainerRow}>
            <View style={styles.explainerIcon}>
              <Ionicons name="stats-chart-outline" size={20} color={colors.purpleLight} />
            </View>
            <Text style={styles.explainerText}>
              <Text style={styles.explainerStrong}>See your scores</Text> — every comparison
              refines the list.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Pick where to start</Text>
        <Text style={styles.sectionHint}>
          We&apos;ll create a &ldquo;My Top&rdquo; list for you and take you to search.
        </Text>

        <View style={styles.catGrid}>
          {CATEGORIES.map((cat) => {
            const isCreating = creating === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[styles.catCard, isCreating && styles.catCardActive]}
                onPress={() => handlePickCategory(cat.key)}
                disabled={creating !== null}
                activeOpacity={0.85}
              >
                <View style={styles.catIcon}>
                  {isCreating ? (
                    <ActivityIndicator color={colors.purpleLight} size="small" />
                  ) : (
                    <Ionicons
                      name={categoryIcon(cat.key)}
                      size={26}
                      color={colors.purpleLight}
                    />
                  )}
                </View>
                <Text style={styles.catLabel}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          onPress={handleSkip}
          disabled={skipping || creating !== null}
          style={styles.skipBtn}
          hitSlop={12}
        >
          {skipping ? (
            <ActivityIndicator color={colors.textMuted} size="small" />
          ) : (
            <Text style={styles.skipText}>I&apos;ll do this later</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  // Progress
  progressBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingTop: spacing.lg,
  },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border },
  progressDotActive: { backgroundColor: colors.purple },
  progressLine: { width: 32, height: 2, backgroundColor: colors.border },
  progressLineActive: { backgroundColor: colors.purple },
  stepLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    letterSpacing: 1, textTransform: 'uppercase',
  },

  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },

  title: {
    ...typography.h1, fontSize: 28, fontWeight: '800',
    color: colors.text, textAlign: 'center',
  },
  subtitle: {
    ...typography.body, color: colors.textSecondary,
    textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.xl,
    lineHeight: 22,
  },

  // Explainer
  explainerBox: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg, gap: spacing.md,
    marginBottom: spacing.xl,
  },
  explainerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  explainerIcon: {
    width: 32, height: 32, borderRadius: radius.md,
    backgroundColor: colors.purpleSoft,
    justifyContent: 'center', alignItems: 'center',
  },
  explainerText: { flex: 1, ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  explainerStrong: { color: colors.text, fontWeight: '700' },

  // Category picker
  sectionLabel: {
    ...typography.h3, color: colors.text,
    marginBottom: spacing.xs,
  },
  sectionHint: {
    ...typography.small, color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  catGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md,
  },
  catCard: {
    flexBasis: '47%', flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg,
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    ...shadow.sm,
  },
  catCardActive: { borderColor: colors.purple },
  catIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.purpleSoft,
    justifyContent: 'center', alignItems: 'center',
  },
  catLabel: { ...typography.bodyBold, color: colors.text },

  // Skip
  skipBtn: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginTop: spacing.lg,
  },
  skipText: { ...typography.body, color: colors.textMuted, textDecorationLine: 'underline' },
});
