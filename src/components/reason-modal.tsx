import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '../../lib/app-theme';
import { DECLINE_NOTE_MAX, cleanNote } from '../../lib/decline-reasons';
import { useSharedStyles } from '../styles/shared';

export type ReasonOption<K extends string> = {
  key: K;
  label: string;
  // Highlighted in green, for the good outcome (e.g. "We made a deal").
  positive?: boolean;
};

// Asks for a required reason (plus an optional note) before an action goes through. The
// other person sees both, so nobody is left wondering what happened.
export function ReasonModal<K extends string>({
  visible,
  title,
  subtitle,
  options,
  submitLabel,
  positiveSubmitLabel,
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  options: ReasonOption<K>[];
  submitLabel: string;
  // Button text when a positive option is selected.
  positiveSubmitLabel?: string;
  onCancel: () => void;
  // Resolves true when the action went through.
  onSubmit: (reason: K, note: string | null) => Promise<boolean>;
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const local = useLocalStyles();
  const [reason, setReason] = useState<K | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible) {
      setReason(null);
      setNote('');
      setSending(false);
    }
  }, [visible]);

  const positiveSelected = !!options.find((o) => o.key === reason)?.positive;

  const submit = async () => {
    if (!reason || sending) return;
    setSending(true);
    const done = await onSubmit(reason, cleanNote(note));
    if (!done) setSending(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={local.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={local.card}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={local.content}
          >
            <Text style={local.title}>{title}</Text>
            <Text style={local.subtitle}>{subtitle}</Text>

            <View style={local.reasons}>
              {options.map((o) => {
                const selected = reason === o.key;
                return (
                  <Pressable
                    key={o.key}
                    style={[
                      local.reasonRow,
                      selected && local.reasonRowSelected,
                      o.positive && local.reasonRowPositive,
                      o.positive && selected && local.reasonRowPositiveSelected,
                    ]}
                    onPress={() => setReason(o.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <View
                      style={[
                        local.radio,
                        selected && local.radioSelected,
                        selected && o.positive && local.radioPositive,
                      ]}
                    >
                      {selected && (
                        <View style={[local.radioDot, o.positive && local.radioDotPositive]} />
                      )}
                    </View>
                    <Text style={local.reasonText}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[shared.sectionLabel, { marginTop: 16 }]}>ADD A NOTE (OPTIONAL)</Text>
            <TextInput
              style={[shared.authInput, local.note]}
              value={note}
              onChangeText={(t) => setNote(t.slice(0, DECLINE_NOTE_MAX))}
              placeholder="A kind word or a bit more detail helps."
              placeholderTextColor={c.muted}
              multiline
              maxLength={DECLINE_NOTE_MAX}
              editable={!sending}
            />
            <Text style={local.counter}>
              {note.length}/{DECLINE_NOTE_MAX}
            </Text>

            <Pressable
              style={[
                local.sendButton,
                positiveSelected && local.sendButtonPositive,
                (!reason || sending) && local.sendButtonDisabled,
              ]}
              onPress={submit}
              disabled={!reason || sending}
            >
              <Text style={local.sendText}>
                {sending
                  ? 'Sending...'
                  : !reason
                  ? 'Choose a reason'
                  : positiveSelected && positiveSubmitLabel
                  ? positiveSubmitLabel
                  : submitLabel}
              </Text>
            </Pressable>

            <Pressable style={local.cancelButton} onPress={onCancel} disabled={sending}>
              <Text style={local.cancelText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          paddingHorizontal: 20,
          paddingVertical: 40,
        },

        card: {
          maxHeight: '100%',
          backgroundColor: c.surface,
          borderRadius: 20,
        },

        content: {
          padding: 20,
        },

        title: {
          fontSize: 20,
          fontWeight: '800',
          color: c.text,
        },

        subtitle: {
          marginTop: 6,
          fontSize: 14,
          lineHeight: 20,
          color: c.textSecondary,
        },

        reasons: {
          marginTop: 14,
          gap: 8,
        },

        reasonRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 14,
          paddingVertical: 13,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.surface,
        },

        reasonRowSelected: {
          borderColor: c.accent,
          backgroundColor: c.surfaceAlt,
        },

        radio: {
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: c.borderStrong,
          alignItems: 'center',
          justifyContent: 'center',
        },

        reasonRowPositive: {
          borderColor: c.green,
        },

        reasonRowPositiveSelected: {
          borderColor: c.green,
          backgroundColor: c.surfaceAlt,
        },

        radioPositive: {
          borderColor: c.green,
        },

        radioDotPositive: {
          backgroundColor: c.green,
        },

        sendButtonPositive: {
          backgroundColor: c.green,
        },

        radioSelected: {
          borderColor: c.accent,
        },

        radioDot: {
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: c.accent,
        },

        reasonText: {
          flex: 1,
          fontSize: 15,
          fontWeight: '600',
          color: c.text,
        },

        note: {
          marginTop: 8,
          minHeight: 72,
          textAlignVertical: 'top',
        },

        counter: {
          marginTop: 4,
          alignSelf: 'flex-end',
          fontSize: 12,
          color: c.muted,
        },

        sendButton: {
          marginTop: 14,
          paddingVertical: 14,
          borderRadius: 14,
          alignItems: 'center',
          backgroundColor: c.danger,
        },

        sendButtonDisabled: {
          opacity: 0.4,
        },

        sendText: {
          fontSize: 15,
          fontWeight: '700',
          color: c.white,
        },

        cancelButton: {
          marginTop: 4,
          paddingVertical: 12,
          alignItems: 'center',
        },

        cancelText: {
          fontSize: 15,
          fontWeight: '600',
          color: c.textSecondary,
        },
      }),
    [c]
  );
}
