import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Avatar } from './Avatar';
import { colors, typography } from '@/lib/theme';

export interface WatchedWithUser {
  id: string;
  avatar_url: string | null;
  display_name: string | null;
  username: string | null;
}

export interface WatchedWithStackProps {
  users: WatchedWithUser[];
  maxVisible?: number;
  size?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Overlapping avatar stack summarising up to N users with a "+N" overflow chip. */
export function WatchedWithStack({
  users,
  maxVisible = 3,
  size = 28,
  onPress,
  style,
}: WatchedWithStackProps) {
  if (users.length === 0) return null;

  const visible = users.slice(0, maxVisible);
  const overflow = users.length - visible.length;
  const overlap = Math.round(size * 0.5);
  const ringWidth = 2;

  // Width = first avatar full size, each subsequent shows (size - overlap) px
  const totalSlots = visible.length + (overflow > 0 ? 1 : 0);
  const stackWidth = size + (totalSlots - 1) * (size - overlap);

  const stack = (
    <View style={[{ width: stackWidth, height: size + ringWidth * 2 }, styles.stack]}>
      {visible.map((u, idx) => {
        const name = u.display_name || u.username || '?';
        return (
          <View
            key={u.id}
            style={[
              styles.avatarWrap,
              {
                left: idx * (size - overlap),
                width: size + ringWidth * 2,
                height: size + ringWidth * 2,
                borderRadius: (size + ringWidth * 2) / 2,
                zIndex: visible.length - idx,
              },
            ]}
          >
            <Avatar uri={u.avatar_url} name={name} size={size} />
          </View>
        );
      })}
      {overflow > 0 ? (
        <View
          style={[
            styles.avatarWrap,
            styles.overflowChip,
            {
              left: visible.length * (size - overlap),
              width: size + ringWidth * 2,
              height: size + ringWidth * 2,
              borderRadius: (size + ringWidth * 2) / 2,
              zIndex: 0,
            },
          ]}
        >
          <View
            style={[
              styles.overflowInner,
              { width: size, height: size, borderRadius: size / 2 },
            ]}
          >
            <Text style={styles.overflowText}>+{overflow}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={style}>
        {stack}
      </TouchableOpacity>
    );
  }

  return <View style={style}>{stack}</View>;
}

const styles = StyleSheet.create({
  stack: {
    position: 'relative',
  },
  avatarWrap: {
    position: 'absolute',
    top: 0,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overflowChip: {
    backgroundColor: colors.bg,
  },
  overflowInner: {
    backgroundColor: colors.purpleSoft,
    borderWidth: 1,
    borderColor: colors.purple,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overflowText: {
    ...typography.caption,
    color: colors.purpleLight,
    fontWeight: '700',
  },
});
