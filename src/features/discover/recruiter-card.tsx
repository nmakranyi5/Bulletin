import { BriefcaseBusiness, MapPin, ShieldCheck } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../lib/app-theme';
import {
  epaMismatchNote,
  experienceMismatchNote,
  formatCompanySize,
  formatEstablished,
  formatPay,
  getSchedules,
} from '../../../lib/hvac';
import { Tag } from '../../components/tag';
import { useSharedStyles } from '../../styles/shared';
import { ExpandableCard } from './expandable-card';

export function RecruiterCardContent({
  recruiter,
  me,
  expanded = false,
  onCollapse,
}: {
  recruiter: any;
  me?: any;
  expanded?: boolean;
  onCollapse?: () => void;
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const local = useLocalStyles();
  const positions = recruiter.positions ?? [];
  const primary = positions[0];
  const schedules = primary ? getSchedules(primary) : [];
  const companyTags = [
    ...(recruiter.work_types ?? []),
    formatCompanySize(recruiter.company_size),
    formatEstablished(recruiter.company_founded_year),
  ].filter(Boolean) as string[];
  const mismatches = [
    epaMismatchNote(primary?.epa_608_required, me?.epa_608_types),
    experienceMismatchNote(primary?.min_experience_years, me?.trade_start_year),
  ].filter(Boolean) as string[];

  const info = (
    <>
      <Text numberOfLines={1} style={shared.name}>
        {recruiter.company_name || recruiter.name}
      </Text>
      {recruiter.company_name ? (
        <Text numberOfLines={1} style={local.contactLine}>
          {recruiter.name}
          {recruiter.recruiter_title ? ` · ${recruiter.recruiter_title}` : ''}
        </Text>
      ) : null}

      <View style={shared.recruiterMeta}>
        <Text numberOfLines={1} style={shared.recruiterTitle}>
          {positions.length} open position{positions.length === 1 ? '' : 's'}
        </Text>
      </View>
    </>
  );

  const headline = (
    <>
      <Text style={shared.sectionLabel}>LOOKING FOR</Text>

      <View style={local.positionRow}>
        <BriefcaseBusiness size={20} color={c.text} strokeWidth={2.2} />
        <Text numberOfLines={1} style={shared.position}>
          {primary?.title ?? 'Position'}
        </Text>
      </View>

      {formatPay(primary ?? {}) ? <Text style={local.pay}>{formatPay(primary)}</Text> : null}

      {primary?.location ? (
        <View style={local.locationRow}>
          <MapPin size={15} color={c.textSecondary} strokeWidth={2} />
          <Text numberOfLines={1} style={local.location}>
            {primary.location}
          </Text>
        </View>
      ) : null}
    </>
  );

  const requirementTags = [
    ...schedules,
    primary?.epa_608_required ? `EPA 608 Type ${primary.epa_608_required}+` : null,
    primary?.min_experience_years ? `${primary.min_experience_years}+ yrs` : null,
  ].filter(Boolean) as string[];

  const brief = (
    <>
      {headline}

      {requirementTags.length > 0 && (
        <View style={shared.tags}>
          {requirementTags.slice(0, 3).map((t) => (
            <Tag key={t} text={t} />
          ))}
          {requirementTags.length > 3 && <Tag text={`+${requirementTags.length - 3} more`} />}
        </View>
      )}

      {mismatches.length > 0 && (
        <Text style={shared.mismatchText}>Heads up: {mismatches.join(' · ')}</Text>
      )}
    </>
  );

  const details = (
    <>
      {headline}

      {requirementTags.length > 0 || primary?.pay_extras?.length ? (
        <View style={shared.tags}>
          {requirementTags.map((t) => (
            <Tag key={t} text={t} />
          ))}
          {(primary?.pay_extras ?? []).map((extra: string) => (
            <Tag key={extra} text={extra} />
          ))}
        </View>
      ) : null}

      {mismatches.length > 0 && (
        <Text style={shared.mismatchText}>Heads up: {mismatches.join(' · ')}</Text>
      )}

      {primary?.description ? (
        <Text style={shared.note}>"{primary.description}"</Text>
      ) : null}

      {positions.length > 1 && (
        <>
          <Text style={[shared.sectionLabel, { marginTop: 22 }]}>ALL OPEN POSITIONS</Text>
          <View style={[shared.tags, { marginTop: 10 }]}>
            {positions.map((p: any) => (
              <Tag key={p.id} text={p.title} />
            ))}
          </View>
        </>
      )}

      {!!(
        companyTags.length ||
        recruiter.licensed_insured ||
        recruiter.location ||
        recruiter.description
      ) && (
        <>
          <Text style={[shared.sectionLabel, { marginTop: 22 }]}>ABOUT THE COMPANY</Text>

          {!!(companyTags.length || recruiter.licensed_insured) && (
            <View style={[shared.tags, { marginTop: 10 }]}>
              {recruiter.licensed_insured ? (
                <View style={local.trustTag}>
                  <ShieldCheck size={13} color={c.green} strokeWidth={2.4} />
                  <Text style={local.trustTagText}>Licensed & insured</Text>
                </View>
              ) : null}
              {companyTags.map((t) => (
                <Tag key={t} text={t} />
              ))}
            </View>
          )}

          {recruiter.location ? (
            <View style={local.locationRow}>
              <MapPin size={15} color={c.textSecondary} strokeWidth={2} />
              <Text numberOfLines={1} style={local.location}>
                Serves {recruiter.location}
              </Text>
            </View>
          ) : null}

          {recruiter.description ? (
            <Text style={[shared.note, { marginTop: 12 }]}>{recruiter.description}</Text>
          ) : null}
        </>
      )}
    </>
  );

  return (
    <ExpandableCard
      avatarUrl={recruiter.avatar_url}
      info={info}
      expanded={expanded}
      onCollapse={onCollapse}
      brief={brief}
      details={details}
    />
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        contactLine: {
          marginTop: 2,
          fontSize: 13,
          color: c.textSecondary,
        },

        trustTag: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingHorizontal: 11,
          paddingVertical: 7,
          borderRadius: 20,
          backgroundColor: c.surfaceAlt,
          borderWidth: 1,
          borderColor: c.green,
        },

        trustTagText: {
          fontSize: 12,
          fontWeight: '600',
          color: c.textStrong,
        },

        positionRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginTop: 9,
        },

        pay: {
          marginTop: 9,
          fontSize: 19,
          fontWeight: '700',
          color: c.text,
        },

        locationRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          marginTop: 8,
        },

        location: {
          flex: 1,
          fontSize: 14,
          color: c.textSecondary,
        },
      }),
    [c]
  );
}
