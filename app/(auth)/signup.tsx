import { createProfile, isUsernameAvailable, validateUsername } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

const PURPLE = '#7C3AED';
const PURPLE_LIGHT = '#A78BFA';
const BG = '#0f0f13';
const CARD = '#1a1a24';
const BORDER = '#2a2a38';

WebBrowser.maybeCompleteAuthSession();

type UsernameCheckState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'taken' };

export default function Signup() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameCheck, setUsernameCheck] = useState<UsernameCheckState>({ kind: 'idle' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
    // 2. Existing password validation
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
        <View>
          <View style={styles.inputWrapper}>
            <Ionicons name="at-outline" size={18} color="#555" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="username"
              placeholderTextColor="#555"
              value={username}
              onChangeText={(t) => setUsername(t.toLowerCase().trim())}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
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

        <View style={styles.inputWrapper}>
          <Ionicons name="mail-outline" size={18} color="#555" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#555"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputWrapper}>
          <Ionicons name="lock-closed-outline" size={18} color="#555" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#555"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="oneTimeCode"
          />
        </View>

        <View style={styles.inputWrapper}>
          <Ionicons name="lock-closed-outline" size={18} color="#555" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#555"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            textContentType="oneTimeCode"
          />
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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, justifyContent: 'center', padding: 24 },
  logoArea: { alignItems: 'center', marginBottom: 40 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: PURPLE, justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 16,
  },
  logoText: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
  appName: { color: '#fff', fontSize: 26, fontWeight: 'bold', marginBottom: 6 },
  tagline: { color: '#555', fontSize: 14 },
  form: { gap: 12 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#2a1a1a', borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: '#3a2020',
  },
  errorText: { color: '#ef4444', fontSize: 14, flex: 1 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#fff', fontSize: 15 },
  usernameStatusIcon: { marginLeft: 8 },
  fieldHint: { color: '#555', fontSize: 12, marginTop: 6, paddingHorizontal: 4 },
  fieldError: { color: '#ef4444', fontSize: 12, marginTop: 6, paddingHorizontal: 4 },
  primaryButton: {
    backgroundColor: PURPLE, borderRadius: 14,
    height: 52, justifyContent: 'center', alignItems: 'center',
    marginTop: 4,
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  divider: { flex: 1, height: 1, backgroundColor: BORDER },
  dividerText: { color: '#555', fontSize: 13 },
  googleButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: CARD, borderRadius: 14,
    height: 52, borderWidth: 1, borderColor: BORDER,
  },
  googleButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  switchText: { color: '#555', fontSize: 14 },
  switchLink: { color: PURPLE_LIGHT, fontSize: 14, fontWeight: '600' },
});
