import { TextInput } from 'react-native';
import { useTheme } from '../../../lib/app-theme';
import { COMPANY_SIZES, parseYear, RECRUITER_TITLES, WORK_TYPES } from '../../../lib/hvac';
import { ChipSelect } from '../../components/chip-select';
import { useSharedStyles } from '../../styles/shared';

export type RecruiterValues = {
  companyName: string;
  recruiterTitle: string;
  companySize: string;
  workTypes: string[];
  foundedYear: string;
  location: string;
  licensedInsured: boolean;
};

export const emptyRecruiter: RecruiterValues = {
  companyName: '',
  recruiterTitle: '',
  companySize: '',
  workTypes: [],
  foundedYear: '',
  location: '',
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
      licensed_insured: v.licensedInsured,
    },
  };
}

const toggle = (list: string[], o: string) =>
  list.includes(o) ? list.filter((x) => x !== o) : [...list, o];

export function RecruiterFields({
  value,
  onChange,
}: {
  value: RecruiterValues;
  onChange: (patch: Partial<RecruiterValues>) => void;
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();

  return (
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

      <ChipSelect
        label="TYPE OF WORK (SELECT ALL THAT APPLY)"
        options={WORK_TYPES}
        selected={value.workTypes}
        onToggle={(o) => onChange({ workTypes: toggle(value.workTypes, o) })}
      />

      <TextInput
        style={shared.authInput}
        placeholder="Service area (e.g. Austin, TX)"
        placeholderTextColor={c.muted}
        value={value.location}
        onChangeText={(location) => onChange({ location })}
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
  );
}
