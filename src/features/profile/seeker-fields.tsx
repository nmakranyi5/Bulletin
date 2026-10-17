import { Text, TextInput } from 'react-native';
import { useTheme } from '../../../lib/app-theme';
import { EPA_TYPES, isUniversal, parseYear, SCHEDULE_TYPES, TRADE_ROLES } from '../../../lib/hvac';
import { ChipSelect } from '../../components/chip-select';
import { LocationField } from '../../components/location-field';
import { useSharedStyles } from '../../styles/shared';

export type SeekerValues = {
  epaCertified: boolean;
  epaTypes: string[];
  startYear: string;
  tradeRole: string;
  location: string;
  locationLat: number | null;
  locationLng: number | null;
  hasLicense: boolean;
  openSchedules: string[];
};

// Setup walks through these one screen at a time (editing shows them all together).
export const SEEKER_STEPS = [
  {
    key: 'certification',
    title: 'Your EPA 608',
    subtitle: 'The refrigerant certification many HVAC jobs ask for.',
  },
  {
    key: 'experience',
    title: 'Your experience',
    subtitle: 'How long you have been in the trade, and what you do.',
  },
  { key: 'where', title: 'Where you are', subtitle: 'So shops near you can find you.' },
  {
    key: 'availability',
    title: 'What you are open to',
    subtitle: 'The schedules you would take on.',
  },
] as const;
export type SeekerStep = (typeof SEEKER_STEPS)[number]['key'];

// What stops you moving on from a step, or null when it is fine to continue.
export function seekerStepError(
  step: SeekerStep,
  v: SeekerValues
): { title: string; message: string } | null {
  if (step === 'certification' && v.epaCertified && v.epaTypes.length === 0) {
    return { title: 'EPA 608', message: 'Select at least one certification type, or choose No.' };
  }
  if (step === 'experience' && parseYear(v.startYear) === 'invalid') {
    return {
      title: 'Invalid year',
      message: 'Enter the four-digit year you started in the trade, e.g. 2020.',
    };
  }
  return null;
}

export const emptySeeker: SeekerValues = {
  epaCertified: false,
  epaTypes: [],
  startYear: '',
  tradeRole: '',
  location: '',
  locationLat: null,
  locationLng: null,
  hasLicense: false,
  openSchedules: [],
};

export function seekerFromRow(row: any): SeekerValues {
  return {
    epaCertified: (row.epa_608_types ?? []).length > 0,
    epaTypes: row.epa_608_types ?? [],
    startYear: row.trade_start_year ? String(row.trade_start_year) : '',
    tradeRole: row.trade_role ?? '',
    location: row.location ?? '',
    locationLat: typeof row.location_lat === 'number' ? row.location_lat : null,
    locationLng: typeof row.location_lng === 'number' ? row.location_lng : null,
    hasLicense: !!row.has_drivers_license,
    openSchedules: row.open_schedules ?? [],
  };
}

export function buildSeekerPayload(
  v: SeekerValues
): { payload: Record<string, unknown> } | { error: { title: string; message: string } } {
  const year = parseYear(v.startYear);
  if (year === 'invalid') {
    return {
      error: {
        title: 'Invalid year',
        message: 'Enter the four-digit year you started in the trade, e.g. 2020.',
      },
    };
  }
  if (v.epaCertified && v.epaTypes.length === 0) {
    return {
      error: {
        title: 'EPA 608',
        message: 'Select at least one certification type, or choose No.',
      },
    };
  }
  return {
    payload: {
      epa_608_types: v.epaCertified ? v.epaTypes : [],
      trade_start_year: year,
      trade_role: v.tradeRole || null,
      location: v.location.trim() || null,
      ...(v.location.trim()
        ? { location_lat: v.locationLat, location_lng: v.locationLng }
        : { location_lat: null, location_lng: null }),
      has_drivers_license: v.hasLicense,
      open_schedules: v.openSchedules,
    },
  };
}

const toggle = (list: string[], o: string) =>
  list.includes(o) ? list.filter((x) => x !== o) : [...list, o];

export function SeekerFields({
  value,
  onChange,
  step,
}: {
  value: SeekerValues;
  onChange: (patch: Partial<SeekerValues>) => void;
  step: SeekerStep;
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();

  return (
    <>
      {step === 'certification' && (
        <>
          <ChipSelect
            label="EPA 608 CERTIFIED?"
            options={['Yes', 'No']}
            selected={[value.epaCertified ? 'Yes' : 'No']}
            onToggle={(o) =>
              onChange({ epaCertified: o === 'Yes', ...(o === 'No' && { epaTypes: [] }) })
            }
          />

          {value.epaCertified && (
            <>
              <ChipSelect
                label="CERTIFICATION TYPES"
                options={EPA_TYPES.map((t) => `Type ${t}`)}
                selected={value.epaTypes.map((t) => `Type ${t}`)}
                onToggle={(o) =>
                  onChange({ epaTypes: toggle(value.epaTypes, o.replace('Type ', '')) })
                }
              />
              {isUniversal(value.epaTypes) && (
                <Text style={shared.chipHint}>Shown on your profile as Universal.</Text>
              )}
            </>
          )}
        </>
      )}

      {step === 'experience' && (
        <>
          <TextInput
            style={shared.authInput}
            placeholder="Year started in the trade (e.g. 2020)"
            placeholderTextColor={c.muted}
            value={value.startYear}
            onChangeText={(startYear) => onChange({ startYear })}
            keyboardType="number-pad"
            maxLength={4}
          />

          <ChipSelect
            label="CURRENT / MOST RECENT ROLE"
            options={TRADE_ROLES}
            selected={value.tradeRole ? [value.tradeRole] : []}
            onToggle={(o) => onChange({ tradeRole: value.tradeRole === o ? '' : o })}
          />
        </>
      )}

      {step === 'where' && (
        <>
          <LocationField
            placeholder="Where you're based (e.g. Austin, TX)"
            value={{ text: value.location, lat: value.locationLat, lng: value.locationLng }}
            onChange={(p) => onChange({ location: p.text, locationLat: p.lat, locationLng: p.lng })}
          />

          <ChipSelect
            label="VALID DRIVER'S LICENSE?"
            options={['Yes', 'No']}
            selected={[value.hasLicense ? 'Yes' : 'No']}
            onToggle={(o) => onChange({ hasLicense: o === 'Yes' })}
          />
        </>
      )}

      {step === 'availability' && (
        <>
          <ChipSelect
            label="OPEN TO (SELECT ALL THAT APPLY)"
            options={SCHEDULE_TYPES}
            selected={value.openSchedules}
            onToggle={(o) => onChange({ openSchedules: toggle(value.openSchedules, o) })}
          />
        </>
      )}
    </>
  );
}
