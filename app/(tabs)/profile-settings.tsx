import { useToast } from '@/components';
import { exportUserData, userDataToJSON } from '@/lib/account';
import { supabase } from '@/lib/supabase';
import { colors, glow, shadow } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, Image, KeyboardAvoidingView,
    Modal, Platform, ScrollView, StyleSheet, Text,
    TextInput, TouchableOpacity, View,
} from 'react-native';

const APP_VERSION = (Constants.expoConfig?.version as string | undefined) ?? '1.0.0';
const APP_BUILD =
  (Platform.OS === 'ios'
    ? (Constants.expoConfig?.ios?.buildNumber as string | undefined)
    : Constants.expoConfig?.android?.versionCode != null
      ? String(Constants.expoConfig.android.versionCode)
      : undefined) ?? '1';

export default function ProfileSettings() {
  const router = useRouter();
  const { showToast } = useToast();
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

  // Account / data-export state
  const [exporting, setExporting] = useState(false);
  const [exportJson, setExportJson] = useState<string | null>(null);

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
    if (error) showToast(error.message, { tone: 'error' });
    else showToast('Profile updated', { tone: 'success' });
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', { tone: 'error' });
      return;
    }
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters', { tone: 'error' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) showToast(error.message, { tone: 'error' });
    else {
      showToast('Password updated', { tone: 'success' });
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  /**
   * Export the user's data. Tries native share sheet via expo-sharing when
   * available (writes a file via expo-file-system first); otherwise opens a
   * scrollable modal where the JSON can be copied via expo-clipboard. All
   * three modules are loaded via dynamic require so a missing install doesn't
   * crash the screen — the modal fallback always works.
   */
  const handleExportData = async () => {
    setExporting(true);
    try {
      const data = await exportUserData();
      const json = userDataToJSON(data);

      // Try the native share-sheet path first.
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Sharing = require('expo-sharing');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const FileSystem = require('expo-file-system');
        if (
          Sharing &&
          FileSystem &&
          typeof Sharing.isAvailableAsync === 'function' &&
          typeof Sharing.shareAsync === 'function' &&
          typeof FileSystem.writeAsStringAsync === 'function' &&
          FileSystem.cacheDirectory
        ) {
          const available = await Sharing.isAvailableAsync();
          if (available) {
            const filename = `rankr-export-${Date.now()}.json`;
            const fileUri = `${FileSystem.cacheDirectory}${filename}`;
            await FileSystem.writeAsStringAsync(fileUri, json);
            await Sharing.shareAsync(fileUri, {
              mimeType: 'application/json',
              dialogTitle: 'Export Rankr data',
              UTI: 'public.json',
            });
            showToast('Export ready', { tone: 'success' });
            setExporting(false);
            return;
          }
        }
      } catch {
        // expo-sharing / expo-file-system not installed — fall through to modal.
      }

      // Fallback: show JSON in a modal with a copy-to-clipboard button.
      setExportJson(json);
      showToast('Export ready — review below', { tone: 'success' });
    } catch (err: any) {
      showToast(err?.message ?? 'Could not export data', { tone: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const handleCopyExport = async () => {
    if (!exportJson) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Clipboard = require('expo-clipboard');
      if (Clipboard && typeof Clipboard.setStringAsync === 'function') {
        await Clipboard.setStringAsync(exportJson);
        showToast('Copied to clipboard', { tone: 'success' });
        return;
      }
      throw new Error('Clipboard not available');
    } catch {
      showToast('Clipboard not available on this device', { tone: 'error' });
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.purpleLight} />
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

        {/* ---- Account section (Phase 5) ---- */}
        <View style={styles.accountSection}>
          <Text style={styles.accountHeader}>ACCOUNT</Text>

          <TouchableOpacity
            style={styles.accountRow}
            onPress={handleExportData}
            disabled={exporting}
            activeOpacity={0.75}
          >
            <View style={[styles.accountIcon, { backgroundColor: '#1e1a2e' }]}>
              <Ionicons name="cloud-download-outline" size={18} color={colors.purpleLight} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountTitle}>Export my data</Text>
              <Text style={styles.accountSub}>Download a JSON copy of everything</Text>
            </View>
            {exporting ? (
              <ActivityIndicator color={colors.purpleLight} />
            ) : (
              <Ionicons name="chevron-forward" size={18} color="#444" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.accountRow, styles.accountRowDestructive]}
            onPress={() => router.push('/profile-delete' as any)}
            activeOpacity={0.75}
          >
            <View style={[styles.accountIcon, { backgroundColor: '#2a1a1a' }]}>
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.accountTitle, styles.accountTitleDestructive]}>
                Delete account
              </Text>
              <Text style={styles.accountSub}>Permanently remove all your data</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#5a2020" />
          </TouchableOpacity>
        </View>

        {/* ---- Privacy section (Session 1) — blocked users ---- */}
        <View style={styles.accountSection}>
          <Text style={styles.accountHeader}>PRIVACY</Text>

          <TouchableOpacity
            style={styles.accountRow}
            onPress={() => router.push('/blocked-users' as any)}
            activeOpacity={0.75}
            accessibilityRole="link"
            accessibilityLabel="Blocked users"
          >
            <View style={[styles.accountIcon, { backgroundColor: '#1e1a2e' }]}>
              <Ionicons name="ban-outline" size={18} color={colors.purpleLight} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountTitle}>Blocked users</Text>
              <Text style={styles.accountSub}>Manage who's hidden from your feed</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#444" />
          </TouchableOpacity>
        </View>

        {/* ---- About section — feedback, legal, version ---- */}
        <View style={styles.accountSection}>
          <Text style={styles.accountHeader}>ABOUT</Text>

          <TouchableOpacity
            style={styles.accountRow}
            onPress={() => router.push('/feedback' as any)}
            activeOpacity={0.75}
            accessibilityRole="link"
            accessibilityLabel="Send feedback"
          >
            <View style={[styles.accountIcon, { backgroundColor: '#1e1a2e' }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.purpleLight} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountTitle}>Send feedback</Text>
              <Text style={styles.accountSub}>Tell us what to fix or build next</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#444" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.accountRow}
            onPress={() => router.push('/privacy' as any)}
            activeOpacity={0.75}
            accessibilityRole="link"
            accessibilityLabel="Privacy policy"
          >
            <View style={[styles.accountIcon, { backgroundColor: '#1e1a2e' }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.purpleLight} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountTitle}>Privacy Policy</Text>
              <Text style={styles.accountSub}>How we handle your data</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#444" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.accountRow}
            onPress={() => router.push('/terms' as any)}
            activeOpacity={0.75}
            accessibilityRole="link"
            accessibilityLabel="Terms of service"
          >
            <View style={[styles.accountIcon, { backgroundColor: '#1e1a2e' }]}>
              <Ionicons name="document-text-outline" size={18} color={colors.purpleLight} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountTitle}>Terms of Service</Text>
              <Text style={styles.accountSub}>Rules of the road</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#444" />
          </TouchableOpacity>

          <View style={styles.versionRow}>
            <Text style={styles.versionText}>
              Rankr v{APP_VERSION} ({APP_BUILD})
            </Text>
          </View>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Export-JSON modal — shown when share-sheet path falls through. */}
      <Modal
        visible={exportJson !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setExportJson(null)}
      >
        <View style={styles.exportModalContainer}>
          <View style={styles.exportModalHeader}>
            <Text style={styles.exportModalTitle}>Your data</Text>
            <TouchableOpacity
              onPress={() => setExportJson(null)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close export"
            >
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.exportModalScroll}
            contentContainerStyle={styles.exportModalContent}
          >
            <Text selectable style={styles.exportModalJson}>
              {exportJson ?? ''}
            </Text>
          </ScrollView>
          <View style={styles.exportModalActions}>
            <TouchableOpacity
              style={styles.exportCopyBtn}
              onPress={handleCopyExport}
              activeOpacity={0.8}
            >
              <Ionicons name="copy-outline" size={18} color="#fff" />
              <Text style={styles.exportCopyLabel}>Copy to clipboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 60, paddingBottom: 20,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatarWrapper: { position: 'relative', marginBottom: 8 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: colors.purple },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: colors.purple, justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: colors.purple,
  },
  avatarInitial: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.purple, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.bg,
  },
  avatarHint: { color: '#555', fontSize: 13 },
  sectionToggle: {
    flexDirection: 'row', marginHorizontal: 16,
    backgroundColor: colors.card, borderRadius: 12,
    padding: 4, marginBottom: 24, borderWidth: 1, borderColor: colors.border,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  toggleBtnActive: { backgroundColor: colors.purple },
  toggleText: { color: '#666', fontSize: 14, fontWeight: '600' },
  toggleTextActive: { color: '#fff' },
  form: { paddingHorizontal: 16, gap: 8 },
  fieldLabel: { color: '#888', fontSize: 13, fontWeight: '600', letterSpacing: 0.5, marginTop: 8 },
  fieldHint: { color: '#777', fontSize: 12, marginTop: 2, marginBottom: 4 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
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
    backgroundColor: colors.purple, borderRadius: 14,
    height: 52, justifyContent: 'center', alignItems: 'center',
    marginTop: 16,
    ...glow.purple,
    ...shadow.sm,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ---- Account section ----
  accountSection: { paddingHorizontal: 16, marginTop: 24, gap: 8 },
  accountHeader: {
    color: '#555', fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, marginBottom: 8,
  },
  accountRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  accountRowDestructive: { borderColor: '#3a2020' },
  accountIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  accountTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  accountTitleDestructive: { color: '#ef4444' },
  accountSub: { color: '#666', fontSize: 12 },
  versionRow: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  versionText: {
    color: colors.textMuted,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },

  // ---- Export-JSON modal ----
  exportModalContainer: { flex: 1, backgroundColor: colors.bg },
  exportModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  exportModalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  exportModalScroll: { flex: 1 },
  exportModalContent: { padding: 16 },
  exportModalJson: {
    color: '#aaa',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
  },
  exportModalActions: {
    padding: 16, borderTopWidth: 1, borderTopColor: colors.border,
  },
  exportCopyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.purple, borderRadius: 14, height: 48,
  },
  exportCopyLabel: { color: '#fff', fontSize: 15, fontWeight: '700' },
});