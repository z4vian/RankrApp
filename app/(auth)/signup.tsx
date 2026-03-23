import { supabase } from '@/lib/supabase';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

const PURPLE = '#7C3AED';
const PURPLE_LIGHT = '#A78BFA';
const BG = '#0f0f13';
const CARD = '#1a1a24';
const BORDER = '#2a2a38';

WebBrowser.maybeCompleteAuthSession();

export default function Signup() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async () => {
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setError(error.message);
    else router.replace('/(tabs)' as any);
    setLoading(false);
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