import { supabase } from '@/lib/supabase';
import { colors, glow, shadow } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform,
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
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else router.replace('/(tabs)' as any);
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setError('');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'rankr://auth/callback' },
    });
    if (error) setError(error.message);
    else if (data?.url) await WebBrowser.openAuthSessionAsync(data.url, 'rankr://auth/callback');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Logo area */}
      <View style={styles.logoArea}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>R</Text>
        </View>
        <Text style={styles.appName}>Rankr</Text>
        <Text style={styles.tagline}>Rank everything you love</Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Email</Text>
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
              returnKeyType="next"
              accessibilityLabel="Email address"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Password</Text>
          <View style={[styles.inputWrapper, focused === 'password' && styles.inputWrapperFocused]}>
            <Ionicons name="lock-closed-outline" size={18} color={focused === 'password' ? colors.purpleLight : '#555'} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Your password"
              placeholderTextColor="#555"
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
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

        <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
          <Ionicons name="logo-google" size={18} color="#fff" />
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchRow}
          onPress={() => router.push('/(auth)/signup' as any)}
        >
          <Text style={styles.switchText}>Don&apos;t have an account? </Text>
          <Text style={styles.switchLink}>Sign up</Text>
        </TouchableOpacity>

        {/* Session 1 — legal footer. Tappable links into the public Privacy
            and Terms screens (no auth required). */}
        <View style={styles.legalRow}>
          <Text style={styles.legalText}>By continuing you agree to our </Text>
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

  logoArea: { alignItems: 'center', marginBottom: 48 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: colors.purple, justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    ...glow.purpleStrong,
  },
  logoText: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
  appName: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginBottom: 6 },
  tagline: { color: '#555', fontSize: 15 },

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
  inputWrapperFocused: {
    borderColor: colors.purple,
    borderWidth: 1.5,
    ...glow.purple,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#fff', fontSize: 15 },

  primaryButton: {
    backgroundColor: colors.purple, borderRadius: 14,
    height: 52, justifyContent: 'center', alignItems: 'center',
    marginTop: 4,
    ...glow.purple,
    ...shadow.sm,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  forgotRow: { alignItems: 'center', paddingVertical: 4 },
  forgotText: { color: colors.purpleLight, fontSize: 14, fontWeight: '600' },

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