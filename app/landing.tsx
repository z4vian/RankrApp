/**
 * app/landing.tsx
 *
 * Public, unauthenticated landing page shown to web visitors before they sign
 * in. Native users skip this entirely and go straight to /(auth)/login —
 * see the routing gate in app/_layout.tsx.
 *
 * Letterboxd-style layout (top-to-bottom):
 *   1. Top nav (logo + auth buttons)
 *   2. Hero (headline + primary CTA)
 *   3. Three feature cards
 *   4. "How ranking works"        — 3 numbered explainer panels
 *   5. "Rank what matters to you" — 5 category showcase cards
 *   6. "Get started in 30 seconds" — 3-step stepper + bottom CTA
 *   7. Richer footer (3 columns + bottom strip)
 */

import { categoryIcon } from '@/components/_categoryIcon';
import { useResponsive } from '@/lib/responsive';
import { colors, radius, shadow, spacing, typography } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Feature = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
};

const FEATURES: Feature[] = [
  {
    icon: 'stats-chart-outline',
    title: 'Rank by comparison',
    body:
      "We show you two items; you pick the one you like more. Over time we build a precise leaderboard of your taste.",
  },
  {
    icon: 'apps-outline',
    title: 'Five media types',
    body:
      'Movies. TV shows. Video games. Albums. Books. All in one journal, ranked your way.',
  },
  {
    icon: 'people-outline',
    title: 'Social by default',
    body:
      "Follow friends. See what they're ranking. Comment and react. Mark who you watched a film with.",
  },
];

// ---- Copy for the new sections ------------------------------------------

type HowStep = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
};

const HOW_STEPS: HowStep[] = [
  {
    icon: 'add-circle-outline',
    title: 'Add an item',
    body: 'Search for something you watched, played, read, or listened to. One tap to add it.',
  },
  {
    icon: 'swap-horizontal',
    title: 'Pick the winner',
    body: "We show you two items. Pick the one you like more. That's it.",
  },
  {
    icon: 'stats-chart-outline',
    title: 'Watch your score emerge',
    body: 'Items get a 1–10 score based on every comparison. No stars, no agonising.',
  },
];

type MediaType = {
  category: 'movies' | 'tv' | 'games' | 'music' | 'books';
  title: string;
  body: string;
};

const MEDIA_TYPES: MediaType[] = [
  { category: 'movies', title: 'Movies', body: 'Rate the best films you’ve ever seen.' },
  { category: 'tv', title: 'TV Shows', body: 'Track binge-worthy series and find new ones.' },
  { category: 'games', title: 'Games', body: 'Rank from AAA epics to indie gems.' },
  { category: 'music', title: 'Music', body: 'The albums and tracks you keep coming back to.' },
  { category: 'books', title: 'Books', body: 'Bestsellers to obscure paperback gems.' },
];

type GetStartedStep = {
  title: string;
  body: string;
};

const GET_STARTED_STEPS: GetStartedStep[] = [
  { title: 'Sign up', body: 'Free. No credit card.' },
  { title: 'Create your first list', body: 'Pick a category and name it.' },
  { title: 'Start ranking', body: 'Pick winners head-to-head.' },
];

export default function LandingScreen() {
  const router = useRouter();
  const { isTablet, isDesktop, isWide } = useResponsive();
  // Three-column feature grid only on real desktop widths.
  const featuresRowLayout = isDesktop || isWide;
  // Tablet-only 2-column grid for the media-types section. On desktop the
  // section uses the 5-card row; on mobile it collapses to a single column.
  const isTabletLayout = isTablet;

  const goLogin = () => router.push('/(auth)/login' as any);
  const goSignup = () => router.push('/(auth)/signup' as any);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Subtle purple sparkles in the top-right of the hero — adds visual
          interest without introducing a new color or gradient asset. */}
      <View pointerEvents="none" style={styles.heroDecor}>
        <Ionicons name="sparkles" size={260} color={colors.purpleSoft} />
      </View>

      {/* ---- Top nav ---- */}
      <View style={styles.nav}>
        <View style={styles.brand}>
          <View style={styles.brandLogo}>
            <Text style={styles.brandLogoText}>R</Text>
          </View>
          <Text style={styles.brandWordmark}>Rankr</Text>
        </View>
        <View style={styles.navActions}>
          <TouchableOpacity onPress={goLogin} style={styles.navLink} hitSlop={6}>
            <Text style={styles.navLinkText}>Log in</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goSignup} style={styles.navCta}>
            <Text style={styles.navCtaText}>Sign up</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ---- Hero ---- */}
      <View style={styles.hero}>
        <Text style={styles.heroHeadline}>Rank everything you love.</Text>
        <Text style={styles.heroSubhead}>
          Movies, TV, games, music, books — head-to-head ranked, journaled, and shared.
        </Text>
        <TouchableOpacity
          onPress={goSignup}
          style={styles.heroPrimary}
          activeOpacity={0.85}
        >
          <Text style={styles.heroPrimaryText}>Sign up — it&apos;s free</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goLogin} style={styles.heroSecondary} hitSlop={6}>
          <Text style={styles.heroSecondaryText}>
            Already a member?{' '}
            <Text style={styles.heroSecondaryAccent}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </View>

      {/* ---- Features ---- */}
      <View
        style={[
          styles.features,
          featuresRowLayout && styles.featuresRow,
        ]}
      >
        {FEATURES.map((f) => (
          <View
            key={f.title}
            style={[
              styles.featureCard,
              featuresRowLayout && styles.featureCardDesktop,
            ]}
          >
            <View style={styles.featureIconWrap}>
              <Ionicons name={f.icon} size={28} color={colors.purpleLight} />
            </View>
            <Text style={styles.featureTitle}>{f.title}</Text>
            <Text style={styles.featureBody}>{f.body}</Text>
          </View>
        ))}
      </View>

      {/* ---- How ranking works ---- */}
      <View style={styles.section}>
        <View style={styles.sectionHeadings}>
          <Text style={styles.sectionTitle}>How ranking works</Text>
          <Text style={styles.sectionSubtitle}>
            Pick winners head-to-head. Your scores build themselves.
          </Text>
        </View>
        <View
          style={[
            styles.howGrid,
            featuresRowLayout && styles.howGridRow,
          ]}
        >
          {HOW_STEPS.map((step, idx) => (
            <View
              key={step.title}
              style={[
                styles.howPanel,
                featuresRowLayout && styles.howPanelDesktop,
              ]}
            >
              <Text style={styles.howNumber}>{idx + 1}</Text>
              <View style={styles.howIconWrap}>
                <Ionicons name={step.icon} size={32} color={colors.purpleLight} />
              </View>
              <Text style={styles.howTitle}>{step.title}</Text>
              <Text style={styles.howBody}>{step.body}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ---- Rank what matters to you ---- */}
      <View style={styles.section}>
        <View style={styles.sectionHeadings}>
          <Text style={styles.sectionTitle}>Rank what matters to you</Text>
          <Text style={styles.sectionSubtitle}>
            Five categories. One unified feed.
          </Text>
        </View>
        <View
          style={[
            styles.mediaGrid,
            isTabletLayout && styles.mediaGridTablet,
            featuresRowLayout && styles.mediaGridDesktop,
          ]}
        >
          {MEDIA_TYPES.map((m) => (
            <View
              key={m.category}
              style={[
                styles.mediaCard,
                isTabletLayout && styles.mediaCardTablet,
                featuresRowLayout && styles.mediaCardDesktop,
              ]}
            >
              <View style={styles.mediaIconCircle}>
                <Ionicons
                  name={categoryIcon(m.category)}
                  size={32}
                  color={colors.purpleLight}
                />
              </View>
              <Text style={styles.mediaTitle}>{m.title}</Text>
              <Text style={styles.mediaBody}>{m.body}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ---- Get started in 30 seconds ---- */}
      <View style={styles.section}>
        <View style={styles.sectionHeadings}>
          <Text style={styles.sectionTitle}>Get started in 30 seconds</Text>
          <Text style={styles.sectionSubtitle}>
            Three steps to your first ranking.
          </Text>
        </View>
        <View
          style={[
            styles.stepper,
            featuresRowLayout && styles.stepperRow,
          ]}
        >
          {/* Horizontal connector line, desktop only. Sits behind the
              numbered circles via absolute positioning + zIndex. */}
          {featuresRowLayout ? (
            <View pointerEvents="none" style={styles.stepperConnector} />
          ) : null}

          {GET_STARTED_STEPS.map((step, idx) => (
            <View
              key={step.title}
              style={[
                styles.stepItem,
                featuresRowLayout && styles.stepItemDesktop,
              ]}
            >
              <View style={styles.stepCircle}>
                <Text style={styles.stepCircleText}>{idx + 1}</Text>
              </View>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepBody}>{step.body}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          onPress={goSignup}
          style={styles.sectionCta}
          activeOpacity={0.85}
        >
          <Text style={styles.sectionCtaText}>Get started</Text>
        </TouchableOpacity>
      </View>

      {/* ---- Richer footer ---- */}
      <View style={styles.footer}>
        <View
          style={[
            styles.footerColumns,
            featuresRowLayout && styles.footerColumnsRow,
          ]}
        >
          {/* Column 1 — Rankr */}
          <View style={styles.footerCol}>
            <View style={styles.footerBrand}>
              <View style={styles.footerBrandLogo}>
                <Text style={styles.footerBrandLogoText}>R</Text>
              </View>
              <Text style={styles.footerBrandWordmark}>Rankr</Text>
            </View>
            <Text style={styles.footerTagline}>Rank everything you love.</Text>
          </View>

          {/* Column 2 — Account */}
          <View style={styles.footerCol}>
            <Text style={styles.footerColHeading}>Account</Text>
            <TouchableOpacity onPress={goLogin} hitSlop={6} style={styles.footerColItem}>
              <Text style={styles.footerColLink}>Log in</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={goSignup} hitSlop={6} style={styles.footerColItem}>
              <Text style={styles.footerColLink}>Sign up</Text>
            </TouchableOpacity>
          </View>

          {/* Column 3 — About (placeholders, no links) */}
          <View style={styles.footerCol}>
            <Text style={styles.footerColHeading}>About</Text>
            <Text style={[styles.footerColLink, styles.footerColLinkDisabled]}>About</Text>
            <Text style={[styles.footerColLink, styles.footerColLinkDisabled]}>Privacy</Text>
            <Text style={[styles.footerColLink, styles.footerColLinkDisabled]}>Terms</Text>
          </View>
        </View>

        <View style={styles.footerDividerLine} />

        <View
          style={[
            styles.footerBottom,
            featuresRowLayout && styles.footerBottomRow,
          ]}
        >
          <Text style={styles.footerNote}>© 2026 Rankr</Text>
          <Text style={styles.footerNote}>Built with Expo · React Native</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
    position: 'relative',
  },

  // ---- Decorative ----
  heroDecor: {
    position: 'absolute',
    top: -60,
    right: -40,
    opacity: 0.35,
  },

  // ---- Nav ----
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.purple,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.sm,
  },
  brandLogoText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  brandWordmark: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '800',
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  navLink: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  navLinkText: {
    ...typography.bodyBold,
    color: colors.textSecondary,
  },
  navCta: {
    backgroundColor: colors.purple,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    ...shadow.sm,
  },
  navCtaText: {
    ...typography.bodyBold,
    color: colors.text,
  },

  // ---- Hero ----
  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxxl,
  },
  heroHeadline: {
    ...typography.h1,
    fontSize: 48,
    lineHeight: 56,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '800',
    maxWidth: 720,
  },
  heroSubhead: {
    ...typography.body,
    fontSize: 17,
    lineHeight: 26,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    maxWidth: 580,
  },
  heroPrimary: {
    backgroundColor: colors.purple,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.pill,
    ...shadow.md,
    marginTop: spacing.sm,
  },
  heroPrimaryText: {
    ...typography.bodyBold,
    fontSize: 17,
    color: colors.text,
  },
  heroSecondary: {
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  heroSecondaryText: {
    ...typography.body,
    color: colors.textMuted,
  },
  heroSecondaryAccent: {
    color: colors.purpleLight,
    fontWeight: '600',
  },

  // ---- Features ----
  features: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.lg,
  },
  featuresRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: spacing.lg,
    maxWidth: 1100,
    alignSelf: 'center',
    width: '100%',
  },
  featureCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  featureCardDesktop: {
    flex: 1,
    maxWidth: 340,
  },
  featureIconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.purpleSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  featureTitle: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700',
  },
  featureBody: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  // ---- Generic section wrapper ----
  // Each new section sits inside one of these. xxxl between sections, xl
  // horizontal padding, max-width 1100 to match the existing features row.
  section: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxxl,
    maxWidth: 1100,
    alignSelf: 'center',
    width: '100%',
  },
  sectionHeadings: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '800',
  },
  sectionSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 560,
  },
  sectionCta: {
    backgroundColor: colors.purple,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginTop: spacing.xl,
    ...shadow.md,
  },
  sectionCtaText: {
    ...typography.bodyBold,
    fontSize: 16,
    color: colors.text,
  },

  // ---- How ranking works ----
  howGrid: {
    gap: spacing.lg,
  },
  howGridRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  howPanel: {
    backgroundColor: colors.cardElevated,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  howPanelDesktop: {
    flex: 1,
    maxWidth: 340,
  },
  // Big purple step number — focal point of each panel.
  howNumber: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '800',
    color: colors.purple,
    marginBottom: spacing.xs,
  },
  howIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.purpleSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  howTitle: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700',
  },
  howBody: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  // ---- Media types ----
  mediaGrid: {
    // Mobile default — single column.
    gap: spacing.md,
  },
  mediaGridTablet: {
    // 2-col grid via flexWrap.
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  mediaGridDesktop: {
    // 5-in-a-row.
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: spacing.md,
  },
  mediaCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  mediaCardTablet: {
    flexBasis: '46%',
    flexGrow: 1,
    maxWidth: 280,
  },
  mediaCardDesktop: {
    flex: 1,
    maxWidth: 200,
  },
  mediaIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.purpleSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  mediaTitle: {
    ...typography.bodyBold,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
  },
  mediaBody: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },

  // ---- Get started stepper ----
  stepper: {
    // Mobile default — vertical stack.
    gap: spacing.xl,
    alignItems: 'center',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    position: 'relative',
    paddingHorizontal: spacing.xl,
  },
  // Connector line — horizontal hairline behind the numbered circles.
  // Top offset is half the circle height (44/2 = 22) minus half the line
  // weight, so it threads through the centre of each circle.
  stepperConnector: {
    position: 'absolute',
    top: 21,
    left: spacing.xxxl,
    right: spacing.xxxl,
    height: 2,
    backgroundColor: colors.border,
    zIndex: 0,
  },
  stepItem: {
    alignItems: 'center',
    gap: spacing.sm,
    zIndex: 1,
    paddingHorizontal: spacing.md,
  },
  stepItemDesktop: {
    flex: 1,
    maxWidth: 240,
  },
  stepCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.purple,
    justifyContent: 'center',
    alignItems: 'center',
    // Background colour seal so the connector line doesn't poke through
    // the centre of the circle on desktop. The circle itself is purple, so
    // a matching border using bg colour creates a clean cut-out effect.
    borderWidth: 4,
    borderColor: colors.bg,
    ...shadow.sm,
  },
  stepCircleText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  stepTitle: {
    ...typography.bodyBold,
    color: colors.text,
    textAlign: 'center',
  },
  stepBody: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },

  // ---- Footer ----
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    maxWidth: 1100,
    alignSelf: 'center',
    width: '100%',
  },
  footerColumns: {
    // Mobile default — stacked columns.
    gap: spacing.xl,
    marginBottom: spacing.xl,
  },
  footerColumnsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.xxl,
  },
  footerCol: {
    gap: spacing.sm,
    flex: 1,
  },
  footerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  footerBrandLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.purple,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerBrandLogoText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  footerBrandWordmark: {
    ...typography.bodyBold,
    fontSize: 17,
    color: colors.text,
    fontWeight: '800',
  },
  footerTagline: {
    ...typography.small,
    color: colors.textMuted,
  },
  footerColHeading: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  footerColItem: {
    // TouchableOpacity wrapper so hitSlop covers the link's padding row.
    paddingVertical: 2,
  },
  footerColLink: {
    ...typography.body,
    color: colors.textSecondary,
  },
  // Placeholder column-3 items aren't tappable; mute them so they look like
  // not-yet-active links rather than misleading "click me" copy.
  footerColLinkDisabled: {
    color: colors.textMuted,
  },
  footerDividerLine: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  footerBottom: {
    // Mobile default — stacked, copyright above credit.
    alignItems: 'center',
    gap: spacing.xs,
  },
  footerBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerNote: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
