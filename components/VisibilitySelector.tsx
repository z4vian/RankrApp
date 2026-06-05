import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing, typography } from '@/lib/theme';

export type Visibility = 'private' | 'followers' | 'public';

export interface VisibilitySelectorProps {
  value: Visibility;
  onChange: (v: Visibility) => void;
  style?: StyleProp<ViewStyle>;
}

const OPTIONS: { key: Visibility; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { key: 'private', icon: 'lock-closed', label: 'Private' },
  { key: 'followers', icon: 'people', label: 'Followers' },
  { key: 'public', icon: 'globe-outline', label: 'Public' },
];

/** Three-pill segmented control for post visibility (private / followers / public). */
export function VisibilitySelector({ value, onChange, style }: VisibilitySelectorProps) {
  return (
    <View style={[styles.container, style]}>
      {OPTIONS.map(opt => {
        const active = opt.key === value;
        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => onChange(opt.key)}
            activeOpacity={0.7}
            style={[styles.pill, active && styles.pillActive]}
          >
            <Ionicons
              name={opt.icon}
              size={14}
              color={active ? colors.purpleLight : colors.textSecondary}
              style={styles.icon}
            />
            <Text style={[styles.label, active && styles.labelActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    alignSelf: 'flex-start',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
  },
  pillActive: {
    backgroundColor: colors.purpleSoft,
  },
  icon: {
    marginRight: spacing.xs + 2,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  labelActive: {
    color: colors.text,
  },
});
