import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Toast, ToastTone } from './Toast';
import { spacing } from '@/lib/theme';

const DEFAULT_DURATION = 3500;
const MAX_VISIBLE = 3;
const FADE_OUT_MS = 220;

export interface ShowToastOptions {
  tone?: ToastTone;
  durationMs?: number;
}

interface ToastEntry {
  id: number;
  message: string;
  tone: ToastTone;
  // Per-toast fade controller used during dismissal.
  fade: Animated.Value;
}

interface ToastContextValue {
  showToast: (message: string, opts?: ShowToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Provides the toast queue + portal-style stack at the bottom of the screen. Wrap your app root. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Cleanup any pending timers if the provider unmounts.
  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach(clearTimeout);
      map.clear();
    };
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => {
      const target = prev.find(t => t.id === id);
      if (!target) return prev;
      // Animate fade-out, then drop from state.
      Animated.timing(target.fade, {
        toValue: 0,
        duration: FADE_OUT_MS,
        useNativeDriver: true,
      }).start(() => {
        setToasts(curr => curr.filter(t => t.id !== id));
      });
      return prev;
    });

    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message: string, opts?: ShowToastOptions) => {
      const id = nextId.current++;
      const tone: ToastTone = opts?.tone ?? 'info';
      const duration = opts?.durationMs ?? DEFAULT_DURATION;
      const entry: ToastEntry = {
        id,
        message,
        tone,
        fade: new Animated.Value(1),
      };

      setToasts(prev => {
        const next = [...prev, entry];
        // Keep at most MAX_VISIBLE; drop oldest immediately if exceeded.
        if (next.length > MAX_VISIBLE) {
          const dropped = next.slice(0, next.length - MAX_VISIBLE);
          dropped.forEach(d => {
            const t = timers.current.get(d.id);
            if (t) {
              clearTimeout(t);
              timers.current.delete(d.id);
            }
          });
          return next.slice(-MAX_VISIBLE);
        }
        return next;
      });

      const timer = setTimeout(() => removeToast(id), duration);
      timers.current.set(id, timer);
    },
    [removeToast]
  );

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View
        pointerEvents="box-none"
        style={[
          styles.stack,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) },
        ]}
      >
        {toasts.map(t => (
          <Animated.View
            key={t.id}
            pointerEvents="box-none"
            style={[styles.slot, { opacity: t.fade }]}
          >
            <Toast
              message={t.message}
              tone={t.tone}
              onDismiss={() => removeToast(t.id)}
            />
          </Animated.View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

/** Returns `{ showToast }` — call from any descendant of ToastProvider. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fail gracefully — no-op when the provider isn't mounted (e.g. in tests).
    return {
      showToast: () => {
        if (__DEV__) {
          console.warn('useToast called outside ToastProvider — message ignored.');
        }
      },
    };
  }
  return ctx;
}

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  slot: {
    width: '100%',
    marginTop: spacing.sm,
    alignItems: 'center',
  },
});
