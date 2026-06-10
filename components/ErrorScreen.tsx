import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { colors, radius, spacing, typography } from '@/lib/theme';

export interface ErrorScreenProps {
  error: Error;
  onRetry: () => void;
  onSendFeedback: () => void;
  onGoHome?: () => void;
}

/** Friendly full-screen fallback for top-level render errors — offers Send / Retry / Go home actions. */
export function ErrorScreen({
  error,
  onRetry,
  onSendFeedback,
  onGoHome,
}: ErrorScreenProps) {
  const message = error?.message ?? 'Unknown error';

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.iconWrap}>
        <Ionicons name="bug-outline" size={40} color={colors.error} />
      </View>

      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.body}>
        Sorry — something unexpected happened. We&apos;ve logged it, but a quick note
        from you would really help us fix it faster.
      </Text>

      <View style={styles.actions}>
        <Button
          label="Send a report"
          variant="primary"
          onPress={onSendFeedback}
          icon="paper-plane-outline"
        />
        <Button
          label="Try again"
          variant="secondary"
          onPress={onRetry}
          icon="refresh-outline"
        />
        {onGoHome ? (
          <Button
            label="Go home"
            variant="ghost"
            onPress={onGoHome}
            icon="home-outline"
          />
        ) : null}
      </View>

      <Text style={styles.errorMessage} numberOfLines={1}>
        {message}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    padding: spacing.xl,
    paddingTop: spacing.xxxl + spacing.xl,
    alignItems: 'center',
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    maxWidth: 360,
  },
  actions: {
    width: '100%',
    maxWidth: 360,
    gap: spacing.md,
  },
  errorMessage: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
    fontFamily: 'Menlo',
  },
});
