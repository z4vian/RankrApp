/**
 * app/profile-delete.tsx
 *
 * Account deletion screen — destructive flow, gated by username confirmation.
 *
 * Flow:
 *   1. Read the user's current username from profiles (fall back to email
 *      handle if no username set).
 *   2. User must type their exact username to enable the delete button.
 *   3. On confirm: requestAccountDeletion() → backend tears down auth + data.
 *      The session listener in app/_layout.tsx will then route the user to
 *      /(auth)/login automatically.
 */

import { LoadingState, useToast } from '@/components';
import { requestAccountDeletion } from '@/lib/account';
import { supabase } from '@/lib/supabase';
import { colors, radius, shadow, spacing, typography } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileDeleteScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .maybeSingle();
        const fallback = user.email?.split('@')[0] ?? '';
        setUsername((profile?.username as string | null) ?? fallback);
      }
      setLoading(false);
    })();
  }, []);

  const matches = username.length > 0 && confirmText.trim() === username;

  const handleDelete = async () => {
    if (!matches || deleting) return;
    setDeleting(true);
    try {
      await requestAccountDeletion();
      // Session listener in root layout will redirect to /(auth)/login.
    } catch (err: any) {
      showToast(
        err?.message ?? 'Could not delete account. Please try again.',
        { tone: 'error' },
      );
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delete account</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <LoadingState label="Loading…" />
      ) : (
        <View style={styles.content}>
          <View style={styles.warningWrap}>
            <Ionicons name="warning" size={20} color={colors.error} />
            <Text style={styles.warningTitle}>This is permanent</Text>
          </View>

          <Text style={styles.bodyText}>
            Deleting your account will permanently remove:
          </Text>
          <View style={styles.bulletList}>
            <Bullet>Your profile, lists, and ranked items</Bullet>
            <Bullet>Posts, comments, and likes you&apos;ve made</Bullet>
            <Bullet>Your follows and followers</Bullet>
            <Bullet>All photos you&apos;ve uploaded</Bullet>
          </View>
          <Text style={styles.bodyText}>
            We can&apos;t recover any of this once it&apos;s gone.
          </Text>

          <Text style={styles.confirmLabel}>
            Type <Text style={styles.confirmHandle}>{username || 'your username'}</Text> to confirm
          </Text>
          <TextInput
            style={styles.input}
            placeholder={username || 'username'}
            placeholderTextColor={colors.textPlaceholder}
            value={confirmText}
            onChangeText={setConfirmText}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!deleting}
          />

          <TouchableOpacity
            style={[
              styles.deleteBtn,
              !matches && styles.deleteBtnDisabled,
            ]}
            disabled={!matches || deleting}
            onPress={handleDelete}
            activeOpacity={0.85}
          >
            {deleting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.deleteBtnLabel}>
                I understand. Delete my account permanently
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.cancelBtn}
            disabled={deleting}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelLabel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
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
    color: colors.error,
  },
  headerSpacer: {
    width: 36,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  warningWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  warningTitle: {
    ...typography.bodyBold,
    color: colors.error,
  },
  bodyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  bulletList: {
    gap: 4,
    paddingLeft: spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bulletDot: {
    ...typography.body,
    color: colors.purpleLight,
  },
  bulletText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  confirmLabel: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  confirmHandle: {
    color: colors.error,
    fontWeight: '700',
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    height: 48,
    color: colors.text,
    ...typography.body,
  },
  deleteBtn: {
    backgroundColor: colors.error,
    borderRadius: radius.lg,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    ...shadow.md,
    shadowColor: colors.error,
  },
  deleteBtnDisabled: {
    opacity: 0.4,
  },
  deleteBtnLabel: {
    ...typography.bodyBold,
    color: '#fff',
    textAlign: 'center',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  cancelLabel: {
    ...typography.body,
    color: colors.textMuted,
  },
});
