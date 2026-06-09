import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { ListItemPreviewCard } from './ListItemPreviewCard';
import { Visibility, VisibilitySelector } from './VisibilitySelector';
import { colors, radius, shadow, spacing, typography } from '@/lib/theme';

export interface ComposePostAttachedItem {
  title: string;
  subtitle: string | null;
  image_url: string | null;
  category: string;
  rank?: number | null;
}

export interface ComposePostInputProps {
  onSubmit: (body: string) => Promise<void>;
  visibility: Visibility;
  onVisibilityChange: (v: Visibility) => void;
  attachedItem?: ComposePostAttachedItem | null;
  onClearAttachment?: () => void;
  maxLength?: number;
  placeholder?: string;
  /** Initial body — used to restore drafts. Applied once on mount. */
  initialBody?: string;
  /** Fired whenever the body changes. Parent can use this to autosave drafts. */
  onBodyChange?: (body: string) => void;
  style?: StyleProp<ViewStyle>;
}

/** Twitter-style compose card — multiline input, optional attached item, visibility selector, post button. */
export function ComposePostInput({
  onSubmit,
  visibility,
  onVisibilityChange,
  attachedItem,
  onClearAttachment,
  maxLength = 1000,
  placeholder = "What's on your mind?",
  initialBody = '',
  onBodyChange,
  style,
}: ComposePostInputProps) {
  const [value, setValue] = useState(initialBody);
  const [submitting, setSubmitting] = useState(false);

  // Hydrate from initialBody on mount and whenever it changes from empty to
  // a saved draft (the parent loads asynchronously).
  useEffect(() => {
    if (initialBody && !value) {
      setValue(initialBody);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBody]);

  const updateValue = (next: string) => {
    setValue(next);
    onBodyChange?.(next);
  };

  const trimmed = value.trim();
  const length = value.length;
  const overLimit = length > maxLength;
  const nearLimit = !overLimit && length > maxLength - 50;
  const canSubmit = trimmed.length > 0 && !overLimit && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      updateValue('');
      onVisibilityChange('private');
    } catch (err: any) {
      Alert.alert('Could not post', err?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const counterColor = overLimit
    ? colors.error
    : nearLimit
    ? colors.attention
    : colors.textMuted;

  return (
    <View style={[styles.container, style]}>
      <TextInput
        value={value}
        onChangeText={updateValue}
        placeholder={placeholder}
        placeholderTextColor={colors.textPlaceholder}
        multiline
        editable={!submitting}
        style={styles.input}
        textAlignVertical="top"
        accessibilityLabel="Post body"
      />

      {attachedItem ? (
        <View style={styles.attachmentWrap}>
          <ListItemPreviewCard
            title={attachedItem.title}
            subtitle={attachedItem.subtitle}
            image_url={attachedItem.image_url}
            category={attachedItem.category}
            rank={attachedItem.rank ?? null}
          />
          {onClearAttachment ? (
            <TouchableOpacity
              onPress={onClearAttachment}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.clearAttachmentBtn}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Remove attached item"
            >
              <Ionicons name="close" size={14} color={colors.text} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <View style={styles.footer}>
        <VisibilitySelector
          value={visibility}
          onChange={onVisibilityChange}
        />

        <View style={styles.footerRight}>
          <Text style={[styles.counter, { color: counterColor }]}>
            {length}/{maxLength}
          </Text>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.75}
            style={[
              styles.postBtn,
              canSubmit && shadow.sm,
              !canSubmit && styles.postBtnDisabled,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Text style={styles.postBtnLabel}>Post</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  input: {
    ...typography.body,
    color: colors.text,
    minHeight: 88,
    padding: 0,
  },
  attachmentWrap: {
    position: 'relative',
  },
  clearAttachmentBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  counter: {
    ...typography.caption,
    fontVariant: ['tabular-nums'],
  },
  postBtn: {
    backgroundColor: colors.purple,
    paddingHorizontal: spacing.lg,
    height: 36,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 72,
  },
  postBtnDisabled: {
    opacity: 0.45,
  },
  postBtnLabel: {
    ...typography.bodyBold,
    color: colors.text,
  },
});
