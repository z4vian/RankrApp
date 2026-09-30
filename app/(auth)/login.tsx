import { BrandWordmark } from '@/components/BrandWordmark';
import { supabase } from '@/lib/supabase';
import { colors, glow, shadow } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

WebBrowser.maybeCompleteAuthSession();

type FocusedField = 'email' | 'password' | null;

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<FocusedField>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else router.replace('/(tabs)' as any);
    } catch { setError('Could not sign in. Check your connection and try again.'); }
    finally { setLoading(false); }
  };

  const handleGoogleLogin = async () => {
    if (loading) return;
    setError(''); setLoading(true);
    try {
      const redirectTo = Platform.OS === 'web' ? `${window.location.origin}/` : 'rankr://auth/callback';
      const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
      if (error) throw error;
      if (Platform.OS !== 'web' && data?.url) await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    } catch { setError('Could not start Google sign-in. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      {/* Logo area */}
      <View style={styles.logoArea}>
        {Platform.OS === 'web' ? <View style={{ marginBottom: 32 }}><BrandWordmark /></View> : (
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>R</Text>
        </View>
        )}
        <Text accessibilityRole="header" style={styles.appName}>Welcome back</Text>
        <Text style={styles.tagline}>Rank everything you love</Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        {error ? (
          <View accessibilityRole="alert" style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color="#ff8585" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Email</Text>
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
              returnKeyType="next"
              accessibilityLabel="Email address"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Password</Text>
          <View style={[styles.inputWrapper, focused === 'password' && styles.inputWrapperFocused]}>
            <Ionicons name="lock-closed-outline" size={18} color={focused === 'password' ? colors.purpleLight : colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Your password"
              placeholderTextColor="#a6a4b3"
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={'current-password' as any}
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleLogin}
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
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          accessibilityRole="button"
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Log In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.forgotRow}
          onPress={() => router.push('/forgot-password' as any)}
          hitSlop={12}
          accessibilityRole="link"
          accessibilityLabel="Forgot password"
        >
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity accessibilityRole="button" disabled={loading} style={styles.googleButton} onPress={handleGoogleLogin}>
          <Ionicons name="logo-google" size={18} color="#fff" />
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchRow}
          accessibilityRole="link"
          onPress={() => router.push('/(auth)/signup' as any)}
        >
          <Text style={styles.switchText}>Don&apos;t have an account? </Text>
          <Text style={styles.switchLink}>Sign up</Text>
        </TouchableOpacity>

        {/* Session 1 — legal footer. Tappable links into the public Privacy
            and Terms screens (no auth required). */}
        <View style={styles.legalRow}>
          <Text style={styles.legalText}>Read our </Text>
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
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: colors.purple, justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    ...glow.purpleStrong,
  },
  logoText: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
  appName: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginBottom: 6 },
  tagline: { color: colors.textMuted, fontSize: 16 },

  form: { gap: 14 },
  field: { gap: 6 },
  fieldLabel: { color: '#bbb', fontSize: 14, fontWeight: '600', marginLeft: 0 },

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
  input: { flex: 1, color: '#fff', fontSize: 16 },

  primaryButton: {
    backgroundColor: colors.purple, borderRadius: Platform.OS === 'web' ? 8 : 14,
    height: 52, justifyContent: 'center', alignItems: 'center',
    marginTop: 4,
    ...(Platform.OS !== 'web' ? glow.purple : {}),
    ...(Platform.OS !== 'web' ? shadow.sm : {}),
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  forgotRow: { alignItems: 'center', paddingVertical: 4 },
  forgotText: { color: colors.purpleLight, fontSize: 14, fontWeight: '600' },

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