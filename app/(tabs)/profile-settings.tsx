import { supabase } from '@/lib/supabase';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, Image, KeyboardAvoidingView,
    Platform, ScrollView, StyleSheet, Text,
    TextInput, TouchableOpacity, View,
} from 'react-native';

const PURPLE = '#7C3AED';
const PURPLE_LIGHT = '#A78BFA';
const BG = '#0f0f13';
const CARD = '#1a1a24';
const BORDER = '#2a2a38';

export default function ProfileSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [activeSection, setActiveSection] = useState<'profile' | 'password'>('profile');

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    setEmail(user.email ?? '');

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profile) {
      setDisplayName(profile.display_name ?? '');
      setUsername(profile.username ?? '');
      setBio(profile.bio ?? '');
      setAvatarUrl(profile.avatar_url ?? '');
    }
    setLoading(false);
  };

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const fileName = `avatar-${userId}-${Date.now()}.jpg`;
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
      }
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        display_name: displayName,
        username,
        bio,
        avatar_url: avatarUrl,
      });
    setSaving(false);
    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Saved', 'Profile updated successfully!');
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) Alert.alert('Error', error.message);
    else {
      Alert.alert('Success', 'Password updated!');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={PURPLE_LIGHT} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickAvatar} style={styles.avatarWrapper}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {(displayName || username || email).charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Tap to change photo</Text>
        </View>

        <View style={styles.sectionToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, activeSection === 'profile' && styles.toggleBtnActive]}
            onPress={() => setActiveSection('profile')}
          >
            <Text style={[styles.toggleText, activeSection === 'profile' && styles.toggleTextActive]}>
              Profile
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, activeSection === 'password' && styles.toggleBtnActive]}
            onPress={() => setActiveSection('password')}
          >
            <Text style={[styles.toggleText, activeSection === 'password' && styles.toggleTextActive]}>
              Password
            </Text>
          </TouchableOpacity>
        </View>

        {activeSection === 'profile' ? (
          <View style={styles.form}>
            <Text style={styles.fieldLabel}>Display Name</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={18} color="#555" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor="#555"
                value={displayName}
                onChangeText={setDisplayName}
              />
            </View>

            <Text style={styles.fieldLabel}>Username</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.atSign}>@</Text>
              <TextInput
                style={styles.input}
                placeholder="username"
                placeholderTextColor="#555"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.fieldLabel}>Bio</Text>
            <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Tell people about yourself..."
                placeholderTextColor="#555"
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={3}
              />
            </View>

            <Text style={styles.fieldLabel}>Email</Text>
            <View style={[styles.inputWrapper, styles.disabledWrapper]}>
              <Ionicons name="mail-outline" size={18} color="#444" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.disabledInput]}
                value={email}
                editable={false}
              />
            </View>
            <Text style={styles.fieldHint}>Email cannot be changed</Text>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSaveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Save Profile</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.fieldLabel}>New Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color="#555" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="New password"
                placeholderTextColor="#555"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                textContentType="oneTimeCode"
              />
            </View>

            <Text style={styles.fieldLabel}>Confirm New Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color="#555" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirm new password"
                placeholderTextColor="#555"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                textContentType="oneTimeCode"
              />
            </View>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleChangePassword}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Update Password</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 60, paddingBottom: 20,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: CARD, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: BORDER,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatarWrapper: { position: 'relative', marginBottom: 8 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: PURPLE },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: PURPLE, justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: PURPLE,
  },
  avatarInitial: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: PURPLE, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: BG,
  },
  avatarHint: { color: '#555', fontSize: 13 },
  sectionToggle: {
    flexDirection: 'row', marginHorizontal: 16,
    backgroundColor: CARD, borderRadius: 12,
    padding: 4, marginBottom: 24, borderWidth: 1, borderColor: BORDER,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  toggleBtnActive: { backgroundColor: PURPLE },
  toggleText: { color: '#666', fontSize: 14, fontWeight: '600' },
  toggleTextActive: { color: '#fff' },
  form: { paddingHorizontal: 16, gap: 8 },
  fieldLabel: { color: '#888', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginTop: 8 },
  fieldHint: { color: '#555', fontSize: 11, marginTop: 2, marginBottom: 4 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14, height: 52,
  },
  textAreaWrapper: { height: 90, alignItems: 'flex-start', paddingVertical: 12 },
  inputIcon: { marginRight: 10 },
  atSign: { color: '#555', fontSize: 16, marginRight: 4 },
  input: { flex: 1, color: '#fff', fontSize: 15 },
  textArea: { textAlignVertical: 'top' },
  disabledWrapper: { backgroundColor: '#111', borderColor: '#1e1e1e' },
  disabledInput: { color: '#444' },
  saveBtn: {
    backgroundColor: PURPLE, borderRadius: 14,
    height: 52, justifyContent: 'center', alignItems: 'center',
    marginTop: 16,
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});