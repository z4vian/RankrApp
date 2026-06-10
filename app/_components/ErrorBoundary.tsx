/**
 * app/_components/ErrorBoundary.tsx
 *
 * App-level error boundary, distinct from the simpler one in `@/components`.
 *
 * Differences from `components/ErrorBoundary.tsx`:
 *   - Wires into Sentry via `Sentry.Native.captureException(error)` on
 *     `componentDidCatch`. Sentry is dynamic-required so the bundle still
 *     compiles when the package isn't installed yet.
 *   - Renders the richer `<ErrorScreen>` from `@/components` with three
 *     actions: Try again (reset state), Send a report (navigate to
 *     `/feedback?error=<base64>` so the feedback screen can show the
 *     error context), and Go home (`router.replace('/(tabs)')`).
 *
 * Lives in `app/_components/` so expo-router doesn't trace it as a route
 * (leading-underscore folders are private to the file router).
 */

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

/**
 * Encode an Error as a URL-safe base64 JSON string. The feedback screen
 * decodes this back via atob+JSON.parse.
 *
 * Using `globalThis.btoa` keeps this cross-platform — React Native has it
 * on web and via the URL polyfill on native. We fall back to a hex-encoded
 * placeholder if btoa is somehow unavailable.
 */
function encodeErrorParam(error: Error): string {
  try {
    const payload = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
    const json = JSON.stringify(payload);
    if (typeof globalThis.btoa === 'function') {
      // URL-safe base64: swap + → -, / → _, drop =
      return globalThis
        .btoa(unescape(encodeURIComponent(json)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }
    // Hex fallback — bigger payload but tsc/runtime-safe everywhere.
    let hex = '';
    for (let i = 0; i < json.length; i++) {
      hex += json.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return `hex.${hex}`;
  } catch {
    return '';
  }
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Always log to console — works in dev + prod for users who open the
    // browser/native debugger.
    console.error('[ErrorBoundary]', error, info.componentStack);

    // Crash-reporting hook. Sentry is dynamic-required so this is safe
    // when the package isn't installed yet (returns undefined → swallow).
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require('sentry-expo');
      // sentry-expo exposes `.Native.captureException` for native code paths.
      // On web `.Browser.captureException` is the right one but the brief
      // explicitly references `Sentry.Native.captureException` so use that
      // and let the runtime no-op gracefully if it's missing.
      const captured =
        Sentry?.Native?.captureException?.(error) ??
        Sentry?.Browser?.captureException?.(error) ??
        Sentry?.captureException?.(error);
      if (captured === undefined) {
        // No capture method available — nothing more to do. Already logged
        // above. Suppress unused-result lint by referencing the variable.
        void captured;
      }
    } catch {
      // Sentry not installed or runtime failure — swallow.
    }
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
    const err = this.state.error;
    const encoded = err ? encodeErrorParam(err) : '';
    // Reset state so the feedback screen renders unobstructed once we
    // navigate. The error is preserved in the URL param.
    this.setState({ hasError: false, error: null });
    try {
      const path = encoded
        ? (`/feedback?error=${encoded}` as never)
        : ('/feedback' as never);
      expoRouter.push(path);
    } catch {
      // Router not ready — best-effort, error stays logged in Sentry.
    }
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
