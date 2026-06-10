import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Button } from './Button';
import { colors, radius, spacing, typography } from '@/lib/theme';

export type FeedbackCategory = 'bug' | 'feature' | 'question' | 'other';

export interface FeedbackFormSubmitInput {
  body: string;
  category: FeedbackCategory;
  errorContext?: unknown;
}

export interface FeedbackFormProps {
  defaultCategory?: FeedbackCategory;
  errorContext?: unknown;
  onSubmit: (input: FeedbackFormSubmitInput) => Promise<void>;
  onCancel?: () => void;
  style?: StyleProp<ViewStyle>;
}

const MAX_LENGTH = 2000;
const COUNTER_THRESHOLD = 200;

const CATEGORIES: { key: FeedbackCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'bug', label: 'Bug', icon: 'bug-outline' },
  { key: 'feature', label: 'Feature', icon: 'sparkles-outline' },
  { key: 'question', label: 'Question', icon: 'help-circle-outline' },
  { key: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
];

/** Form for collecting user feedback — segmented category, body, optional error-context preview, async submit. */
export function FeedbackForm({
  defaultCategory,
  errorContext,
  onSubmit,
  onCancel,
  style,
}: FeedbackFormProps) {
  const [category, setCategory] = useState<FeedbackCategory>(
    defaultCategory ?? (errorContext !== undefined ? 'bug' : 'other')
  );
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [techExpanded, setTechExpanded] = useState(false);

  const trimmed = body.trim();
  const overLimit = body.length > MAX_LENGTH;
  const remaining = MAX_LENGTH - body.length;
  const showCounter = remaining <= COUNTER_THRESHOLD;
  const counterColor =
    remaining < 0
      ? colors.error
      : remaining <= 50
      ? colors.attention
      : colors.textMuted;

  const canSubmit = trimmed.length > 0 && !overLimit && !submitting;

  const techPreview = useMemo(() => {
    if (errorContext === undefined) return null;
    try {
      return JSON.stringify(
        errorContext,
        (_k, v) => (v instanceof Error ? { name: v.name, message: v.message, stack: v.stack } : v),
        2
      );
    } catch {
      return String(errorContext);
    }
  }, [errorContext]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({ body: trimmed, category, errorContext });
      setBody('');
    } catch (err: any) {
      Alert.alert('Could not send', err?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const heading = errorContext !== undefined ? 'Report a bug' : 'Send feedback';

  return (
    <ScrollView
      style={[styles.scroll, style]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.heading}>{heading}</Text>

      <View style={styles.categoryRow}>
        {CATEGORIES.map(opt => {
          const active = opt.key === category;
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setCategory(opt.key)}
              activeOpacity={0.7}
              style={[styles.catPill, active && styles.catPillActive]}
            >
              <Ionicons
                name={opt.icon}
                size={14}
                color={active ? colors.purpleLight : colors.textSecondary}
                style={styles.catIcon}
              />
              <Text style={[styles.catLabel, active && styles.catLabelActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.bodyWrap}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="What happened? What did you expect?"
          placeholderTextColor={colors.textPlaceholder}
          multiline
          editable={!submitting}
          style={styles.input}
          textAlignVertical="top"
          maxLength={MAX_LENGTH + 200}
        />
        {showCounter ? (
          <Text style={[styles.counter, { color: counterColor }]}>
            {body.length}/{MAX_LENGTH}
          </Text>
        ) : null}
      </View>

      {techPreview ? (
        <View style={styles.techSection}>
          <TouchableOpacity
            onPress={() => setTechExpanded(v => !v)}
            activeOpacity={0.7}
            style={styles.techHeader}
          >
            <Ionicons
              name={techExpanded ? 'chevron-down' : 'chevron-forward'}
              size={14}
              color={colors.textSecondary}
            />
            <Text style={styles.techHeading}>Technical details</Text>
            <Text style={styles.techHint}>
              (included automatically — tap to {techExpanded ? 'hide' : 'view'})
            </Text>
          </TouchableOpacity>
          {techExpanded ? (
            <ScrollView
              style={styles.techScroll}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              <Text style={styles.techCode} selectable>
                {techPreview}
              </Text>
            </ScrollView>
          ) : null}
        </View>
      ) : null}

      <View style={styles.footer}>
        {onCancel ? (
          <Button
            label="Cancel"
            variant="ghost"
            onPress={onCancel}
            disabled={submitting}
            style={styles.footerBtn}
          />
        ) : null}
        <Button
          label="Send"
          variant="primary"
          onPress={handleSubmit}
          loading={submitting}
          disabled={!canSubmit}
          icon="paper-plane-outline"
          style={styles.footerBtn}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  heading: {
    ...typography.h2,
    color: colors.text,
  },
  categoryRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    alignSelf: 'flex-start',
    flexWrap: 'wrap',
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
  },
  catPillActive: {
    backgroundColor: colors.purpleSoft,
  },
  catIcon: {
    marginRight: spacing.xs + 2,
  },
  catLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  catLabelActive: {
    color: colors.text,
  },
  bodyWrap: {
    position: 'relative',
  },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    paddingBottom: spacing.lg + spacing.sm,
    minHeight: 120,
  },
  counter: {
    ...typography.caption,
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.md,
    fontVariant: ['tabular-nums'],
  },
  techSection: {
    backgroundColor: colors.bgDeeper,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  techHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  techHeading: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  techHint: {
    ...typography.caption,
    color: colors.textMuted,
    flexShrink: 1,
  },
  techScroll: {
    marginTop: spacing.sm,
    maxHeight: 160,
  },
  techCode: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: 'Menlo',
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  footerBtn: {
    flex: 1,
  },
});
