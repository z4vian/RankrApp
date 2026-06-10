import Ionicons from '@expo/vector-icons/Ionicons';
import React, { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '@/lib/theme';

export interface ActionMenuItem {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export interface ActionMenuProps {
  trigger?: ReactNode;
  items: ActionMenuItem[];
  style?: StyleProp<ViewStyle>;
}

const CLOSE_DELAY_MS = 100;
const FADE_MS = 180;

/** Overflow menu trigger that opens a bottom-sheet of actions; destructive items render in red. */
export function ActionMenu({ trigger, items, style }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslate = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: FADE_MS,
          useNativeDriver: true,
        }),
        Animated.spring(sheetTranslate, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 6,
          speed: 14,
        }),
      ]).start();
    } else {
      backdropOpacity.setValue(0);
      sheetTranslate.setValue(40);
    }
  }, [open, backdropOpacity, sheetTranslate]);

  const close = useCallback(() => setOpen(false), []);

  const handleItem = useCallback(
    (item: ActionMenuItem) => {
      if (item.disabled) return;
      setOpen(false);
      setTimeout(() => item.onPress(), CLOSE_DELAY_MS);
    },
    []
  );

  return (
    <View style={style}>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {trigger ?? (
          <View style={styles.defaultTrigger}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={close}
        statusBarTranslucent
      >
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        </Animated.View>

        <View style={styles.sheetWrap} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.sheet,
              {
                paddingBottom: Math.max(insets.bottom, spacing.md),
                transform: [{ translateY: sheetTranslate }],
              },
            ]}
          >
            <View style={styles.grabber} />

            {items.map((item, idx) => (
              <TouchableOpacity
                key={`${item.label}-${idx}`}
                onPress={() => handleItem(item)}
                disabled={item.disabled}
                activeOpacity={0.7}
                style={[
                  styles.row,
                  item.destructive && styles.rowDestructive,
                  item.disabled && styles.rowDisabled,
                ]}
              >
                {item.icon ? (
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={item.destructive ? colors.error : colors.text}
                    style={styles.rowIcon}
                  />
                ) : (
                  <View style={styles.rowIcon} />
                )}
                <Text
                  style={[
                    styles.rowLabel,
                    item.destructive && styles.rowLabelDestructive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={close}
              activeOpacity={0.7}
              style={styles.cancelRow}
            >
              <Text style={styles.cancelLabel}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  defaultTrigger: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  rowDestructive: {
    backgroundColor: colors.errorBg,
  },
  rowDisabled: {
    opacity: 0.4,
  },
  rowIcon: {
    width: 24,
    marginRight: spacing.md,
    textAlign: 'center',
  },
  rowLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  rowLabelDestructive: {
    color: colors.error,
    fontWeight: '600',
  },
  cancelRow: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  cancelLabel: {
    ...typography.bodyBold,
    color: colors.textSecondary,
  },
});
