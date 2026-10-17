import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { CalendarClock, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../lib/app-theme';
import { defaultPickerDate, formatCloseField } from '../../lib/close-date';
import { serverNow } from '../../lib/time';
import { useSharedStyles } from '../styles/shared';

// A tappable date + time field. iOS opens a wheel picker in a sheet; Android opens the
// system date dialog and then the time dialog. (On the web see date-time-field.web.tsx.)
export function DateTimeField({
  value,
  onChange,
  minimumDate,
  maximumDate,
  placeholder,
}: {
  value: Date | null;
  onChange: (value: Date | null) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder: string;
}) {
  const { colors: c, mode } = useTheme();
  const shared = useSharedStyles();
  const local = useLocalStyles();
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(new Date());

  const start = () => value ?? defaultPickerDate(serverNow());

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        mode: 'date',
        value: start(),
        minimumDate,
        maximumDate,
        onValueChange: (_event, day) => {
          // Then ask for the time on that day.
          DateTimePickerAndroid.open({
            mode: 'time',
            value: day,
            onValueChange: (_e, time) => {
              const picked = new Date(day);
              picked.setHours(time.getHours(), time.getMinutes(), 0, 0);
              onChange(picked);
            },
          });
        },
      });
      return;
    }
    setDraft(start());
    setIosOpen(true);
  };

  return (
    <>
      <Pressable style={[shared.authInput, local.field]} onPress={open}>
        <CalendarClock size={18} color={c.textSecondary} strokeWidth={2} />
        <Text style={[local.fieldText, !value && { color: c.muted }]} numberOfLines={1}>
          {value ? formatCloseField(value) : placeholder}
        </Text>
        {value ? (
          <Pressable onPress={() => onChange(null)} hitSlop={10} accessibilityLabel="Clear date">
            <X size={16} color={c.textSecondary} strokeWidth={2.4} />
          </Pressable>
        ) : null}
      </Pressable>

      {Platform.OS === 'ios' && (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <View style={local.overlay}>
            <View style={local.sheet}>
              <View style={local.sheetHeader}>
                <Pressable onPress={() => setIosOpen(false)} hitSlop={10}>
                  <Text style={local.sheetCancel}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    onChange(draft);
                    setIosOpen(false);
                  }}
                  hitSlop={10}
                >
                  <Text style={local.sheetDone}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                mode="datetime"
                display="spinner"
                value={draft}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                minuteInterval={5}
                themeVariant={mode}
                textColor={c.text}
                onValueChange={(_event, date) => setDraft(date)}
              />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        field: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },

        fieldText: {
          flex: 1,
          fontSize: 15,
          color: c.text,
        },

        overlay: {
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.4)',
        },

        sheet: {
          backgroundColor: c.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingBottom: 28,
        },

        sheetHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 16,
        },

        sheetCancel: {
          fontSize: 16,
          fontWeight: '600',
          color: c.textSecondary,
        },

        sheetDone: {
          fontSize: 16,
          fontWeight: '700',
          color: c.blue,
        },
      }),
    [c]
  );
}
