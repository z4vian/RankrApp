/**
 * app/landing.tsx
 *
 * Public, unauthenticated landing page shown to web visitors before they sign
 * in. Native users skip this entirely and go straight to /(auth)/login —
 * see the routing gate in app/_layout.tsx.
 *
 * Letterboxd-style layout: top nav with logo + auth buttons → hero with big
 * headline + primary CTA → three feature cards (row on desktop, column on
 * mobile) → footer with repeated auth links.
 */

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

export default function LandingScreen() {
  const router = useRouter();
  const { isDesktop, isWide } = useResponsive();
  // Three-column feature grid only on real desktop widths.
  const featuresRowLayout = isDesktop || isWide;

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

      {/* ---- Footer ---- */}
      <View style={styles.footer}>
        <View style={styles.footerLinks}>
          <TouchableOpacity onPress={goLogin} hitSlop={6}>
            <Text style={styles.footerLink}>Log in</Text>
          </TouchableOpacity>
          <Text style={styles.footerDivider}>·</Text>
          <TouchableOpacity onPress={goSignup} hitSlop={6}>
            <Text style={styles.footerLink}>Sign up</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.footerNote}>Built with Expo · React Native</Text>
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

  // ---- Footer ----
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  footerLink: {
    ...typography.bodyBold,
    color: colors.purpleLight,
  },
  footerDivider: {
    color: colors.textMuted,
  },
  footerNote: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
