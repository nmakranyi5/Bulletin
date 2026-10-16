import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../lib/app-theme';
import { useSharedStyles } from '../styles/shared';

export function ChipSelect({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly string[];
  selected: readonly string[];
  onToggle: (option: string) => void;
}) {
  const shared = useSharedStyles();
  const local = useLocalStyles();
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={shared.sectionLabel}>{label}</Text>
      <View style={[shared.tags, { marginTop: 8 }]}>
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <Pressable
              key={option}
              style={[local.chip, active && local.chipActive]}
              onPress={() => onToggle(option)}
            >
              <Text style={[local.chipText, active && local.chipTextActive]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        chip: {
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: 20,
          backgroundColor: c.surfaceAlt,
          borderWidth: 1,
          borderColor: c.border,
        },

        chipActive: {
          backgroundColor: c.accent,
          borderColor: c.accent,
        },

        chipText: {
          fontSize: 13,
          fontWeight: '600',
          color: c.textStrong,
        },

        chipTextActive: {
          color: c.onAccent,
        },
      }),
    [c]
  );
}
