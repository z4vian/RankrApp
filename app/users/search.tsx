/**
 * app/users/search.tsx
 * Find-friends user search. Debounced 300ms. Tap a row to open their profile.
 */

import { searchUsers, type PublicProfile } from '@/lib/profile';
import { EmptyState, LoadingState, UserRow } from '@/components';
import { colors, radius, spacing, typography } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function UserSearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const found = await searchUsers(trimmed, 20);
      setResults(found);
      setSearched(true);
      setLoading(false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find Friends</Text>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons
          name="search-outline"
          size={18}
          color={colors.textMuted}
          style={{ marginRight: spacing.sm }}
        />
        <TextInput
          style={styles.input}
          placeholder="Search by username or name"
          placeholderTextColor={colors.textPlaceholder}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {!query.trim() ? (
        <View style={styles.placeholderWrap}>
          <Ionicons
            name="people-outline"
            size={36}
            color={colors.purpleLight}
            style={{ marginBottom: spacing.md }}
          />
          <Text style={styles.placeholderText}>
            Search for friends by username or name
          </Text>
        </View>
      ) : loading ? (
        <LoadingState label="Searching…" />
      ) : results.length === 0 && searched ? (
        <EmptyState
          icon="search-outline"
          title="No users found"
          subtitle={`We couldn't find anyone matching "${query.trim()}"`}
        />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: spacing.xxxl }}
          keyboardShouldPersistTaps="handled"
        >
          {results.map((u) => (
            <UserRow
              key={u.id}
              avatarUri={u.avatar_url}
              displayName={u.display_name ?? u.username}
              username={u.username}
              bio={u.bio}
              onPress={() => router.push(`/profile/${u.username}` as any)}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  input: {
    flex: 1,
    color: colors.text,
    ...typography.body,
  },
  placeholderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  placeholderText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
