/**
 * app/(onboarding)/create-profile.tsx
 *
 * Step 1 of 2 in the post-signup onboarding flow.
 *
 * Two flows converge here:
 *   - Email signup (Phase 1): username was chosen during signup. We render
 *     it as a read-only confirmation row. User edits display name + bio +
 *     avatar and continues.
 *   - OAuth signup (Google): the HOTFIX-2 trigger created an empty profile
 *     shell with id + display_name + avatar_url (from auth.users metadata)
 *     but NO username. We must collect a username here, with the same live
 *     validation + availability check as signup.tsx, before letting the
 *     user proceed.
 *
 * Branching: `usernameLockedFromSignup` is true when the loaded profile
 * already had a non-null username. It's false (the OAuth path) when the
 * profile shell exists but username is null/empty.
 */

import { useToast } from '@/components';
import { isUsernameAvailable, validateUsername } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { colors, radius, shadow, spacing, typography } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type UsernameCheckState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'taken' };

export default function CreateProfileScreen() {
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState('');
  const [username, setUsername] = useState('');
  // T1 Fix 1 — when true, the username field is read-only (came from signup).
  // When false (OAuth signup path), the user must enter one here.
  const [usernameLockedFromSignup, setUsernameLockedFromSignup] = useState(true);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameCheck, setUsernameCheck] = useState<UsernameCheckState>({ kind: 'idle' });
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      // Pre-fill from any existing profile row (email signup created one
      // with the chosen username; OAuth created an empty shell via the
      // HOTFIX-2 trigger).
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, display_name, bio, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      const loadedUsername = (profile?.username as string | null) ?? '';
      if (loadedUsername.length > 0) {
        // Email signup path — username already chosen, lock the field.
        setUsername(loadedUsername);
        setUsernameLockedFromSignup(true);
      } else {
        // OAuth path — show empty editable username field. Seed with the
        // intended_username from auth.users metadata if it exists (covers
        // email-signup-with-pending-confirmation edge case too).
        const intended =
          (user.user_metadata as { intended_username?: string } | null)?.intended_username ?? '';
        setUsername(intended);
        setUsernameLockedFromSignup(false);
      }

      if (profile) {
        setDisplayName((profile.display_name as string | null) ?? '');
        setBio((profile.bio as string | null) ?? '');
        setAvatarUrl((profile.avatar_url as string | null) ?? '');
      } else {
        // No profile row yet — fall back to auth metadata for the name +
        // avatar so OAuth users see Google's values pre-filled even before
        // the trigger fires.
        const meta = (user.user_metadata as {
          full_name?: string;
          name?: string;
          picture?: string;
          avatar_url?: string;
        } | null) ?? null;
        if (meta) {
          setDisplayName(meta.full_name ?? meta.name ?? '');
          setAvatarUrl(meta.avatar_url ?? meta.picture ?? '');
        }
      }
      setLoading(false);
    })();
  }, []);

  // T1 Fix 1 — debounced live username availability check (500ms). Only
  // runs when the field is editable (OAuth path) and the user has typed
  // something. Mirrors signup.tsx.
  useEffect(() => {
    if (usernameLockedFromSignup) return;
    setUsernameError(null);
    if (!username) {
      setUsernameCheck({ kind: 'idle' });
      return;
    }
    const validationError = validateUsername(username);
    if (validationError) {
      setUsernameCheck({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    setUsernameCheck({ kind: 'checking' });
    const timer = setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(username);
        if (cancelled) return;
        setUsernameCheck({ kind: available ? 'available' : 'taken' });
      } catch {
        if (!cancelled) setUsernameCheck({ kind: 'idle' });
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, usernameLockedFromSignup]);

  const handlePickAvatar = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Unavailable', 'Photos are only available on iOS and Android.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;

    const uri = result.assets[0].uri;
    const fileName = `avatar-${userId}-${Date.now()}.jpg`;
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();

      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: true });

      if (!error && data) {
        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);
        setAvatarUrl(urlData.publicUrl);
      } else if (error) {
        showToast(error.message, { tone: 'error' });
      }
    } catch (err: any) {
      showToast(err?.message ?? 'Could not upload photo', { tone: 'error' });
    }
  };

  const handleContinue = async () => {
    if (!displayName.trim()) {
      showToast('Display name is required.', { tone: 'error' });
      return;
    }
    // T1 Fix 1 — OAuth path: must validate the username the user typed
    // before letting them proceed. Locked-from-signup users already have
    // a validated username in the DB.
    if (!usernameLockedFromSignup) {
      const validationError = validateUsername(username);
      if (validationError) {
        setUsernameError(validationError);
        showToast(validationError, { tone: 'error' });
        return;
      }
      if (usernameCheck.kind === 'taken') {
        setUsernameError('That username is taken.');
        showToast('That username is taken.', { tone: 'error' });
        return;
      }
      // Note: if the availability check is mid-flight ('checking'), we still
      // proceed — the canonical authority is the DB unique constraint, which
      // will surface a friendly error from createProfile (see signup.tsx).
    }

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        username,
        display_name: displayName.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl || null,
      });
    setSaving(false);
    if (error) {
      // Unique-violation on username surfaces as a friendly toast rather
      // than the raw Postgres message.
      if (error.code === '23505') {
        showToast('That username is already taken.', { tone: 'error' });
      } else {
        showToast(error.message, { tone: 'error' });
      }
      return;
    }
    router.push('/(onboarding)/first-rank' as any);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator color={colors.purpleLight} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top progress indicator */}
        <View style={styles.progressBar}>
          <View style={[styles.progressDot, styles.progressDotActive]} />
          <View style={styles.progressLine} />
          <View style={styles.progressDot} />
        </View>
        <Text style={styles.stepLabel}>Step 1 of 2</Text>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Tell us about you</Text>
          <Text style={styles.subtitle}>
            This is how friends will find and recognise you on Rankr.
          </Text>

          {/* Avatar picker */}
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={handlePickAvatar} style={styles.avatarWrapper}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {(displayName || username || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>Tap to add a photo</Text>
          </View>

          {/* Username — branches on signup path:
              - Email signup: read-only confirmation (already chosen).
              - OAuth signup: editable input with live availability check. */}
          <Text style={styles.fieldLabel}>Username</Text>
          {usernameLockedFromSignup ? (
            <>
              <View style={[styles.inputWrapper, styles.inputWrapperDisabled]}>
                <Text style={styles.atSign}>@</Text>
                <Text style={styles.usernameReadonly}>{username || 'username'}</Text>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              </View>
              <Text style={styles.fieldHint}>Chosen at signup — can&apos;t be changed here</Text>
            </>
          ) : (
            <>
              <View style={styles.inputWrapper}>
                <Text style={styles.atSign}>@</Text>
                <TextInput
                  style={styles.input}
                  placeholder="username"
                  placeholderTextColor={colors.textPlaceholder}
                  value={username}
                  onChangeText={(t) => setUsername(t.toLowerCase().trim())}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="username"
                />
                {usernameCheck.kind === 'checking' ? (
                  <ActivityIndicator size="small" color={colors.textMuted} />
                ) : usernameCheck.kind === 'available' ? (
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                ) : usernameCheck.kind === 'taken' ? (
                  <Ionicons name="close-circle" size={18} color={colors.error} />
                ) : null}
              </View>
              {usernameError ? (
                <Text style={styles.fieldError}>{usernameError}</Text>
              ) : usernameCheck.kind === 'taken' ? (
                <Text style={styles.fieldError}>That username is taken</Text>
              ) : (
                <Text style={styles.fieldHint}>
                  3-20 lowercase letters, numbers, underscores
                </Text>
              )}
            </>
          )}

          {/* Display name */}
          <Text style={styles.fieldLabel}>Display name</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="person-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={colors.textPlaceholder}
              value={displayName}
              onChangeText={setDisplayName}
            />
          </View>

          {/* Bio */}
          <Text style={styles.fieldLabel}>Bio</Text>
          <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="A line or two about your taste..."
              placeholderTextColor={colors.textPlaceholder}
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={3}
            />
          </View>
          <Text style={styles.fieldHint}>Optional, but helps friends know it&apos;s you.</Text>

          <TouchableOpacity
            style={[styles.continueBtn, saving && styles.continueBtnDisabled]}
            onPress={handleContinue}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.continueBtnText}>Continue</Text>
                <Ionicons name="chevron-forward" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  // Progress
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: spacing.lg,
  },
  progressDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.border,
  },
  progressDotActive: { backgroundColor: colors.purple },
  progressLine: {
    width: 32, height: 2, backgroundColor: colors.border,
  },
  stepLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Content
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  title: {
    ...typography.h1,
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '800',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatarWrapper: { position: 'relative', marginBottom: spacing.sm },
  avatar: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: colors.purple,
  },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: colors.purple, justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: colors.purple,
  },
  avatarInitial: { color: colors.text, fontSize: 40, fontWeight: '800' },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.purple, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.bg,
  },
  avatarHint: { ...typography.caption, color: colors.textMuted },

  // Fields
  fieldLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  fieldHint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  fieldError: { ...typography.caption, color: colors.error, marginTop: spacing.xs },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, height: 52,
  },
  inputWrapperDisabled: { backgroundColor: colors.bgDeeper, borderColor: colors.borderSoft },
  textAreaWrapper: { height: 90, alignItems: 'flex-start', paddingVertical: spacing.sm + 2 },
  inputIcon: { marginRight: spacing.sm + 2 },
  atSign: { color: colors.textMuted, fontSize: 16, marginRight: 4 },
  usernameReadonly: { flex: 1, color: colors.text, ...typography.body, fontWeight: '600' },
  input: { flex: 1, color: colors.text, ...typography.body },
  textArea: { textAlignVertical: 'top' },

  // Continue
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.purple, borderRadius: radius.pill,
    height: 52, marginTop: spacing.xl,
    ...shadow.md,
  },
  continueBtnDisabled: { opacity: 0.6 },
  continueBtnText: { ...typography.bodyBold, color: colors.text, fontSize: 16 },
});
