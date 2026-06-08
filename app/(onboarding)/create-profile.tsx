/**
 * app/(onboarding)/create-profile.tsx
 *
 * Step 1 of 2 in the post-signup onboarding flow. The user's username was
 * already chosen during signup (Phase 1) — we show it as a confirmation and
 * collect display name + bio + avatar. No skip; these fields are required
 * for the social experience.
 */

import { useToast } from '@/components';
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

export default function CreateProfileScreen() {
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState('');
  const [username, setUsername] = useState('');
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

      // Pre-fill from any existing profile row (signup already created one
      // with the chosen username).
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, display_name, bio, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        setUsername((profile.username as string | null) ?? '');
        setDisplayName((profile.display_name as string | null) ?? '');
        setBio((profile.bio as string | null) ?? '');
        setAvatarUrl((profile.avatar_url as string | null) ?? '');
      }
      setLoading(false);
    })();
  }, []);

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
      showToast(error.message, { tone: 'error' });
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

          {/* Username (read-only confirmation) */}
          <Text style={styles.fieldLabel}>Username</Text>
          <View style={[styles.inputWrapper, styles.inputWrapperDisabled]}>
            <Text style={styles.atSign}>@</Text>
            <Text style={styles.usernameReadonly}>{username || 'username'}</Text>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          </View>
          <Text style={styles.fieldHint}>Chosen at signup — can&apos;t be changed here</Text>

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
