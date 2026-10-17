import { TextInput } from 'react-native';
import { useTheme } from '../../lib/app-theme';
import { useSharedStyles } from '../styles/shared';

export type PlaceValue = { text: string; lat: number | null; lng: number | null };

// Web: the map picker needs a phone, so this is a plain text field.
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
  return (
    <TextInput
      style={shared.authInput}
      placeholder={placeholder}
      placeholderTextColor={c.muted}
      value={value.text}
      onChangeText={(text) => onChange({ text, lat: null, lng: null })}
    />
  );
}
