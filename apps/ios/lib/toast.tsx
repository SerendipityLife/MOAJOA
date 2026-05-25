import { useEffect, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ToastKind = 'info' | 'error' | 'success';

interface ToastState {
  id: number;
  message: string;
  kind: ToastKind;
  durationMs: number;
}

// Module-level subscribe pattern — single host, single visible toast.
// New toasts replace any existing one (queue behavior intentionally NOT added
// per UI-SPEC §"Toast 컴포넌트" — single instance, no queue).
type Listener = (t: ToastState | null) => void;
const listeners = new Set<Listener>();
let nextId = 1;

export function showToast(
  message: string,
  kind: ToastKind = 'info',
  durationMs?: number,
): void {
  const t: ToastState = {
    id: nextId++,
    message,
    kind,
    durationMs: durationMs ?? (kind === 'error' ? 5000 : 3000),
  };
  for (const l of listeners) l(t);
}

export function hideToast(): void {
  for (const l of listeners) l(null);
}

export function ToastHost(): React.ReactElement | null {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<ToastState | null>(null);
  const opacity = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    const listener: Listener = (t) => setCurrent(t);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    Animated.timing(opacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setCurrent(null);
      });
    }, current.durationMs);
    return () => clearTimeout(timer);
  }, [current, opacity]);

  if (!current) return null;

  const bg = current.kind === 'error' ? 'bg-danger' : 'bg-neutral-900';

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 0,
        right: 0,
        opacity,
        zIndex: 1000,
      }}
      pointerEvents="box-none"
    >
      <Pressable onPress={hideToast}>
        <View className={`mx-4 px-4 py-3 rounded-xl shadow-md ${bg}`}>
          <Text className="text-white text-sm">{current.message}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
