import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleProp,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing, typography } from '@/lib/theme';

export interface CommentInputProps {
  onSubmit: (body: string) => Promise<void>;
  placeholder?: string;
  maxLength?: number;
  style?: StyleProp<ViewStyle>;
}

const LINE_HEIGHT = 22;
const MAX_LINES = 4;

/** Bottom-of-thread comment composer with multiline input, send button, and async submit. */
export function CommentInput({
  onSubmit,
  placeholder = 'Add a comment…',
  maxLength = 500,
  style,
}: CommentInputProps) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !submitting;

  const handleSend = async () => {
    if (!canSend) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setValue('');
    } catch (err: any) {
      Alert.alert('Could not post comment', err?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.kav, style]}
    >
      <View style={styles.container}>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder={placeholder}
          placeholderTextColor={colors.textPlaceholder}
          multiline
          maxLength={maxLength}
          editable={!submitting}
          style={[
            styles.input,
            { maxHeight: LINE_HEIGHT * MAX_LINES + spacing.md * 2 },
          ]}
        />
        {trimmed.length > 0 ? (
          <TouchableOpacity
            onPress={handleSend}
            disabled={!canSend}
            activeOpacity={0.7}
            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Ionicons name="send" size={16} color={colors.text} />
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: {
    width: '100%',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm + 2,
    minHeight: 40,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.purple,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
});
