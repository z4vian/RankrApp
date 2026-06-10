/**
 * components/LegalDocument.tsx
 *
 * Shared rendering shell for legal docs (Privacy, Terms). Each variant is a
 * thin wrapper screen that imports this component with its own document
 * config. Kept in one place so the visual presentation, last-updated stamp,
 * and "open external" link affordance stay consistent.
 *
 * The actual legal content is intentionally short and placeholder-y — REAL
 * copy should be drafted by counsel (or pulled from a Termly / iubenda
 * template) before production launch. For beta, this satisfies the in-app
 * link requirement and gives testers something to read.
 */

import { colors, radius, spacing, typography } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export interface LegalSection {
  heading: string;
  body: string;
}

export interface LegalDocumentProps {
  title: string;
  lastUpdated: string;
  webUrl: string | null;
  sections: LegalSection[];
}

export function LegalDocument({
  title,
  lastUpdated,
  webUrl,
  sections,
}: LegalDocumentProps) {
  const router = useRouter();

  const handleOpenWeb = async () => {
    if (!webUrl) return;
    await WebBrowser.openBrowserAsync(webUrl);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stamp}>Last updated: {lastUpdated}</Text>

        {webUrl ? (
          <TouchableOpacity
            style={styles.webRow}
            onPress={handleOpenWeb}
            activeOpacity={0.8}
            accessibilityRole="link"
            accessibilityLabel="Open full version in browser"
          >
            <Ionicons name="globe-outline" size={16} color={colors.purpleLight} />
            <Text style={styles.webRowText}>Open full version in browser</Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.textMuted}
              style={{ marginLeft: 'auto' }}
            />
          </TouchableOpacity>
        ) : null}

        {sections.map((s) => (
          <View key={s.heading} style={styles.section}>
            <Text style={styles.sectionHeading}>{s.heading}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}

        <Text style={styles.footer}>
          Questions? Email us at support@rankrapp.com.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    gap: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { ...typography.h3, color: colors.text, flex: 1 },
  headerSpacer: { width: 40 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  stamp: {
    ...typography.small,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  webRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  webRowText: { ...typography.bodyBold, color: colors.purpleLight },
  section: { marginBottom: spacing.xl },
  sectionHeading: {
    ...typography.bodyBold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  sectionBody: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  footer: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
