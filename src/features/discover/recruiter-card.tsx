import { BriefcaseBusiness, MapPin, ShieldCheck, UserRound } from 'lucide-react-native';
import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
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

export function RecruiterCardContent({ recruiter, me }: { recruiter: any; me?: any }) {
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

  return (
    <>
      <View style={shared.profileSection}>
        {recruiter.avatar_url ? (
          <Image source={{ uri: recruiter.avatar_url }} style={shared.cardAvatarPreview} />
        ) : (
          <UserRound size={92} color={c.muted} strokeWidth={1.5} />
        )}

        <View style={shared.profileInfo}>
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
        </View>
      </View>

      <View style={shared.content}>
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

        {!!(
          schedules.length ||
          primary?.epa_608_required ||
          primary?.min_experience_years ||
          primary?.pay_extras?.length
        ) && (
          <View style={shared.tags}>
            {schedules.map((s) => (
              <Tag key={s} text={s} />
            ))}
            {primary.epa_608_required ? (
              <Tag text={`EPA 608 Type ${primary.epa_608_required}+`} />
            ) : null}
            {primary.min_experience_years ? (
              <Tag text={`${primary.min_experience_years}+ yrs`} />
            ) : null}
            {(primary.pay_extras ?? []).map((extra: string) => (
              <Tag key={extra} text={extra} />
            ))}
          </View>
        )}

        {mismatches.length > 0 && (
          <Text style={shared.mismatchText}>Heads up: {mismatches.join(' · ')}</Text>
        )}

        <View style={shared.tags}>
          {positions.slice(0, 4).map((p: any) => (
            <Tag key={p.id} text={p.title} />
          ))}
        </View>

        {primary?.description ? (
          <Text style={shared.note}>"{primary.description}"</Text>
        ) : null}

        {!!(companyTags.length || recruiter.licensed_insured || recruiter.location || recruiter.description) && (
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
      </View>
    </>
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
