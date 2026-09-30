import { SUPPORT_EMAIL } from '@/lib/legal';
import { colors, radius, spacing, typography } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { Link, useRouter } from 'expo-router';
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
          onPress={() => router.canGoBack() ? router.back() : router.replace('/landing')}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={styles.headerTitle}>{title}</Text>
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
            <Text accessibilityRole="header" style={styles.sectionHeading}>{s.heading}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}

        <View style={{ gap: 16 }}>
          {SUPPORT_EMAIL ? <Link href={`mailto:${SUPPORT_EMAIL}`} style={styles.webRowText}>Contact: {SUPPORT_EMAIL}</Link> : <Text style={styles.footer}>A public contact email has not been configured yet. You can send a privacy or support request using feedback below.</Text>}
          <Link href="/feedback" style={styles.webRowText}>Send feedback or a privacy request</Link>
          <Link href="/privacy" style={styles.webRowText}>Privacy Policy</Link>
          <Link href="/terms" style={styles.webRowText}>Terms &amp; Conditions</Link>
          <Link href="/cookies" style={styles.webRowText}>Cookie Policy</Link>
        </View>
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
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
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
