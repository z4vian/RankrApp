import { useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { ConsentCheck } from '@/components/ConsentCheck';
import { Button } from '@/components/Button';
import { LEGAL_VERSION } from '@/lib/legal';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
export default function ConsentScreen() {
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const save = async () => {
    if (!accepted || busy) return;
    setBusy(true); setError('');
    try {
      const { error } = await supabase.auth.updateUser({ data: { terms_version: LEGAL_VERSION, privacy_version: LEGAL_VERSION, terms_accepted_at: new Date().toISOString() } });
      if (error) throw error;
      router.replace('/(tabs)');
    } catch { setError('Could not save your agreement. Please try again.'); }
    finally { setBusy(false); }
  };
  return <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'center' }}>
    <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center', gap: 20 }}>
      <Text accessibilityRole="header" style={{ fontSize: 30, color: colors.text }}>Before you start ranking</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 16, lineHeight: 25 }}>Review how Rankr works and handles your information. This agreement does not enable marketing or optional tracking.</Text>
      <Link href="/terms" style={{ color: colors.purpleLight, paddingVertical: 10 }}>Terms & Conditions</Link>
      <Link href="/privacy" style={{ color: colors.purpleLight, paddingVertical: 10 }}>Privacy Policy</Link>
      <ConsentCheck checked={accepted} onChange={setAccepted} label="I am at least 13, agree to the Terms & Conditions, and acknowledge the Privacy Policy. If required, I have a parent or guardian’s permission." />
      {error ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text> : null}
      <Button label="Continue" onPress={save} disabled={!accepted || busy} loading={busy} />
      <Button label="Sign out" variant="ghost" onPress={() => { void supabase.auth.signOut().catch(() => setError('Could not sign out. Please try again.')); }} />
    </View>
  </ScrollView>;
}
