import { Text, TextInput } from 'react-native';
import { t } from '../../../lib/i18n/core';
import { useTheme } from '../../../lib/app-theme';
import { EPA_TYPES, isUniversal, parseYear, SCHEDULE_TYPES, TRADE_ROLES } from '../../../lib/hvac';
import { ChipSelect } from '../../components/chip-select';
import { LocationField } from '../../components/location-field';
import { useSharedStyles } from '../../styles/shared';
import { useT } from '../../../lib/i18n';

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
// (Titles are getters so they follow the current language.)
export const SEEKER_STEPS = [
  {
    key: 'certification',
    get title() {
      return t('seeker.epa.title');
    },
    get subtitle() {
      return t('seeker.epa.subtitle');
    },
  },
  {
    key: 'experience',
    get title() {
      return t('seeker.exp.title');
    },
    get subtitle() {
      return t('seeker.exp.subtitle');
    },
  },
  {
    key: 'where',
    get title() {
      return t('seeker.where.title');
    },
    get subtitle() {
      return t('seeker.where.subtitle');
    },
  },
  {
    key: 'availability',
    get title() {
      return t('seeker.avail.title');
    },
    get subtitle() {
      return t('seeker.avail.subtitle');
    },
  },
] as const;
export type SeekerStep = (typeof SEEKER_STEPS)[number]['key'];

// What stops you moving on from a step, or null when it is fine to continue.
export function seekerStepError(
  step: SeekerStep,
  v: SeekerValues
): { title: string; message: string } | null {
  if (step === 'certification' && v.epaCertified && v.epaTypes.length === 0) {
    return { title: t('seeker.epaErrTitle'), message: t('seeker.epaErrBody') };
  }
  if (step === 'experience' && parseYear(v.startYear) === 'invalid') {
    return {
      title: t('field.invalidYear'),
      message: t('seeker.yearBody'),
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
        title: t('field.invalidYear'),
        message: t('seeker.yearBody'),
      },
    };
  }
  if (v.epaCertified && v.epaTypes.length === 0) {
    return {
      error: {
        title: t('seeker.epaErrTitle'),
        message: t('seeker.epaErrBody'),
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
  const t = useT();
  const c = useTheme().colors;
  const shared = useSharedStyles();

  return (
    <>
      {step === 'certification' && (
        <>
          <ChipSelect
            label={t('seeker.epaCertified')}
            options={['Yes', 'No']}
            selected={[value.epaCertified ? 'Yes' : 'No']}
            onToggle={(o) =>
              onChange({ epaCertified: o === 'Yes', ...(o === 'No' && { epaTypes: [] }) })
            }
          />

          {value.epaCertified && (
            <>
              <ChipSelect
                label={t('seeker.certTypes')}
                options={EPA_TYPES.map((ty) => `Type ${ty}`)}
                selected={value.epaTypes.map((ty) => `Type ${ty}`)}
                onToggle={(o) =>
                  onChange({ epaTypes: toggle(value.epaTypes, o.replace('Type ', '')) })
                }
              />
              {isUniversal(value.epaTypes) && (
                <Text style={shared.chipHint}>{t('seeker.universalHint')}</Text>
              )}
            </>
          )}
        </>
      )}

      {step === 'experience' && (
        <>
          <TextInput
            style={shared.authInput}
            placeholder={t('seeker.yearPlaceholder')}
            placeholderTextColor={c.muted}
            value={value.startYear}
            onChangeText={(startYear) => onChange({ startYear })}
            keyboardType="number-pad"
            maxLength={4}
          />

          <ChipSelect
            label={t('seeker.role')}
            options={TRADE_ROLES}
            selected={value.tradeRole ? [value.tradeRole] : []}
            onToggle={(o) => onChange({ tradeRole: value.tradeRole === o ? '' : o })}
          />
        </>
      )}

      {step === 'where' && (
        <>
          <LocationField
            placeholder={t('seeker.locationPlaceholder')}
            value={{ text: value.location, lat: value.locationLat, lng: value.locationLng }}
            onChange={(p) => onChange({ location: p.text, locationLat: p.lat, locationLng: p.lng })}
          />

          <ChipSelect
            label={t('seeker.license')}
            options={['Yes', 'No']}
            selected={[value.hasLicense ? 'Yes' : 'No']}
            onToggle={(o) => onChange({ hasLicense: o === 'Yes' })}
          />
        </>
      )}

      {step === 'availability' && (
        <>
          <ChipSelect
            label={t('seeker.openTo')}
            options={SCHEDULE_TYPES}
            selected={value.openSchedules}
            onToggle={(o) => onChange({ openSchedules: toggle(value.openSchedules, o) })}
          />
        </>
      )}
    </>
  );
}
