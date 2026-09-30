import { rememberDiagnostic } from '@/lib/diagnostics';
/** App-level recovery UI. Stores only a diagnostic class in memory; reports require explicit consent. */

import { ErrorScreen } from '@/components';
import { router as expoRouter } from 'expo-router';
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (__DEV__) console.error('[ErrorBoundary]', error, info.componentStack);
    rememberDiagnostic(error);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = (): void => {
    // Reset state BEFORE navigation so the tabs render without the
    // boundary's error UI on top.
    this.setState({ hasError: false, error: null });
    try {
      expoRouter.replace('/(tabs)' as never);
    } catch {
      // If the router isn't ready (e.g. the error happened before any
      // navigation context mounted), just stay in the reset state — the
      // root layout will route the user appropriately on next render.
    }
  };

  handleSendFeedback = (): void => {
    this.setState({ hasError: false, error: null });
    try { expoRouter.push('/feedback'); } catch { /* Router may not be ready. */ }
  };

  render() {
    if (!this.state.hasError || !this.state.error) {
      return this.props.children;
    }
    return (
      <ErrorScreen
        error={this.state.error}
        onRetry={this.handleRetry}
        onSendFeedback={this.handleSendFeedback}
        onGoHome={this.handleGoHome}
      />
    );
  }
}
