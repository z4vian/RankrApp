/**
 * app/post/compose.tsx
 *
 * Twitter-style compose screen.
 *
 * Reads optional `?listItemId=` from search params — when present, fetches
 * the item and prefills the ComposePostInput's attachment. On submit, calls
 * createPost and navigates back. ComposePostInput surfaces its own Alert
 * on error so this screen just needs to handle the success path.
 *
 * Visibility and attachment state live in this screen (the component is
 * controlled — it owns only the body text); the screen passes them in and
 * receives change callbacks.
 */

import { createPost } from '@/lib/posts';
import { fetchListItemWithOwner } from '@/lib/queries';
import { colors, spacing, typography } from '@/lib/theme';
import {
  ComposePostInput,
  type ComposePostAttachedItem,
  type Visibility,
} from '@/components';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ComposePostScreen() {
  const router = useRouter();
  const { listItemId } = useLocalSearchParams<{ listItemId?: string }>();

  // Body text lives inside ComposePostInput. We own the rest.
  const [visibility, setVisibility] = useState<Visibility>('private');

  // The component's `attachedItem` type has no id. We track the id alongside
  // it so we can pass `listItemId` into `createPost` and unset both together.
  const [attached, setAttached] = useState<ComposePostAttachedItem | null>(null);
  const [attachedItemId, setAttachedItemId] = useState<string | null>(null);
  const [attachmentLoading, setAttachmentLoading] = useState(false);

  useEffect(() => {
    if (!listItemId) return;
    let cancelled = false;
    setAttachmentLoading(true);
    (async () => {
      const detail = await fetchListItemWithOwner(listItemId);
      if (cancelled) return;
      if (detail) {
        setAttached({
          title: detail.title,
          subtitle: detail.subtitle,
          image_url: detail.image_url,
          category: detail.category,
          rank: detail.rank,
        });
        setAttachedItemId(detail.id);
      }
      setAttachmentLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [listItemId]);

  const handleSubmit = async (body: string) => {
    // ComposePostInput surfaces errors via its own Alert; we just need to
    // succeed (then dismiss) or let the error propagate so the input doesn't
    // clear its body.
    await createPost({
      body,
      visibility,
      listItemId: attachedItemId,
    });
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => router.back()}
            hitSlop={10}
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New post</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <ComposePostInput
            onSubmit={handleSubmit}
            visibility={visibility}
            onVisibilityChange={setVisibility}
            attachedItem={attached}
            onClearAttachment={() => {
              setAttached(null);
              setAttachedItemId(null);
            }}
          />

          {attachmentLoading ? (
            <Text style={styles.loadingHint}>Loading attachment…</Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
  },
  headerSpacer: {
    width: 36,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  loadingHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
});
