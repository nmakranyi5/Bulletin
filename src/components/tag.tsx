import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../lib/app-theme';

export function Tag({ text }: { text: string }) {
  const local = useLocalStyles();
  return (
    <View style={local.tag}>
      <Text style={local.tagText}>
        {text}
      </Text>
    </View>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        tag: {
          paddingHorizontal: 11,
          paddingVertical: 7,
          borderRadius: 20,
          backgroundColor: c.surfaceAlt,
        },

        tagText: {
          fontSize: 12,
          fontWeight: '600',
          color: c.textStrong,
        },
      }),
    [c]
  );
}
