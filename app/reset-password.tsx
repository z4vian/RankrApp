/**
 * app/reset-password.tsx
 *
 * Landing page for the password-reset magic link. Supabase puts
 * `access_token` + `refresh_token` (+ `type=recovery`) in the URL hash on
 * web; on native the deep-link arrives with the same params in the URL.
 * Our supabase client is configured with `detectSessionInUrl: false` so we
 * extract the tokens manually and call `setSession(...)` before updating
 * the password.
 *
 * UX:
 *   1. While the tokens are being parsed/set: a brief loading state.
 *   2. If no valid recovery tokens: an error state with a "Back to login"
 *      button (no password fields shown — would silently update the
 *      already-signed-in user's password otherwise).
 *   3. Normal: new password + confirm password + live rule checklist
 *      (mirrors signup.tsx). Submit → updateUser({ password }) → success
 *      toast → router.replace('/(tabs)').
 */

import { useToast } from '@/components';
import { passwordRuleChecks, validatePassword } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { colors, glow, shadow } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

type SetupState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string };

/**
 * Extract recovery tokens from the URL. Supabase's recovery email lands on
 * the redirect URL with `#access_token=...&refresh_token=...&type=recovery`.
 *
 * On web we read window.location.hash. On native, the deep-link Linking API
 * exposes the same params via the URL's hash/query (we check both).
 */
function extractRecoveryTokens(initialUrl: string | null): {
  accessToken: string | null;
  refreshToken: string | null;
} {
  // Helper that pulls tokens from a `key=value&key=value` string.
  const parseParams = (raw: string): { accessToken: string | null; refreshToken: string | null } => {
    const out = { accessToken: null as string | null, refreshToken: null as string | null };
    if (!raw) return out;
    for (const pair of raw.split('&')) {
      const [k, v] = pair.split('=');
      if (k === 'access_token') out.accessToken = decodeURIComponent(v ?? '');
      else if (k === 'refresh_token') out.refreshToken = decodeURIComponent(v ?? '');
    }
    return out;
  };

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const hash = window.location.hash.replace(/^#/, '');
    const hashTokens = parseParams(hash);
    if (hashTokens.accessToken || hashTokens.refreshToken) return hashTokens;
    // Some Supabase configs put tokens in the query string instead of hash
    const query = window.location.search.replace(/^\?/, '');
    return parseParams(query);
  }

  if (initialUrl) {
    // Native: the URL has form `rankr://reset-password#access_token=...` or
    // `rankr://reset-password?access_token=...`. Try hash first, then query.
    const hashIdx = initialUrl.indexOf('#');
    if (hashIdx >= 0) {
      const fromHash = parseParams(initialUrl.slice(hashIdx + 1));
      if (fromHash.accessToken || fromHash.refreshToken) return fromHash;
    }
    const queryIdx = initialUrl.indexOf('?');
    if (queryIdx >= 0) {
      return parseParams(initialUrl.slice(queryIdx + 1));
    }
  }

  return { accessToken: null, refreshToken: null };
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  // expo-router exposes deep-link params for non-web — read them here as a
  // fallback in case the URL didn't have a hash/query block we could parse.
  const params = useLocalSearchParams<{ access_token?: string; refresh_token?: string }>();

  const [setupState, setSetupState] = useState<SetupState>({ kind: 'loading' });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Parse the URL once on mount; set the supabase session if we found valid
  // tokens; otherwise surface an error.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = Platform.OS === 'web' ? null : await Linking.getInitialURL();
        const { accessToken, refreshToken } = extractRecoveryTokens(url);
        // expo-router params can also surface the tokens if they came in as
        // query params handled by the router itself.
        const finalAccess = accessToken ?? params.access_token ?? null;
        const finalRefresh = refreshToken ?? params.refresh_token ?? null;

        if (!finalAccess || !finalRefresh) {
          if (!cancelled) {
            setSetupState({
              kind: 'error',
              message:
                "We couldn't find a valid recovery link. Open the link from your email on this device, or request a new one.",
            });
          }
          return;
        }
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: finalAccess,
          refresh_token: finalRefresh,
        });
        if (cancelled) return;
        if (sessionError) {
          setSetupState({
            kind: 'error',
            message: sessionError.message,
          });
          return;
        }
        setSetupState({ kind: 'ready' });
      } catch (err: any) {
        if (!cancelled) {
          setSetupState({
            kind: 'error',
            message: err?.message ?? 'Could not process the recovery link.',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.access_token, params.refresh_token]);

  // Live rule checklist (mirrors signup.tsx).
  const rules = useMemo(() => passwordRuleChecks(newPassword), [newPassword]);

  const handleSubmit = async () => {
    setError('');
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    showToast('Password updated.', { tone: 'success' });
    router.replace('/(tabs)' as any);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoArea}>
            <View style={styles.logoCircle}>
              <Ionicons name="key" size={36} color="#fff" />
            </View>
            <Text style={styles.title}>Set a new password</Text>
            <Text style={styles.subtitle}>
              Choose a strong password to finish resetting your account.
            </Text>
          </View>

          {setupState.kind === 'loading' ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator color={colors.purpleLight} />
              <Text style={styles.loadingText}>Verifying your recovery link…</Text>
            </View>
          ) : setupState.kind === 'error' ? (
            <View style={styles.form}>
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
                <Text style={styles.errorText}>{setupState.message}</Text>
              </View>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.replace('/(auth)/login' as any)}
                accessibilityRole="button"
                accessibilityLabel="Back to login"
              >
                <Text style={styles.primaryButtonText}>Back to login</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.switchRow}
                onPress={() => router.replace('/(auth)/forgot-password' as any)}
              >
                <Text style={styles.switchLink}>Request a new reset link</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.form}>
              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>New password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={18} color="#555" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Choose a new password"
                    placeholderTextColor="#555"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="password-new"
                    textContentType="newPassword"
                    accessibilityLabel="New password"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={12}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color="#888"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Live rule checklist — only shown when the user has started
                  typing, to avoid yelling at them when the field is empty. */}
              {newPassword.length > 0 ? (
                <View style={styles.checklist}>
                  <RuleRow ok={rules.length} label="8–72 characters" />
                  <RuleRow ok={rules.hasLetter} label="Contains a letter" />
                  <RuleRow ok={rules.hasNumber} label="Contains a number" />
                </View>
              ) : null}

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Confirm new password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={18} color="#555" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Re-enter your new password"
                    placeholderTextColor="#555"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="password-new"
                    textContentType="newPassword"
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                    accessibilityLabel="Confirm new password"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSubmit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Update password</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RuleRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={styles.ruleRow}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'ellipse-outline'}
        size={14}
        color={ok ? colors.success : '#555'}
      />
      <Text style={[styles.ruleText, ok && styles.ruleTextOk]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },

  logoArea: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: colors.purple, justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    ...glow.purpleStrong,
  },
  title: { color: '#fff', fontSize: 26, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  subtitle: {
    color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24,
  },

  loadingBlock: {
    alignItems: 'center', gap: 12, paddingVertical: 24,
  },
  loadingText: { color: '#888', fontSize: 14 },

  form: { gap: 14 },
  field: { gap: 6 },
  fieldLabel: { color: '#bbb', fontSize: 13, fontWeight: '600', marginLeft: 4 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#2a1a1a', borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: '#3a2020',
  },
  errorText: { color: '#ef4444', fontSize: 14, flex: 1 },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#fff', fontSize: 15 },

  checklist: {
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  ruleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  ruleText: { color: '#888', fontSize: 12 },
  ruleTextOk: { color: colors.success },

  primaryButton: {
    backgroundColor: colors.purple, borderRadius: 14,
    height: 52, justifyContent: 'center', alignItems: 'center',
    marginTop: 4,
    ...glow.purple,
    ...shadow.sm,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  switchRow: { alignItems: 'center', paddingVertical: 8 },
  switchLink: { color: colors.purpleLight, fontSize: 14, fontWeight: '600' },
});
