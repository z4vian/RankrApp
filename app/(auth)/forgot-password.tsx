/**
 * app/(auth)/forgot-password.tsx
 *
 * Sends the password-reset email via Supabase's resetPasswordForEmail.
 * The redirectTo URL is platform-dependent:
 *   - web: derived from window.location.origin so deep-link round-trips
 *     come back to whatever environment the user is in (preview, prod).
 *   - native: expo-linking's Linking.createURL('/reset-password') produces
 *     the app's scheme deep link.
 *
 * After a successful send, the screen shows a "Check your email" success
 * state with a Back-to-login button. On failure, surfaces the Supabase
 * error in a red error box (same UX as login).
 */

import { validateEmail } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { colors, glow, shadow } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

function buildResetRedirectUrl(): string {
  if (Platform.OS === 'web') {
    // Window origin in the browser. SSR-guarded — during prerender
    // `window` is undefined and we fall through to the native deep link.
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}/reset-password`;
    }
  }
  // Native deep link via the app scheme (`rankr://`).
  return Linking.createURL('/reset-password');
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    setError('');
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: buildResetRedirectUrl() },
    );
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.logoArea}>
        <View style={styles.logoCircle}>
          <Ionicons name="lock-closed" size={36} color="#fff" />
        </View>
        <Text style={styles.title}>
          {sent ? 'Check your email' : 'Reset your password'}
        </Text>
        <Text style={styles.subtitle}>
          {sent
            ? "We sent a reset link to your email. Open it on this device to set a new password."
            : "Enter your email and we'll send you a link to reset your password."}
        </Text>
      </View>

      {sent ? (
        <View style={styles.form}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace('/(auth)/login' as any)}
            accessibilityRole="button"
            accessibilityLabel="Back to login"
          >
            <Text style={styles.primaryButtonText}>Back to login</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.resendRow}
            onPress={() => {
              setSent(false);
              setError('');
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Send to a different email"
          >
            <Text style={styles.resendText}>Send to a different email</Text>
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
            <Text style={styles.fieldLabel}>Email</Text>
            <View style={[styles.inputWrapper, focused && styles.inputWrapperFocused]}>
              <Ionicons
                name="mail-outline"
                size={18}
                color={focused ? colors.purpleLight : '#555'}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="#555"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={handleSend}
                accessibilityLabel="Email address"
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSend}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Send reset link"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Send reset link</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchRow}
            onPress={() => router.back()}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={16} color={colors.purpleLight} />
            <Text style={styles.switchLink}>Back to login</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24 },

  logoArea: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: colors.purple, justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    ...glow.purpleStrong,
  },
  title: { color: '#fff', fontSize: 26, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  subtitle: {
    color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 20,
    paddingHorizontal: 24,
  },

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

  switchRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 4, marginTop: 8,
  },
  switchLink: { color: colors.purpleLight, fontSize: 14, fontWeight: '600' },

  resendRow: { alignItems: 'center', paddingVertical: 8 },
  resendText: { color: colors.purpleLight, fontSize: 14, fontWeight: '600' },
});
