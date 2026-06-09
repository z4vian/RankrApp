/**
 * app/profile/[username]/compare.tsx
 *
 * Compare-with-friend screen. Resolves the target user via the username
 * param, calls getOverlapWithUser, and renders:
 *   - <SimilarityScore /> at the top
 *   - subhead with shared item count
 *   - list of OverlapRow (inline component — item + two score badges)
 *   - graceful empty / self-compare / not-found states
 */

import { getOverlapWithUser, type OverlapItem } from '@/lib/insights';
import {
  EmptyState,
  LoadingState,
  SimilarityScore,
} from '@/components';
import { categoryIcon } from '@/components/_categoryIcon';
import { fetchProfileByUsername, type PublicProfile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { colors, radius, scoreColor, spacing, typography } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'self' }
  | { kind: 'ok'; profile: PublicProfile; score: number; shared: OverlapItem[] };

export default function CompareScreen() {
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username: string }>();
  const usernameStr = (username ?? '').toLowerCase();

  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    const profile = await fetchProfileByUsername(usernameStr);
    if (!profile) {
      setState({ kind: 'not-found' });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id === profile.id) {
      setState({ kind: 'self' });
      return;
    }

    const overlap = await getOverlapWithUser(profile.id);
    if (!overlap) {
      // Treat null as no-overlap rather than not-found — the lib returns null
      // for self-compare or no session; we've handled self above so any null
      // here is a session / RLS edge case.
      setState({
        kind: 'ok',
        profile,
        score: 0,
        shared: [],
      });
      return;
    }
    setState({
      kind: 'ok',
      profile,
      score: overlap.similarity_score,
      shared: overlap.shared_items,
    });
  }, [usernameStr]);

  useEffect(() => {
    load();
  }, [load]);

  const renderHeader = (title: string) => (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  if (state.kind === 'loading') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {renderHeader('Compare')}
        <LoadingState label="Comparing your taste…" />
      </SafeAreaView>
    );
  }

  if (state.kind === 'not-found') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {renderHeader('Compare')}
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="person-outline"
            title="User not found"
            subtitle={`We couldn't find @${usernameStr}.`}
            actionLabel="Go Back"
            onAction={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (state.kind === 'self') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {renderHeader('Compare')}
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="happy-outline"
            title="Can't compare with yourself"
            subtitle="Pick a friend's profile to see how your taste lines up."
            actionLabel="Go Back"
            onAction={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  // state.kind === 'ok'
  const { profile, score, shared } = state;
  const displayName = profile.display_name ?? profile.username;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {renderHeader(`Compare with @${profile.username}`)}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — similarity ring + names */}
        <View style={styles.heroBlock}>
          <SimilarityScore score={score} label="Taste match" size="lg" />
          <Text style={styles.heroSubhead}>
            You vs <Text style={styles.heroAccent}>{displayName}</Text>
          </Text>
          <Text style={styles.heroCount}>
            {shared.length === 0
              ? 'No overlap yet'
              : `${shared.length} ${shared.length === 1 ? 'item' : 'items'} you've both ranked`}
          </Text>
        </View>

        {shared.length === 0 ? (
          <View style={styles.emptySection}>
            <EmptyState
              icon="albums-outline"
              title="No overlap yet"
              subtitle="Try ranking more items in the same categories — we'll show your taste match the moment you both have one."
            />
          </View>
        ) : (
          <View style={styles.list}>
            <Text style={styles.listHeader}>SHARED RANKINGS</Text>
            {shared.map((item) => (
              <OverlapRow
                key={`${item.category}:${item.external_id}`}
                item={item}
                youName="You"
                themName={displayName}
              />
            ))}
          </View>
        )}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// OverlapRow — single item with two score badges side-by-side.
// ---------------------------------------------------------------------------

function OverlapRow({
  item,
  youName,
  themName,
}: {
  item: OverlapItem;
  youName: string;
  themName: string;
}) {
  return (
    <View style={styles.row}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.rowImage} contentFit="cover" />
      ) : (
        <View style={[styles.rowImage, styles.rowImagePlaceholder]}>
          <Ionicons
            name={categoryIcon(item.category)}
            size={20}
            color={colors.purpleLight}
          />
        </View>
      )}
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.rowCategory}>{item.category}</Text>
      </View>
      <View style={styles.rowScores}>
        <View style={styles.scoreCell}>
          <Text style={styles.scoreOwner}>{youName}</Text>
          <View style={[styles.scoreBadge, { borderColor: scoreColor(item.my_rank) }]}>
            <Text style={[styles.scoreValue, { color: scoreColor(item.my_rank) }]}>
              {item.my_rank.toFixed(1)}
            </Text>
          </View>
        </View>
        <View style={styles.scoreCell}>
          <Text style={styles.scoreOwner} numberOfLines={1}>{themName}</Text>
          <View style={[styles.scoreBadge, { borderColor: scoreColor(item.their_rank) }]}>
            <Text style={[styles.scoreValue, { color: scoreColor(item.their_rank) }]}>
              {item.their_rank.toFixed(1)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: spacing.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { flex: 1, ...typography.h3, color: colors.text },
  headerSpacer: { width: 36 },

  emptyWrap: { flex: 1, justifyContent: 'center' },
  scrollContent: { paddingTop: spacing.xl },

  // Hero
  heroBlock: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  heroSubhead: {
    ...typography.h3, color: colors.textSecondary,
    marginTop: spacing.md,
  },
  heroAccent: { color: colors.text, fontWeight: '700' },
  heroCount: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs },

  // Empty section
  emptySection: { paddingTop: spacing.lg },

  // List
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  listHeader: {
    ...typography.micro, color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, gap: spacing.md,
  },
  rowImage: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.bgDeeper },
  rowImagePlaceholder: {
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.purpleSoft,
  },
  rowInfo: { flex: 1, minWidth: 0 },
  rowTitle: { ...typography.bodyBold, color: colors.text, marginBottom: 2 },
  rowCategory: { ...typography.caption, color: colors.textMuted, textTransform: 'capitalize' },

  rowScores: { flexDirection: 'row', gap: spacing.sm },
  scoreCell: { alignItems: 'center', gap: 4, minWidth: 52 },
  scoreOwner: { ...typography.caption, color: colors.textMuted, fontSize: 10 },
  scoreBadge: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
  },
  scoreValue: { ...typography.bodyBold, fontWeight: '800' },
});
