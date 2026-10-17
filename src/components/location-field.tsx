import { MapPin } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '../../lib/app-theme';
import { useSharedStyles } from '../styles/shared';
import { MapPickerModal } from './map-picker-modal';

export type PlaceValue = { text: string; lat: number | null; lng: number | null };

// A place name you can type, with a button that opens a map to drop a pin instead.
// Typing by hand clears any pin, so the coordinates never disagree with the text.
export function LocationField({
  value,
  onChange,
  placeholder,
}: {
  value: PlaceValue;
  onChange: (value: PlaceValue) => void;
  placeholder: string;
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const local = useLocalStyles();
  const [open, setOpen] = useState(false);
  const pinned = value.lat !== null && value.lng !== null;

  return (
    <>
      <View style={local.row}>
        <TextInput
          style={[shared.authInput, local.input]}
          placeholder={placeholder}
          placeholderTextColor={c.muted}
          value={value.text}
          onChangeText={(text) => onChange({ text, lat: null, lng: null })}
        />
        <Pressable
          style={[local.mapButton, pinned && local.mapButtonPinned]}
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Pick on map"
        >
          <MapPin size={20} color={pinned ? c.onAccent : c.text} strokeWidth={2.2} />
        </Pressable>
      </View>

      <MapPickerModal
        visible={open}
        initial={value}
        onCancel={() => setOpen(false)}
        onPick={(place) => {
          onChange(place);
          setOpen(false);
        }}
      />
    </>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: 10,
        },

        input: {
          flex: 1,
        },

        mapButton: {
          width: 52,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.surfaceAlt,
          borderWidth: 1,
          borderColor: c.border,
        },

        mapButtonPinned: {
          backgroundColor: c.accent,
          borderColor: c.accent,
        },
      }),
    [c]
  );
}
