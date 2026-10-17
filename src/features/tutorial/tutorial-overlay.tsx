import { Handshake, MessageCircle, Repeat, Search, Sparkles, UserRound } from 'lucide-react-native';
import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../lib/app-theme';
import { TourStep } from '../../../lib/tutorial';

const ICONS: Record<string, typeof Search> = {
  welcome: Sparkles,
  discover: Search,
  interests: Handshake,
  messages: MessageCircle,
  profile: UserRound,
  loop: Repeat,
};

// "Want a quick tour?" for new accounts, then the tour itself: a card over the real app,
// which switches to the tab being explained (see MainApp). Skippable at every point.
export function TutorialOverlay({
  stage,
  steps,
  step,
  onStart,
  onStep,
  onClose,
}: {
  stage: 'idle' | 'offer' | 'tour';
  steps: TourStep[];
  step: number;
  onStart: () => void;
  onStep: (index: number) => void;
  onClose: () => void;
}) {
  const c = useTheme().colors;
  const local = useLocalStyles();
  if (stage === 'idle') return null;

  const current = steps[Math.min(step, steps.length - 1)];
  const isLast = step >= steps.length - 1;
  const Icon = ICONS[current.key] ?? Sparkles;

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} visible>
      <View style={[local.overlay, stage === 'offer' && local.overlayCentered]}>
        {stage === 'offer' ? (
          <View style={local.card}>
            <View style={local.iconCircle}>
              <Sparkles size={26} color={c.onAccent} strokeWidth={2.2} />
            </View>
            <Text style={local.title}>Want a quick tour?</Text>
            <Text style={local.body}>
              A one-minute walk through each tab and how it all fits together. You can skip it and
              replay it later from Profile &gt; Settings.
            </Text>
            <Pressable style={local.primary} onPress={onStart} accessibilityRole="button">
              <Text style={local.primaryText}>Show me around</Text>
            </Pressable>
            <Pressable style={local.secondary} onPress={onClose} accessibilityRole="button">
              <Text style={local.secondaryText}>Skip for now</Text>
            </Pressable>
          </View>
        ) : (
          <View style={local.card}>
            <View style={local.topRow}>
              <View style={local.iconCircle}>
                <Icon size={24} color={c.onAccent} strokeWidth={2.2} />
              </View>
              <Text style={local.counter}>
                {step + 1} of {steps.length}
              </Text>
            </View>

            <Text style={local.title}>{current.title}</Text>
            <Text style={local.body}>{current.body}</Text>

            <View style={local.points}>
              {current.points.map((p) => (
                <View key={p} style={local.pointRow}>
                  <View style={local.dot} />
                  <Text style={local.pointText}>{p}</Text>
                </View>
              ))}
            </View>

            <View style={local.progress}>
              {steps.map((s, i) => (
                <View key={s.key} style={[local.bar, i <= step && local.barDone]} />
              ))}
            </View>

            <View style={local.buttons}>
              {step > 0 && (
                <Pressable style={local.back} onPress={() => onStep(step - 1)}>
                  <Text style={local.backText}>Back</Text>
                </Pressable>
              )}
              <Pressable
                style={local.next}
                onPress={() => (isLast ? onClose() : onStep(step + 1))}
                accessibilityRole="button"
              >
                <Text style={local.primaryText}>{isLast ? 'Start exploring' : 'Next'}</Text>
              </Pressable>
            </View>

            {!isLast && (
              <Pressable style={local.secondary} onPress={onClose} accessibilityRole="button">
                <Text style={local.secondaryText}>Skip tour</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        // The tour sits low so the tab it is describing stays visible above it.
        overlay: {
          flex: 1,
          justifyContent: 'flex-end',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.35)',
          padding: 16,
          paddingBottom: 28,
        },

        overlayCentered: {
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)',
        },

        card: {
          width: '100%',
          maxWidth: 440,
          padding: 22,
          borderRadius: 26,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
        },

        topRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },

        iconCircle: {
          width: 46,
          height: 46,
          borderRadius: 23,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.accent,
        },

        counter: {
          fontSize: 12,
          fontWeight: '700',
          color: c.muted,
        },

        title: {
          marginTop: 14,
          fontSize: 22,
          fontWeight: '800',
          letterSpacing: -0.4,
          color: c.text,
        },

        body: {
          marginTop: 6,
          fontSize: 15,
          lineHeight: 21,
          color: c.textSecondary,
        },

        points: {
          marginTop: 14,
          gap: 8,
        },

        pointRow: {
          flexDirection: 'row',
          gap: 10,
        },

        dot: {
          width: 6,
          height: 6,
          borderRadius: 3,
          marginTop: 7,
          backgroundColor: c.accent,
        },

        pointText: {
          flex: 1,
          fontSize: 14,
          lineHeight: 20,
          color: c.text,
        },

        progress: {
          flexDirection: 'row',
          gap: 5,
          marginTop: 18,
        },

        bar: {
          flex: 1,
          height: 4,
          borderRadius: 2,
          backgroundColor: c.border,
        },

        barDone: {
          backgroundColor: c.accent,
        },

        buttons: {
          flexDirection: 'row',
          gap: 10,
          marginTop: 16,
        },

        back: {
          paddingHorizontal: 22,
          paddingVertical: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: c.borderStrong,
          alignItems: 'center',
          justifyContent: 'center',
        },

        backText: {
          fontSize: 15,
          fontWeight: '700',
          color: c.text,
        },

        next: {
          flex: 1,
          paddingVertical: 14,
          borderRadius: 14,
          backgroundColor: c.accent,
          alignItems: 'center',
        },

        primary: {
          marginTop: 18,
          paddingVertical: 14,
          borderRadius: 14,
          backgroundColor: c.accent,
          alignItems: 'center',
        },

        primaryText: {
          fontSize: 15,
          fontWeight: '700',
          color: c.onAccent,
        },

        secondary: {
          marginTop: 6,
          paddingVertical: 12,
          alignItems: 'center',
        },

        secondaryText: {
          fontSize: 15,
          fontWeight: '600',
          color: c.textSecondary,
        },
      }),
    [c]
  );
}
