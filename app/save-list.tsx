import { BrandWordmark } from '@/components/BrandWordmark';
import { Button } from '@/components/Button';
import { clearGuestDraft, getGuestDraft, type GuestDraft } from '@/lib/guestDraft';
import { importGuestDraft } from '@/lib/guestImport';
import { supabase } from '@/lib/supabase';
import { useActiveList } from '@/lib/ListContext';
import { colors } from '@/lib/theme';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function SaveList() {
  const router = useRouter();
  const { setActiveList } = useActiveList();
  const [draft, setDraft] = useState<GuestDraft | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setDraft(getGuestDraft()); setReady(true); }, []);
  const save = async () => {
    if (!draft?.items.length || busy) return;
    setBusy(true); setError('');
    try {
      const list = await importGuestDraft(draft);
      setActiveList(list);
      clearGuestDraft();
      router.replace({ pathname: '/walkthrough' as any, params: { variant: 'short', listId: list.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your list. Your device draft is still here; try again.');
    } finally { setBusy(false); }
  };
  const explore = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError || !data.user) throw new Error('Authentication required');
      const lists = await supabase.from('lists').select('id').eq('user_id', data.user.id).limit(1);
      if (lists.error) throw lists.error;
      router.replace(`/walkthrough?variant=${lists.data?.length ? 'short' : 'full'}` as any);
    } catch {
      setError('Could not check your lists. Your device draft is still here; try again.');
    } finally { setBusy(false); }
  };
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <BrandWordmark />
    <Text accessibilityRole="header" style={styles.title}>{draft?.items.length ? 'Make it yours, for keeps.' : 'Start with something you love.'}</Text>
    <Text style={styles.body}>{draft?.items.length ? 'Save your starter list to this account. It starts private, so you can decide what to share later.' : ready ? 'There is no starter list on this device. Create one, or explore the app.' : 'Loading your device draft…'}</Text>
    {draft?.items.length ? <View style={styles.preview}>
      <Text accessibilityRole="header" style={styles.name}>{draft.title}</Text>
      {draft.items.map((item, i) => <View key={item.id} style={styles.row}><Text style={styles.rank}>{i + 1}</Text><Text style={styles.item}>{item.title}</Text></View>)}
      <Text style={styles.body}>Private · {draft.items.length} {draft.items.length === 1 ? 'favorite' : 'favorites'}</Text>
    </View> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {draft?.items.length ? <><Button label="Save my list privately" onPress={save} loading={busy} disabled={busy} />
      <Button label="Edit my starter list" variant="ghost" disabled={busy} onPress={() => router.replace('/try' as any)} />
      <Button label="Keep the device draft and explore" variant="ghost" disabled={busy} onPress={() => { void explore(); }} /></>
      : ready ? <><Button label="Create a starter list" onPress={() => router.replace('/try' as any)} /><Button label="Explore Rankr" variant="ghost" onPress={() => router.replace('/walkthrough?variant=full' as any)} /></> : null}
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: { width: '100%', maxWidth: 650, alignSelf: 'center', padding: 24, paddingVertical: 48, gap: 22 },
  title: { color: colors.text, fontSize: 34, lineHeight: 40, fontWeight: '800', marginTop: 20 },
  body: { color: colors.textSecondary, fontSize: 16, lineHeight: 25 },
  preview: { paddingVertical: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, gap: 18 },
  name: { color: colors.text, fontSize: 22, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  rank: { color: colors.purpleLight, fontSize: 16, minWidth: 24 },
  item: { color: colors.text, fontSize: 17, flex: 1 },
  error: { color: '#ff8585', fontSize: 16, lineHeight: 24 },
});
