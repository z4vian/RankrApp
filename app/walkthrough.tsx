import { BrandWordmark } from '@/components/BrandWordmark';
import { Button } from '@/components/Button';
import { markOnboardingComplete } from '@/lib/onboarding';
import { colors } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Step = { title: string; body: string; icon: React.ComponentProps<typeof Ionicons>['name']; examples: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; detail: string }[] };
const steps: Step[] = [
  { title: 'Give your favorites a home.', body: 'Create a list for movies, TV shows, games, music, or books. Add a title you love, then keep going whenever something stays with you.', icon: 'list-outline', examples: [
    { icon: 'add-outline', title: 'Create a list', detail: 'Open Lists, choose New, and give it a name.' },
    { icon: 'search-outline', title: 'Find a favorite', detail: 'Add titles to your list and build a collection that feels like you.' },
  ] },
  { title: 'Make the list yours.', body: 'Add 10 favorites to unlock numeric scores. You can order and save a smaller list now, then compare titles as your taste changes.', icon: 'swap-vertical-outline', examples: [
    { icon: 'create-outline', title: 'Remember why it matters', detail: 'Open an item to add your thoughts and memories.' },
    { icon: 'swap-vertical-outline', title: 'Revisit your order', detail: 'Compare favorites to refine where they belong in your ranking.' },
  ] },
  { title: 'Choose what you share.', body: 'Check a list’s visibility before sharing it. Keep personal lists private, and make a list public when you want others to discover it.', icon: 'lock-closed-outline', examples: [
    { icon: 'lock-closed-outline', title: 'Private', detail: 'A list for your own collection.' },
    { icon: 'globe-outline', title: 'Public', detail: 'A list other people on Rankr can discover.' },
  ] },
  { title: 'Find your next favorite.', body: 'Follow people whose taste you enjoy. Their posts and rankings appear in your feed, and their public lists give you somewhere new to start.', icon: 'people-outline', examples: [
    { icon: 'people-outline', title: 'Find people', detail: 'Search for a friend or explore suggestions in your feed.' },
    { icon: 'star-outline', title: 'Explore For You', detail: 'Visit recommendations when you’re ready for something new.' },
  ] },
];

export default function Walkthrough() {
  const router = useRouter();
  const params = useLocalSearchParams<{ variant?: string; replay?: string; listId?: string }>();
  const tour = params.variant === 'short' ? steps.slice(1) : steps;
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const step = tour[Math.min(index, tour.length - 1)];
  const complete = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (params.replay !== '1') await markOnboardingComplete();
      if (params.listId) router.replace({ pathname: '/(tabs)/lists/[id]', params: { id: params.listId } } as any);
      else router.replace('/(tabs)/lists' as any);
    } catch { setError('Could not finish the introduction. Please check your connection and try again.'); }
    finally { setBusy(false); }
  };
  return <ScrollView style={styles.screen} contentContainerStyle={styles.page}>
    <View style={styles.nav}><BrandWordmark /><Pressable accessibilityRole="button" disabled={busy} accessibilityLabel="Skip introduction" onPress={() => { void complete(); }} style={styles.skip}><Text style={styles.link}>Skip introduction</Text></Pressable></View>
    <View style={styles.content}>
      <View accessibilityRole="progressbar" accessibilityLabel="Introduction progress" accessibilityValue={{ min: 1, max: tour.length, now: index + 1, text: `Step ${index + 1} of ${tour.length}` }} style={styles.progress}>{tour.map((_, i) => <View key={i} style={[styles.progressSegment, i <= index && styles.progressActive]} />)}</View>
      <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.title}>{step.title}</Text>
      <Text style={styles.body}>{step.body}</Text>
      <View style={styles.examples}>{step.examples.map(example => <View key={example.title} style={styles.example}><View style={styles.icon}><Ionicons name={example.icon} size={24} color={colors.purpleLight} /></View><View style={styles.exampleContent}><Text style={styles.exampleTitle}>{example.title}</Text><Text style={styles.exampleBody}>{example.detail}</Text></View></View>)}</View>
      {params.variant !== 'short' && index === 0 ? <Button label="Build my first list" icon="add-outline" onPress={() => router.push('/try' as any)} style={{ marginTop: 24 }} /> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        {index > 0 ? <Button variant="secondary" label="Back" disabled={busy} onPress={() => setIndex(i => i - 1)} style={{ minWidth: 96 }} /> : null}
        <Button variant={params.variant !== 'short' && index === 0 ? 'secondary' : 'primary'} label={index === tour.length - 1 ? params.listId ? 'Go to my list' : 'Go to my lists' : 'Next'} onPress={() => { if (index === tour.length - 1) void complete(); else setIndex(i => i + 1); }} loading={busy} icon={index === tour.length - 1 ? 'checkmark-outline' : 'arrow-forward'} style={{ flex: 1 }} />
      </View>
      <Text style={styles.stepCount}>{index + 1} of {tour.length} · You can replay this introduction in Settings.</Text>
    </View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, page: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 24, paddingBottom: 48 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 88, gap: 16, flexWrap: 'wrap' }, skip: { minHeight: 44, justifyContent: 'center' }, link: { color: colors.purpleLight, fontSize: 14, fontWeight: '600' },
  content: { maxWidth: 600, width: '100%', alignSelf: 'center', paddingTop: 40 }, progress: { flexDirection: 'row', gap: 8, marginBottom: 32 }, progressSegment: { flex: 1, height: 3, backgroundColor: colors.border, borderRadius: 2 }, progressActive: { backgroundColor: colors.purpleLight },
  title: { fontSize: 32, lineHeight: 39, fontWeight: '800', letterSpacing: -0.8, color: colors.text }, body: { color: colors.textMuted, fontSize: 16, lineHeight: 26, marginTop: 16 },
  examples: { marginTop: 28, borderTopWidth: 1, borderTopColor: colors.border }, example: { flexDirection: 'row', gap: 20, paddingVertical: 24, borderBottomWidth: 1, borderBottomColor: colors.border }, icon: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center' }, exampleContent: { flex: 1 }, exampleTitle: { color: colors.text, fontSize: 16, lineHeight: 24, fontWeight: '600' }, exampleBody: { color: colors.textMuted, fontSize: 14, lineHeight: 23, marginTop: 5 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 36 }, stepCount: { color: colors.textMuted, fontSize: 13, lineHeight: 22, textAlign: 'center', marginTop: 20 }, error: { color: '#ff8585', fontSize: 14, lineHeight: 22, marginTop: 20 },
});
