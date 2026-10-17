import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from './app-theme';
import { AlertButton, createAlertQueue } from './alert-queue';

// React Native's Alert.alert does nothing on the web, so every confirmation, error and
// notice in the app would silently vanish there. This makes it work on web by showing
// the same kind of dialog as on a phone. On iOS/Android nothing changes.

const queue = createAlertQueue();

// Replace Alert.alert on web so existing calls (Alert.alert('Title', 'Message', [...]))
// keep working untouched. Safe to call more than once.
export function installWebAlert() {
  if (Platform.OS !== 'web') return;
  (Alert as unknown as { alert: typeof queue.enqueue }).alert = (title, message, buttons, options) =>
    queue.enqueue(String(title), message == null ? undefined : String(message), buttons, options);
}

// Renders whichever alert is at the front of the queue. Mount once, inside the theme.
export function WebAlertHost() {
  const c = useTheme().colors;
  const local = useLocalStyles();
  const current = useSyncExternalStore(
    queue.subscribe,
    queue.current,
    queue.current
  );

  // Escape closes with the cancel button, like the back button on Android.
  useEffect(() => {
    if (Platform.OS !== 'web' || !current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') queue.escape();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current?.id]);

  if (Platform.OS !== 'web' || !current) return null;

  const stacked = current.buttons.length > 2;
  const tone = (b: AlertButton) =>
    b.style === 'destructive' ? c.danger : b.style === 'cancel' ? c.textSecondary : c.blue;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => queue.escape()}>
      {/* Tapping outside only closes it when the alert is cancelable, as on Android. */}
      <Pressable
        style={local.overlay}
        onPress={() => current.options?.cancelable && queue.dismiss()}
        accessible={false}
      >
        <Pressable style={local.card} accessibilityRole="alert" onPress={() => {}}>
          <View style={local.body}>
            <Text style={local.title}>{current.title}</Text>
            {current.message ? <Text style={local.message}>{current.message}</Text> : null}
          </View>

          <View style={[local.buttons, stacked && local.buttonsStacked]}>
            {current.buttons.map((b, i) => (
              <Pressable
                key={`${current.id}-${i}`}
                style={({ pressed }) => [
                  local.button,
                  i > 0 && (stacked ? local.buttonDividerTop : local.buttonDivider),
                  pressed && local.buttonPressed,
                ]}
                onPress={() => queue.press(b)}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    local.buttonText,
                    { color: tone(b) },
                    b.style !== 'cancel' && local.buttonTextBold,
                  ]}
                >
                  {b.text ?? 'OK'}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        },

        card: {
          width: '100%',
          maxWidth: 320,
          borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
        },

        body: {
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 16,
          gap: 6,
        },

        title: {
          fontSize: 17,
          fontWeight: '700',
          textAlign: 'center',
          color: c.text,
        },

        message: {
          fontSize: 14,
          lineHeight: 20,
          textAlign: 'center',
          color: c.textSecondary,
        },

        buttons: {
          flexDirection: 'row',
          borderTopWidth: 1,
          borderTopColor: c.border,
        },

        buttonsStacked: {
          flexDirection: 'column',
        },

        button: {
          flex: 1,
          minHeight: 46,
          paddingVertical: 12,
          paddingHorizontal: 8,
          alignItems: 'center',
          justifyContent: 'center',
        },

        buttonDividerTop: {
          borderTopWidth: 1,
          borderTopColor: c.border,
        },

        buttonDivider: {
          borderLeftWidth: 1,
          borderLeftColor: c.border,
        },

        buttonPressed: {
          backgroundColor: c.surfaceAlt,
        },

        buttonText: {
          fontSize: 16,
        },

        buttonTextBold: {
          fontWeight: '600',
        },
      }),
    [c]
  );
}
