import { TextInput } from 'react-native';
import { useTheme } from '../../../lib/app-theme';
import { COMPANY_SIZES, parseYear, RECRUITER_TITLES, WORK_TYPES } from '../../../lib/hvac';
import { ChipSelect } from '../../components/chip-select';
import { LocationField } from '../../components/location-field';
import { useSharedStyles } from '../../styles/shared';

export type RecruiterValues = {
  companyName: string;
  recruiterTitle: string;
  companySize: string;
  workTypes: string[];
  foundedYear: string;
  location: string;
  locationLat: number | null;
  locationLng: number | null;
  licensedInsured: boolean;
};

// Setup walks through these one screen at a time (editing shows them all together).
export const RECRUITER_STEPS = [
  { key: 'company', title: 'Your company', subtitle: 'Who candidates will be hearing from.' },
  { key: 'work', title: 'What you do', subtitle: 'The kind of work your crews take on.' },
  {
    key: 'area',
    title: 'Where you work',
    subtitle: 'Your service area, so nearby techs can find you.',
  },
] as const;
export type RecruiterStep = (typeof RECRUITER_STEPS)[number]['key'];

// What stops you moving on from a step, or null when it is fine to continue.
export function recruiterStepError(
  step: RecruiterStep,
  v: RecruiterValues
): { title: string; message: string } | null {
  if (step === 'company' && !v.companyName.trim()) {
    return { title: 'Missing info', message: 'Company name is required.' };
  }
  if (step === 'work' && parseYear(v.foundedYear, 1800) === 'invalid') {
    return {
      title: 'Invalid year',
      message: 'Enter the four-digit year your company was established, e.g. 2005.',
    };
  }
  return null;
}

export const emptyRecruiter: RecruiterValues = {
  companyName: '',
  recruiterTitle: '',
  companySize: '',
  workTypes: [],
  foundedYear: '',
  location: '',
  locationLat: null,
  locationLng: null,
  licensedInsured: false,
};

export function recruiterFromRow(row: any): RecruiterValues {
  return {
    companyName: row.company_name ?? '',
    recruiterTitle: row.recruiter_title ?? '',
    companySize: row.company_size ?? '',
    workTypes: row.work_types ?? [],
    foundedYear: row.company_founded_year ? String(row.company_founded_year) : '',
    location: row.location ?? '',
    locationLat: typeof row.location_lat === 'number' ? row.location_lat : null,
    locationLng: typeof row.location_lng === 'number' ? row.location_lng : null,
    licensedInsured: !!row.licensed_insured,
  };
}

export function buildRecruiterPayload(
  v: RecruiterValues
): { payload: Record<string, unknown> } | { error: { title: string; message: string } } {
  if (!v.companyName.trim()) {
    return { error: { title: 'Missing info', message: 'Company name is required.' } };
  }
  const year = parseYear(v.foundedYear, 1800);
  if (year === 'invalid') {
    return {
      error: {
        title: 'Invalid year',
        message: 'Enter the four-digit year your company was established, e.g. 2005.',
      },
    };
  }
  return {
    payload: {
      company_name: v.companyName.trim(),
      recruiter_title: v.recruiterTitle || null,
      company_size: v.companySize || null,
      work_types: v.workTypes,
      company_founded_year: year,
      location: v.location.trim() || null,
      ...(v.location.trim()
        ? { location_lat: v.locationLat, location_lng: v.locationLng }
        : { location_lat: null, location_lng: null }),
      licensed_insured: v.licensedInsured,
    },
  };
}

const toggle = (list: string[], o: string) =>
  list.includes(o) ? list.filter((x) => x !== o) : [...list, o];

export function RecruiterFields({
  value,
  onChange,
  step,
}: {
  value: RecruiterValues;
  onChange: (patch: Partial<RecruiterValues>) => void;
  step: RecruiterStep;
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();

  return (
    <>
      {step === 'company' && (
        <>
          <TextInput
            style={shared.authInput}
            placeholder="Company name"
            placeholderTextColor={c.muted}
            value={value.companyName}
            onChangeText={(companyName) => onChange({ companyName })}
          />

          <ChipSelect
            label="YOUR ROLE AT THE COMPANY"
            options={RECRUITER_TITLES}
            selected={value.recruiterTitle ? [value.recruiterTitle] : []}
            onToggle={(o) => onChange({ recruiterTitle: value.recruiterTitle === o ? '' : o })}
          />

          <ChipSelect
            label="COMPANY SIZE"
            options={COMPANY_SIZES.map((s) => `${s}`)}
            selected={value.companySize ? [value.companySize] : []}
            onToggle={(o) => onChange({ companySize: value.companySize === o ? '' : o })}
          />
        </>
      )}

      {step === 'work' && (
        <>
          <ChipSelect
            label="TYPE OF WORK (SELECT ALL THAT APPLY)"
            options={WORK_TYPES}
            selected={value.workTypes}
            onToggle={(o) => onChange({ workTypes: toggle(value.workTypes, o) })}
          />

          <TextInput
            style={shared.authInput}
            placeholder="Year established (e.g. 2005)"
            placeholderTextColor={c.muted}
            value={value.foundedYear}
            onChangeText={(foundedYear) => onChange({ foundedYear })}
            keyboardType="number-pad"
            maxLength={4}
          />

          <ChipSelect
            label="LICENSED & INSURED?"
            options={['Yes', 'No']}
            selected={[value.licensedInsured ? 'Yes' : 'No']}
            onToggle={(o) => onChange({ licensedInsured: o === 'Yes' })}
          />
        </>
      )}

      {step === 'area' && (
        <>
          <LocationField
            placeholder="Service area (e.g. Austin, TX)"
            value={{ text: value.location, lat: value.locationLat, lng: value.locationLng }}
            onChange={(p) => onChange({ location: p.text, locationLat: p.lat, locationLng: p.lng })}
          />
        </>
      )}
    </>
  );
}
