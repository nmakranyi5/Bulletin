import { ArrowLeft, X } from 'lucide-react-native';
import { ReactNode, useMemo } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/app-theme';
import { useSharedStyles } from '../styles/shared';

export type FormStep = { key: string; title: string; subtitle: string };

// A long form shown one short step at a time: progress bar, a big title, Back / Next.
// With `wizard` off (editing something that already exists) every step is shown together
// in one scroll with a single save button, so you can jump straight to what you want.
export function StepForm({
  steps,
  stepIndex,
  onStepChange,
  wizard,
  loading = false,
  renderStep,
  stepProblem,
  onSubmit,
  submitting,
  submitLabel,
  saveLabel,
  editingSubtitle,
  exit,
}: {
  steps: FormStep[];
  stepIndex: number;
  onStepChange: (index: number) => void;
  wizard: boolean;
  loading?: boolean;
  renderStep: (key: string) => ReactNode;
  // What stops you moving on from a step, or null when it is fine to continue.
  stepProblem: (key: string) => { title: string; message: string } | null;
  onSubmit: () => void;
  submitting: boolean;
  // Button text on the last step / when everything is shown together.
  submitLabel: string;
  saveLabel: string;
  editingSubtitle: string;
  exit?: { kind: 'back' | 'close'; label: string; onPress: () => void };
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const local = useLocalStyles();
  const index = Math.min(stepIndex, steps.length - 1);
  const current = steps[index];
  const isLast = index >= steps.length - 1;

  const next = () => {
    const problem = stepProblem(current.key);
    if (problem) {
      Alert.alert(problem.title, problem.message);
      return;
    }
    if (isLast) onSubmit();
    else onStepChange(index + 1);
  };

  return (
    <SafeAreaView style={shared.authContainer}>
      <KeyboardAvoidingView
        style={local.page}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[local.topRow, exit?.kind === 'back' && local.topRowBack]}>
          {/* A back arrow sits at the top left, before the logo; a close X sits at the top right. */}
          {exit?.kind === 'back' && (
            <Pressable
              onPress={exit.onPress}
              disabled={submitting}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={exit.label}
              style={shared.chatBackButton}
            >
              <ArrowLeft size={22} color={c.text} strokeWidth={2.2} />
            </Pressable>
          )}
          <Text style={shared.logo}>bulletin.</Text>
          {exit?.kind === 'close' && (
            <Pressable
              onPress={exit.onPress}
              disabled={submitting}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={exit.label}
              style={shared.chatBackButton}
            >
              <X size={22} color={c.text} strokeWidth={2.2} />
            </Pressable>
          )}
        </View>

        {loading ? (
          <Text style={shared.subtitle}>Loading...</Text>
        ) : (
          <>
            {wizard ? (
              <View
                style={local.progress}
                accessibilityLabel={`Step ${index + 1} of ${steps.length}`}
              >
                {steps.map((step, i) => (
                  <View
                    key={step.key}
                    style={[local.progressBar, i <= index && local.progressDone]}
                  />
                ))}
              </View>
            ) : (
              <Text style={shared.subtitle}>{editingSubtitle}</Text>
            )}

            <ScrollView
              style={local.scroll}
              contentContainerStyle={local.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {(wizard ? [current] : steps).map((step) => (
                <View key={step.key} style={local.section}>
                  <Text style={local.stepTitle}>{step.title}</Text>
                  <Text style={local.stepSubtitle}>{step.subtitle}</Text>
                  <View style={local.stepBody}>{renderStep(step.key)}</View>
                </View>
              ))}
            </ScrollView>

            <View style={local.footer}>
              {wizard && index > 0 && (
                <Pressable
                  style={local.backButton}
                  onPress={() => onStepChange(Math.max(0, index - 1))}
                  disabled={submitting}
                >
                  <Text style={local.backButtonText}>Back</Text>
                </Pressable>
              )}
              <Pressable
                style={[local.nextButton, submitting && shared.authButtonDisabled]}
                onPress={wizard ? next : onSubmit}
                disabled={submitting}
              >
                <Text style={shared.authButtonText}>
                  {submitting ? 'Saving...' : !wizard ? saveLabel : isLast ? submitLabel : 'Next'}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        page: {
          flex: 1,
          paddingHorizontal: 28,
          paddingTop: 8,
        },

        topRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        },

        topRowBack: {
          justifyContent: 'flex-start',
          gap: 14,
        },

        progress: {
          flexDirection: 'row',
          gap: 6,
        },

        progressBar: {
          flex: 1,
          height: 4,
          borderRadius: 2,
          backgroundColor: c.border,
        },

        progressDone: {
          backgroundColor: c.accent,
        },

        scroll: {
          flex: 1,
        },

        scrollContent: {
          paddingTop: 22,
          paddingBottom: 16,
          gap: 28,
        },

        section: {
          gap: 4,
        },

        stepTitle: {
          fontSize: 26,
          fontWeight: '800',
          letterSpacing: -0.6,
          color: c.text,
        },

        stepSubtitle: {
          fontSize: 15,
          lineHeight: 21,
          color: c.textSecondary,
        },

        stepBody: {
          marginTop: 14,
          gap: 12,
        },

        footer: {
          flexDirection: 'row',
          gap: 10,
          paddingTop: 10,
          paddingBottom: 12,
        },

        backButton: {
          paddingHorizontal: 22,
          paddingVertical: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: c.borderStrong,
          alignItems: 'center',
          justifyContent: 'center',
        },

        backButtonText: {
          fontSize: 15,
          fontWeight: '700',
          color: c.text,
        },

        nextButton: {
          flex: 1,
          paddingVertical: 14,
          borderRadius: 14,
          backgroundColor: c.accent,
          alignItems: 'center',
        },
      }),
    [c]
  );
}
