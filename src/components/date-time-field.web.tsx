import { CalendarClock } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../lib/app-theme';
import { fromLocalInputValue, toLocalInputValue } from '../../lib/close-date';
import { useSharedStyles } from '../styles/shared';

// Web: the browser's own date + time picker.
export function DateTimeField({
  value,
  onChange,
  minimumDate,
  maximumDate,
}: {
  value: Date | null;
  onChange: (value: Date | null) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder: string;
}) {
  const { colors: c, mode } = useTheme();
  const shared = useSharedStyles();
  const local = useMemo(
    () => StyleSheet.create({ field: { flexDirection: 'row', alignItems: 'center', gap: 10 } }),
    []
  );

  return (
    <View style={[shared.authInput, local.field]}>
      <CalendarClock size={18} color={c.textSecondary} strokeWidth={2} />
      <input
        type="datetime-local"
        value={value ? toLocalInputValue(value) : ''}
        min={minimumDate ? toLocalInputValue(minimumDate) : undefined}
        max={maximumDate ? toLocalInputValue(maximumDate) : undefined}
        onChange={(e) => onChange(fromLocalInputValue(e.target.value))}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: c.text,
          colorScheme: mode,
          fontSize: 15,
          fontFamily: 'inherit',
        }}
      />
    </View>
  );
}
