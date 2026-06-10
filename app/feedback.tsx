/**
 * app/feedback.tsx
 *
 * Pre-beta Session 1 — in-app feedback screen. Reached from:
 *   - profile-settings → "Send feedback"
 *   - ErrorBoundary    → "Send a report" (passes ?error=<urlsafe-base64> of
 *                       a JSON-serialized {name, message, stack})
 *
 * Wraps the shared `<FeedbackForm>` from `@/components`. The form handles
 * its own segmented category + body + tech-details disclosure; this screen
 * is just the header, the route plumbing, and the submit/cancel UX.
 *
 * The encoded error param mirrors what `app/_components/ErrorBoundary.tsx`
 * produces in `encodeErrorParam()`. We round-trip it back into an object
 * here so the form can show "Technical details" inline.
 *
 * Submit failure surfaces a toast; FeedbackForm itself shows an Alert via
 * its own catch, but we also defensively catch here so a thrown error
 * doesn't bubble up to the route boundary.
 */

import { FeedbackForm, type FeedbackFormSubmitInput, useToast } from '@/components';
import { submitFeedback } from '@/lib/feedback';
import { colors, spacing, typography } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Decode the URL-safe base64 produced by ErrorBoundary.encodeErrorParam().
 * Falls back to hex when the encoder's btoa path wasn't available — same
 * "hex." prefix the encoder uses.
 *
 * Returns the parsed object (or `undefined` if anything goes wrong) so we
 * can hand it straight to FeedbackForm's `errorContext` prop.
 */
function decodeErrorParam(param: string | undefined): unknown {
  if (!param) return undefined;
  try {
    if (param.startsWith('hex.')) {
      const hex = param.slice(4);
      let s = '';
      for (let i = 0; i < hex.length; i += 2) {
        s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
      }
      return JSON.parse(s);
    }
    // URL-safe base64 → standard base64.
    let std = param.replace(/-/g, '+').replace(/_/g, '/');
    while (std.length % 4 !== 0) std += '=';
    if (typeof globalThis.atob !== 'function') return undefined;
    const decoded = globalThis.atob(std);
    // Reverse the encoder's `unescape(encodeURIComponent(json))` step.
    const json = decodeURIComponent(escape(decoded));
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

export default function FeedbackScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const params = useLocalSearchParams<{ error?: string }>();

  // Decode error context ONCE — useMemo so re-renders don't re-parse.
  const errorContext = useMemo(() => decodeErrorParam(params.error), [params.error]);

  const handleSubmit = async (input: FeedbackFormSubmitInput) => {
    try {
      await submitFeedback({
        body: input.body,
        category: input.category,
        errorContext: input.errorContext,
        // Hint the backend at what the user was on. Useful for triage.
        screenContext: errorContext !== undefined ? 'error-boundary' : 'profile-settings',
        platform:
          Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web'
            ? Platform.OS
            : undefined,
      });
      showToast('Thanks — your feedback was sent.', { tone: 'success' });
      router.back();
    } catch (err: any) {
      // Re-throw so FeedbackForm's own catch shows the Alert; we also toast
      // here in case the alert is dismissed before being read.
      showToast(err?.message ?? 'Could not send feedback', { tone: 'error' });
      throw err;
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {errorContext !== undefined ? 'Report a bug' : 'Send feedback'}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <FeedbackForm
        defaultCategory={errorContext !== undefined ? 'bug' : undefined}
        errorContext={errorContext}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
    </SafeAreaView>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
  },
});
