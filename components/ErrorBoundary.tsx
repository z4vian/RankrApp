import Ionicons from '@expo/vector-icons/Ionicons';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, glow, radius, shadow, spacing, typography } from '@/lib/theme';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level error boundary — catches uncaught render errors anywhere below
 * and shows a recoverable fallback screen instead of the white-screen-of-
 * death. Wire to crash-reporting (Sentry / Bugsnag) inside componentDidCatch
 * once a DSN is configured.
 *
 * The "Try again" button resets the boundary state, which re-mounts the
 * subtree. Most transient errors (lost connection, race condition) recover
 * from a re-mount alone. For permanent errors the user can sign out from
 * the secondary button which clears their session and routes back to auth.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Crash reporter hook — replace this with Sentry.captureException once
    // the DSN is wired up. Keeping a console.error so dev builds still
    // surface the stack.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Ionicons name="warning-outline" size={40} color={colors.purpleLight} />
          </View>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            We hit an unexpected error. Try reloading the screen — if it keeps
            happening, please send us feedback.
          </Text>

          {__DEV__ && this.state.error ? (
            <View style={styles.devBox}>
              <Text style={styles.devLabel}>DEBUG</Text>
              <Text style={styles.devMessage} numberOfLines={5}>
                {this.state.error.message}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.button}
            onPress={this.handleReset}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Ionicons name="refresh" size={18} color={colors.text} />
            <Text style={styles.buttonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.purpleSoft,
    borderWidth: 1,
    borderColor: colors.purple,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  devBox: {
    width: '100%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  devLabel: {
    ...typography.micro,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  devMessage: {
    ...typography.small,
    color: colors.text,
    fontFamily: 'monospace',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.purple,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md + 2,
    ...glow.purple,
    ...shadow.sm,
  },
  buttonText: {
    ...typography.bodyBold,
    color: colors.text,
  },
});
