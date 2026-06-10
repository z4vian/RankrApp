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
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
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
    setError('');
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
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { intended_username: username } },
    });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    const user = data?.user;
    if (!user) {
      // Email confirmation flow — no user yet. The username is stashed in
      // user_metadata for a future post-confirmation handler to consume.
      setLoading(false);
      Alert.alert(
        'Check your email',
        'We sent a confirmation link. Click it to finish creating your account.',
      );
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

    // 5. Success.
    setLoading(false);
    router.replace('/(tabs)' as any);
  };

  const handleGoogleSignup = async () => {
    setError('');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'rankr://auth/callback' },
    });
    if (error) setError(error.message);
    else if (data?.url) await WebBrowser.openAuthSessionAsync(data.url, 'rankr://auth/callback');
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
          color="#ef4444"
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
      <View style={styles.logoArea}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>R</Text>
        </View>
        <Text style={styles.appName}>Create Account</Text>
        <Text style={styles.tagline}>Start ranking what matters to you</Text>
      </View>

      <View style={styles.form}>
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Username (required) */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>
            Username <Text style={styles.fieldRequired}>*</Text>
          </Text>
          <View style={[styles.inputWrapper, focused === 'username' && styles.inputWrapperFocused]}>
            <Ionicons name="at-outline" size={18} color={focused === 'username' ? colors.purpleLight : '#555'} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="username"
              placeholderTextColor="#555"
              value={username}
              onChangeText={(t) => setUsername(t.toLowerCase().trim())}
              onFocus={() => setFocused('username')}
              onBlur={() => setFocused(null)}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username-new"
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
            <Ionicons name="mail-outline" size={18} color={focused === 'email' ? colors.purpleLight : '#555'} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#555"
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
            <Ionicons name="lock-closed-outline" size={18} color={focused === 'password' ? colors.purpleLight : '#555'} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="At least 8 characters, 1 letter, 1 number"
              placeholderTextColor="#555"
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password-new"
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
                      color={r.ok ? '#22c55e' : '#555'}
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
            <Ionicons name="lock-closed-outline" size={18} color={focused === 'confirm' ? colors.purpleLight : '#555'} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Re-enter password"
              placeholderTextColor="#555"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              onFocus={() => setFocused('confirm')}
              onBlur={() => setFocused(null)}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password-new"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={handleSignup}
              accessibilityLabel="Confirm password"
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleSignup}
          disabled={loading}
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

        <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignup}>
          <Ionicons name="logo-google" size={18} color="#fff" />
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.switchRow} onPress={() => router.back()}>
          <Text style={styles.switchText}>Already have an account? </Text>
          <Text style={styles.switchLink}>Log in</Text>
        </TouchableOpacity>

        {/* Session 1 — legal footer. By creating an account, the user is
            explicitly agreeing — same wording as Letterboxd's signup. */}
        <View style={styles.legalRow}>
          <Text style={styles.legalText}>By creating an account you agree to our </Text>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24 },
  logoArea: { alignItems: 'center', marginBottom: 40 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: colors.purple, justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
    ...glow.purpleStrong,
  },
  logoText: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
  appName: { color: '#fff', fontSize: 26, fontWeight: 'bold', marginBottom: 6 },
  tagline: { color: '#555', fontSize: 14 },
  form: { gap: 14 },
  field: { gap: 6 },
  fieldLabel: { color: '#bbb', fontSize: 13, fontWeight: '600', marginLeft: 4 },
  fieldRequired: { color: '#ef4444' },
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
  inputWrapperFocused: {
    borderColor: colors.purple,
    borderWidth: 1.5,
    ...glow.purple,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#fff', fontSize: 15 },
  usernameStatusIcon: { marginLeft: 8 },
  fieldHint: { color: '#555', fontSize: 12, marginTop: 6, paddingHorizontal: 4 },
  fieldError: { color: '#ef4444', fontSize: 12, marginTop: 6, paddingHorizontal: 4 },

  // Password rule checklist (lives under the password input)
  pwRules: { marginTop: 8, marginLeft: 4, gap: 4 },
  pwRuleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pwRuleText: { color: '#777', fontSize: 12 },
  pwRuleTextOk: { color: '#22c55e' },
  primaryButton: {
    backgroundColor: colors.purple, borderRadius: 14,
    height: 52, justifyContent: 'center', alignItems: 'center',
    marginTop: 4,
    ...glow.purple,
    ...shadow.sm,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: '#555', fontSize: 13 },
  googleButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: colors.card, borderRadius: 14,
    height: 52, borderWidth: 1, borderColor: colors.border,
  },
  googleButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  switchText: { color: '#555', fontSize: 14 },
  switchLink: { color: colors.purpleLight, fontSize: 14, fontWeight: '600' },

  legalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  legalText: { color: '#666', fontSize: 12 },
  legalLink: { color: colors.purpleLight, fontSize: 12, fontWeight: '600' },
});
