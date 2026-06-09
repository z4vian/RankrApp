import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { EmptyState } from './EmptyState';
import { UserRow } from './UserRow';
import { colors, radius, spacing, typography } from '@/lib/theme';

export interface TaggableUser {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export interface UserTagPickerProps {
  onSelectUser: (user: TaggableUser) => void;
  onClose: () => void;
  search: (query: string) => Promise<TaggableUser[]>;
  excludeUserIds?: string[];
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
}

const DEBOUNCE_MS = 300;

/** Inline searchable picker for tagging a user — debounces input and excludes provided IDs. */
export function UserTagPicker({
  onSelectUser,
  onClose,
  search,
  excludeUserIds = [],
  placeholder = 'Search users…',
  style,
}: UserTagPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TaggableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const excludeSet = useMemo(() => new Set(excludeUserIds), [excludeUserIds]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setTouched(true);
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const found = await search(trimmed);
        if (!cancelled) setResults(found);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, search]);

  const filtered = useMemo(
    () => results.filter(u => !excludeSet.has(u.id)),
    [results, excludeSet]
  );

  const showEmpty = touched && !loading && query.trim().length > 0 && filtered.length === 0;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <Ionicons name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={placeholder}
            placeholderTextColor={colors.textPlaceholder}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          {query.length > 0 ? (
            <TouchableOpacity
              onPress={() => setQuery('')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.7}
          hitSlop={12}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Close user picker"
        >
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.purpleLight} />
        </View>
      ) : showEmpty ? (
        <EmptyState
          icon="person-outline"
          title="No users found"
          subtitle="Try a different name or username."
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(u) => u.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <UserRow
              avatarUri={item.avatar_url}
              displayName={item.display_name || item.username || 'user'}
              username={item.username || ''}
              onPress={() => onSelectUser(item)}
            />
          )}
          ListEmptyComponent={
            !touched ? (
              <Text style={styles.hint}>Start typing to search for users.</Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: 0,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingWrap: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  hint: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
});
