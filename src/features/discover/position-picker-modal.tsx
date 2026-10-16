import { Check, Send } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../lib/app-theme';
import { useSharedStyles } from '../../styles/shared';

export function PositionPickerModal({
  visible,
  positions,
  onSubmit,
  onCancel,
}: {
  visible: boolean;
  positions: { id: string; title: string }[];
  onSubmit: (selectedIds: string[]) => void;
  onCancel: () => void;
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const local = useLocalStyles();
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (visible) setSelected([]);
  }, [visible]);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={local.modalOverlay}>
        <View style={local.modalCard}>
          <Text style={shared.subtitle}>Which position(s)?</Text>

          <ScrollView style={{ maxHeight: 260, marginTop: 12 }}>
            {positions.map((p) => {
              const isChecked = selected.includes(p.id);
              return (
                <Pressable
                  key={p.id}
                  style={local.checklistRow}
                  onPress={() => toggle(p.id)}
                >
                  <View style={[local.checkbox, isChecked && local.checkboxChecked]}>
                    {isChecked && <Check size={14} color={c.onAccent} strokeWidth={3} />}
                  </View>
                  <Text style={local.checklistText}>{p.title}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable style={shared.authButton} onPress={() => onSubmit(selected)}>
            <Text style={shared.authButtonText}>
              {selected.length === 0 ? 'Send general interest' : 'Send interest'}
            </Text>
          </Pressable>

          <Pressable style={{ marginTop: 10, alignItems: 'center' }} onPress={onCancel}>
            <Text style={shared.subtitle}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        modalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'center',
          paddingHorizontal: 28,
        },

        modalCard: {
          backgroundColor: c.surface,
          borderRadius: 20,
          padding: 22,
        },

        checklistRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 10,
        },

        checkbox: {
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: c.borderStrong,
          alignItems: 'center',
          justifyContent: 'center',
        },

        checkboxChecked: {
          backgroundColor: c.accent,
          borderColor: c.accent,
        },

        checklistText: {
          fontSize: 15,
          color: c.text,
          flex: 1,
        },
      }),
    [c]
  );
}
