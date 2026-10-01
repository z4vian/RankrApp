import { BrandWordmark } from '@/components/BrandWordmark';
import { ConsentCheck } from '@/components/ConsentCheck';
import { getGuestDraft } from '@/lib/guestDraft';
import { LEGAL_VERSION } from '@/lib/legal';
import {
  createProfile,
  isUsernameAvailable,
  passwordRuleChecks,
  validateEmail,
  validatePassword,
  validateUsername,
} from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { colors, glow, shadow } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

WebBrowser.maybeCompleteAuthSession();

type UsernameCheckState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'taken' };

type FocusedField = 'username' | 'email' | 'password' | 'confirm' | null;

export default function Signup() {
  const router = useRouter();
  const [hasDraft, setHasDraft] = useState(false);
  useEffect(() => { setHasDraft(Boolean(getGuestDraft()?.items.length)); }, []);
  const [accepted, setAccepted] = useState(false);
  const [notice, setNotice] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameCheck, setUsernameCheck] = useState<UsernameCheckState>({ kind: 'idle' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<FocusedField>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Debounced live availability check (500ms).
  useEffect(() => {
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
    setCheckingUsername(true);
    setUsernameCheck({ kind: 'checking' });
    const timer = setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(username);
        if (cancelled) return;
        setUsernameCheck({ kind: available ? 'available' : 'taken' });
      } catch {
        if (!cancelled) setUsernameCheck({ kind: 'idle' });
      } finally {
        if (!cancelled) setCheckingUsername(false);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setCheckingUsername(false);
    };
  }, [username]);

  const handleSignup = async () => {
    if (loading) return;
    setError('');
    setNotice('');
    if (!accepted) { setError('Please review and accept the Terms before creating an account.'); return; }
    // 1. Username validation
    const usernameValidation = validateUsername(username);
    if (usernameValidation) {
      setUsernameError(usernameValidation);
      return;
    }
    // 2. Email validation
    const emailValidation = validateEmail(email);
    if (emailValidation) {
      setError(emailValidation);
      return;
    }
    // 3. Password validation (length, letter, number, not-same-as-identity)
    const passwordValidation = validatePassword(password, { username, email });
    if (passwordValidation) {
      setError(passwordValidation);
      return;
    }
    // 4. Confirm matches
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);

    // 3. Sign up. Stash desired username in user_metadata so a post-confirm
    // hook can create the profile if email confirmation is enabled.
    try {
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: Platform.OS === 'web' ? `${window.location.origin}/` : undefined, data: { rankr_walkthrough_required: true, intended_username: username, terms_version: LEGAL_VERSION, privacy_version: LEGAL_VERSION, terms_accepted_at: new Date().toISOString() } },
    });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    const user = data?.user;
    if (!data.session || !user) {
      // Email confirmation flow — no user yet. The username is stashed in
      // user_metadata for a future post-confirmation handler to consume.
      setLoading(false);
      setNotice(hasDraft ? 'Check your email, then return in this same browser to save your starter list. Device drafts expire after 7 days.' : 'Check your email for a confirmation link, then return to log in.');
      return;
    }

    // 4. Try to create the profile row now.
    try {
      await createProfile({ userId: user.id, username });
    } catch (err: any) {
      // Race or DB error — best-effort sign-out so the half-created account
      // doesn't lock the user into a broken state.
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
      setError(err?.message ?? 'Could not create profile.');
      setLoading(false);
      return;
    }

    // Refresh the route guard after profile creation; preserve the guest draft.
    const refresh = await supabase.auth.updateUser({ data: { rankr_walkthrough_required: true } });
    if (refresh.error) throw refresh.error;
    setLoading(false);
    router.replace(hasDraft ? '/save-list' : '/walkthrough?variant=full' as any);
    } catch { setError('Could not create your account. Check your connection and try again.'); }
    finally { setLoading(false); }
  };

  const handleGoogleSignup = async () => {
    if (loading) return;
    if (!accepted) { setError('Please review and accept the Terms before continuing.'); return; }
    setError(''); setLoading(true);
    try {
      const redirectTo = Platform.OS === 'web' ? `${window.location.origin}/` : 'rankr://auth/callback';
      const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
      if (error) throw error;
      if (Platform.OS !== 'web' && data?.url) await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    } catch { setError('Could not start Google sign-in. Please try again.'); }
    finally { setLoading(false); }
  };

  // Inline status indicator for the username field
  const renderUsernameStatus = () => {
    if (checkingUsername || usernameCheck.kind === 'checking') {
      return <ActivityIndicator size="small" color="#888" style={styles.usernameStatusIcon} />;
    }
    if (usernameCheck.kind === 'available') {
      return (
        <Ionicons
          name="checkmark-circle"
          size={18}
          color="#22c55e"
          style={styles.usernameStatusIcon}
        />
      );
    }
    if (usernameCheck.kind === 'taken') {
      return (
        <Ionicons
          name="close-circle"
          size={18}
          color="#ff8585"
          style={styles.usernameStatusIcon}
        />
      );
    }
    return null;
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.logoArea}>
        {Platform.OS === 'web' ? <View style={{ marginBottom: 32 }}><BrandWordmark /></View> : (
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>R</Text>
        </View>
        )}
        <Text accessibilityRole="header" style={styles.appName}>{hasDraft ? 'Keep your first list' : 'Create your account'}</Text>
        <Text style={styles.tagline}>{hasDraft ? 'Your list is ready. Create an account to save it privately.' : 'Start ranking what matters to you'}</Text>
      </View>

      <View style={styles.form}>
        <TouchableOpacity accessibilityRole="link" onPress={() => router.push('/try' as any)} style={{ paddingVertical: 12 }}><Text style={{ color: colors.purpleLight }}>{hasDraft ? 'Back to my starter list' : 'Try building a list first'}</Text></TouchableOpacity>
        {error ? (
          <View accessibilityRole="alert" style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color="#ff8585" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {notice ? <Text accessibilityLiveRegion="polite" style={{ color: colors.success, lineHeight: 22 }}>{notice}</Text> : null}
        {/* Username (required) */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>
            Username <Text style={styles.fieldRequired}>*</Text>
          </Text>
          <View style={[styles.inputWrapper, focused === 'username' && styles.inputWrapperFocused]}>
            <Ionicons name="at-outline" size={18} color={focused === 'username' ? colors.purpleLight : colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="username"
              placeholderTextColor="#a6a4b3"
              value={username}
              onChangeText={(t) => setUsername(t.toLowerCase().trim())}
              onFocus={() => setFocused('username')}
              onBlur={() => setFocused(null)}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              accessibilityLabel="Username"
            />
            {renderUsernameStatus()}
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
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>
            Email <Text style={styles.fieldRequired}>*</Text>
          </Text>
          <View style={[styles.inputWrapper, focused === 'email' && styles.inputWrapperFocused]}>
            <Ionicons name="mail-outline" size={18} color={focused === 'email' ? colors.purpleLight : colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#a6a4b3"
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              accessibilityLabel="Email address"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>
            Password <Text style={styles.fieldRequired}>*</Text>
          </Text>
          <View style={[styles.inputWrapper, focused === 'password' && styles.inputWrapperFocused]}>
            <Ionicons name="lock-closed-outline" size={18} color={focused === 'password' ? colors.purpleLight : colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Create a password"
              placeholderTextColor="#a6a4b3"
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={'new-password' as any}
              textContentType="newPassword"
              accessibilityLabel="Password"
            />
            <TouchableOpacity
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color="#888"
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.fieldHint}>Use at least 8 characters, including a letter and a number.</Text>
          {/* Live password rule checklist — only renders once the user has
              started typing so the form isn't littered with red X's on mount. */}
          {password.length > 0 ? (() => {
            const checks = passwordRuleChecks(password, { username, email });
            const rules: { ok: boolean; label: string }[] = [
              { ok: checks.length, label: 'At least 8 characters' },
              { ok: checks.hasLetter, label: 'Contains a letter' },
              { ok: checks.hasNumber, label: 'Contains a number' },
              { ok: checks.notSameAsIdentity, label: "Different from your username and email" },
            ];
            return (
              <View style={styles.pwRules}>
                {rules.map((r) => (
                  <View key={r.label} style={styles.pwRuleRow}>
                    <Ionicons
                      name={r.ok ? 'checkmark-circle' : 'ellipse-outline'}
                      size={13}
                      color={r.ok ? '#22c55e' : colors.textMuted}
                    />
                    <Text style={[styles.pwRuleText, r.ok && styles.pwRuleTextOk]}>
                      {r.label}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })() : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>
            Confirm Password <Text style={styles.fieldRequired}>*</Text>
          </Text>
          <View style={[styles.inputWrapper, focused === 'confirm' && styles.inputWrapperFocused]}>
            <Ionicons name="lock-closed-outline" size={18} color={focused === 'confirm' ? colors.purpleLight : colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Re-enter password"
              placeholderTextColor="#a6a4b3"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              onFocus={() => setFocused('confirm')}
              onBlur={() => setFocused(null)}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={'new-password' as any}
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={handleSignup}
              accessibilityLabel="Confirm password"
            />
          </View>
        </View>

        <ConsentCheck checked={accepted} onChange={setAccepted} label="I am at least 13, agree to the Terms & Conditions, and acknowledge the Privacy Policy. If required, I have a parent or guardian’s permission." />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: loading || !accepted, busy: loading }}
          style={[styles.primaryButton, (!accepted || loading) && { opacity: 0.55 }]}
          onPress={handleSignup}
          disabled={loading || !accepted}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Create Account</Text>
          )}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity accessibilityRole="button" disabled={loading || !accepted} style={[styles.googleButton, (!accepted || loading) && { opacity: 0.55 }]} onPress={handleGoogleSignup}>
          <Ionicons name="logo-google" size={18} color="#fff" />
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.switchRow} accessibilityRole="link" onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.switchText}>Already have an account? </Text>
          <Text style={styles.switchLink}>Log in</Text>
        </TouchableOpacity>

        {/* Session 1 — legal footer. By creating an account, the user is
            explicitly agreeing — same wording as Letterboxd's signup. */}
        <View style={styles.legalRow}>
          <Text style={styles.legalText}>Review our </Text>
          <TouchableOpacity
            onPress={() => router.push('/terms' as any)}
            hitSlop={6}
            accessibilityRole="link"
            accessibilityLabel="Terms of Service"
          >
            <Text style={styles.legalLink}>Terms</Text>
          </TouchableOpacity>
          <Text style={styles.legalText}> and </Text>
          <TouchableOpacity
            onPress={() => router.push('/privacy' as any)}
            hitSlop={6}
            accessibilityRole="link"
            accessibilityLabel="Privacy Policy"
          >
            <Text style={styles.legalLink}>Privacy</Text>
          </TouchableOpacity>
          <Text style={styles.legalText}>.</Text>
        </View>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { flexGrow: 1, padding: 24, width: '100%', maxWidth: 488, alignSelf: 'center', justifyContent: 'center' },
  logoArea: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: colors.purple, justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
    ...glow.purpleStrong,
  },
  logoText: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
  appName: { color: '#fff', fontSize: 26, fontWeight: 'bold', marginBottom: 6 },
  tagline: { color: colors.textMuted, fontSize: 14 },
  form: { gap: 14 },
  field: { gap: 6 },
  fieldLabel: { color: '#bbb', fontSize: 14, fontWeight: '600', marginLeft: 0 },
  fieldRequired: { color: '#ff8585' },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#2a1a1a', borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: '#3a2020',
  },
  errorText: { color: '#ff8585', fontSize: 14, flex: 1 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: Platform.OS === 'web' ? 8 : 14,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, height: 52,
  },
  inputWrapperFocused: {
    borderColor: colors.purple,
    borderWidth: 1.5,
    ...(Platform.OS !== 'web' ? glow.purple : {}),
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, minWidth: 0, color: '#fff', fontSize: 16 },
  usernameStatusIcon: { marginLeft: 8 },
  fieldHint: { color: colors.textMuted, fontSize: 12, marginTop: 6, paddingHorizontal: 4 },
  fieldError: { color: '#ff8585', fontSize: 12, marginTop: 6, paddingHorizontal: 4 },

  // Password rule checklist (lives under the password input)
  pwRules: { marginTop: 8, marginLeft: 4, gap: 4 },
  pwRuleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pwRuleText: { color: colors.textMuted, fontSize: 12 },
  pwRuleTextOk: { color: '#22c55e' },
  primaryButton: {
    backgroundColor: colors.purple, borderRadius: Platform.OS === 'web' ? 8 : 14,
    height: 52, justifyContent: 'center', alignItems: 'center',
    marginTop: 4,
    ...(Platform.OS !== 'web' ? glow.purple : {}),
    ...(Platform.OS !== 'web' ? shadow.sm : {}),
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, fontSize: 13 },
  googleButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: colors.card, borderRadius: Platform.OS === 'web' ? 8 : 14,
    height: 52, borderWidth: 1, borderColor: colors.border,
  },
  googleButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  switchText: { color: colors.textMuted, fontSize: 14 },
  switchLink: { color: colors.purpleLight, fontSize: 14, fontWeight: '600' },

  legalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  legalText: { color: colors.textMuted, fontSize: 12 },
  legalLink: { color: colors.purpleLight, fontSize: 12, fontWeight: '600' },
});
