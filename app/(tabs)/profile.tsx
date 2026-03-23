import { supabase } from '@/lib/supabase';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Image, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

const PURPLE = '#7C3AED';
const PURPLE_LIGHT = '#A78BFA';
const BG = '#0f0f13';
const CARD = '#1a1a24';
const BORDER = '#2a2a38';

type ProfileStats = {
  totalLists: number;
  totalItems: number;
  rankedItems: number;
  avgScore: number | null;
  likedCount: number;
  didntCareCount: number;
  didntLikeCount: number;
  topList: { title: string; category: string; count: number } | null;
};

type Profile = {
  display_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
};

const scoreColor = (score: number) => {
  if (score >= 8) return '#22c55e';
  if (score >= 6) return '#eab308';
  if (score >= 4) return '#f97316';
  return '#ef4444';
};

export default function ProfileScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setEmail(user?.email ?? '');

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user?.id)
      .single();
    setProfile(profileData);

    const { data: lists } = await supabase
      .from('lists')
      .select('id, title, category');

    if (!lists) { setLoading(false); return; }

    const { data: items } = await supabase
      .from('list_items')
      .select('rank, sentiment, list_id');

    const allItems = items ?? [];
    const ranked = allItems.filter(i => i.rank !== null);
    const avgScore = ranked.length > 0
      ? ranked.reduce((sum, i) => sum + (i.rank ?? 0), 0) / ranked.length
      : null;

    const listCounts = lists.map(l => ({
      ...l,
      count: allItems.filter(i => i.list_id === l.id).length,
    })).sort((a, b) => b.count - a.count);

    setStats({
      totalLists: lists.length,
      totalItems: allItems.length,
      rankedItems: ranked.length,
      avgScore: avgScore ? parseFloat(avgScore.toFixed(1)) : null,
      likedCount: allItems.filter(i => i.sentiment === 'liked').length,
      didntCareCount: allItems.filter(i => i.sentiment === 'didnt_care').length,
      didntLikeCount: allItems.filter(i => i.sentiment === 'didnt_like').length,
      topList: listCounts[0] ?? null,
    });
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchProfile(); }, []));

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const displayName = profile?.display_name || profile?.username || email.split('@')[0];
  const username = profile?.username || email.split('@')[0];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile-settings' as any)}
            style={styles.iconBtn}
          >
            <Ionicons name="settings-outline" size={20} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSignOut} style={styles.iconBtn}>
            <Ionicons name="log-out-outline" size={20} color="#888" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={PURPLE_LIGHT} style={{ marginTop: 60 }} />
      ) : (
        <>
          <View style={styles.avatarSection}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.displayName}>{displayName}</Text>
            <Text style={styles.username}>@{username}</Text>
            {profile?.bio ? (
              <Text style={styles.bio}>{profile.bio}</Text>
            ) : null}
            <TouchableOpacity
              style={styles.editProfileBtn}
              onPress={() => router.push('/(tabs)/profile-settings' as any)}
            >
              <Text style={styles.editProfileText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats?.totalLists ?? 0}</Text>
              <Text style={styles.statLabel}>Lists</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats?.totalItems ?? 0}</Text>
              <Text style={styles.statLabel}>Items</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[
                styles.statValue,
                stats?.avgScore ? { color: scoreColor(stats.avgScore) } : {}
              ]}>
                {stats?.avgScore ?? '—'}
              </Text>
              <Text style={styles.statLabel}>Avg Score</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>YOUR TASTE</Text>
            <View style={styles.sentimentRow}>
              <View style={[styles.sentimentBox, { borderColor: '#22c55e' }]}>
                <Text style={styles.sentimentEmoji}>👍</Text>
                <Text style={[styles.sentimentCount, { color: '#22c55e' }]}>
                  {stats?.likedCount ?? 0}
                </Text>
                <Text style={styles.sentimentLabel}>Liked</Text>
              </View>
              <View style={[styles.sentimentBox, { borderColor: '#9e9e9e' }]}>
                <Text style={styles.sentimentEmoji}>😐</Text>
                <Text style={[styles.sentimentCount, { color: '#9e9e9e' }]}>
                  {stats?.didntCareCount ?? 0}
                </Text>
                <Text style={styles.sentimentLabel}>Meh</Text>
              </View>
              <View style={[styles.sentimentBox, { borderColor: '#ef4444' }]}>
                <Text style={styles.sentimentEmoji}>👎</Text>
                <Text style={[styles.sentimentCount, { color: '#ef4444' }]}>
                  {stats?.didntLikeCount ?? 0}
                </Text>
                <Text style={styles.sentimentLabel}>Disliked</Text>
              </View>
            </View>
          </View>

          {stats?.topList && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>MOST ACTIVE LIST</Text>
              <View style={styles.topListCard}>
                <View style={styles.topListIcon}>
                  <Ionicons
                    name={
                      stats.topList.category === 'movies' ? 'film' :
                      stats.topList.category === 'music' ? 'musical-notes' :
                      'game-controller'
                    }
                    size={24}
                    color={PURPLE_LIGHT}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.topListTitle}>{stats.topList.title}</Text>
                  <Text style={styles.topListMeta}>
                    {stats.topList.count} items · {stats.topList.category}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#444" />
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>RANKING PROGRESS</Text>
            <View style={styles.progressCard}>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>Items Ranked</Text>
                <Text style={styles.progressValue}>
                  {stats?.rankedItems ?? 0} / {stats?.totalItems ?? 0}
                </Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[
                  styles.progressBarFill,
                  {
                    width: stats?.totalItems
                      ? `${((stats.rankedItems ?? 0) / stats.totalItems) * 100}%` as any
                      : '0%'
                  }
                ]} />
              </View>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20,
  },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: CARD, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: BORDER,
  },
  avatarSection: { alignItems: 'center', paddingBottom: 24 },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: PURPLE, justifyContent: 'center', alignItems: 'center',
    marginBottom: 12, borderWidth: 3, borderColor: PURPLE,
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12,
  },
  avatarText: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
  displayName: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  username: { color: '#666', fontSize: 14, marginBottom: 8 },
  bio: { color: '#888', fontSize: 14, textAlign: 'center', paddingHorizontal: 32, marginBottom: 12, lineHeight: 20 },
  editProfileBtn: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 8, marginTop: 4,
  },
  editProfileText: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row', backgroundColor: CARD,
    marginHorizontal: 16, borderRadius: 16,
    padding: 20, borderWidth: 1, borderColor: BORDER, marginBottom: 24,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  statLabel: { color: '#666', fontSize: 11, marginTop: 3 },
  statDivider: { width: 1, backgroundColor: BORDER },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { color: '#555', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 12 },
  sentimentRow: { flexDirection: 'row', gap: 10 },
  sentimentBox: {
    flex: 1, backgroundColor: CARD, borderRadius: 14,
    padding: 14, alignItems: 'center', borderWidth: 1.5,
  },
  sentimentEmoji: { fontSize: 24, marginBottom: 6 },
  sentimentCount: { fontSize: 22, fontWeight: 'bold', marginBottom: 2 },
  sentimentLabel: { color: '#666', fontSize: 12 },
  topListCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD, borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: BORDER, gap: 12,
  },
  topListIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#1e1a2e', justifyContent: 'center', alignItems: 'center',
  },
  topListTitle: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  topListMeta: { color: '#666', fontSize: 13, textTransform: 'capitalize' },
  progressCard: { backgroundColor: CARD, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: BORDER },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressLabel: { color: '#888', fontSize: 14 },
  progressValue: { color: PURPLE_LIGHT, fontSize: 14, fontWeight: '600' },
  progressBarBg: { height: 6, backgroundColor: '#2a2a38', borderRadius: 3 },
  progressBarFill: { height: 6, backgroundColor: PURPLE, borderRadius: 3 },
});