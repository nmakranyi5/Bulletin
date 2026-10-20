import { FileText, MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../../../lib/app-theme';
import { formatTradeStart, formatWorkerEpa } from '../../../lib/hvac';
import { ResumeViewerModal } from '../../components/resume-viewer-modal';
import { RatingBadge } from '../../components/rating-badge';
import { VerifiedBadge } from '../../components/verified-badge';
import { Tag } from '../../components/tag';
import { useSharedStyles } from '../../styles/shared';
import { ExpandableCard } from './expandable-card';

export function WorkerCardContent({
  candidate,
  expanded = false,
  modal = false,
  onCollapse,
}: {
  candidate: any;
  expanded?: boolean;
  // Shown in the profile popup instead of Discover: header gets a close button.
  modal?: boolean;
  onCollapse?: () => void;
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const [resumeOpen, setResumeOpen] = useState(false);

  const info = (
    <>
      <Text
        numberOfLines={modal ? 2 : 1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={[shared.name, modal && { fontSize: 26, lineHeight: 30 }]}
      >
        {candidate.name}
      </Text>

      <View style={shared.recruiterMeta}>
        <Text numberOfLines={1} style={shared.recruiterTitle}>
          @{candidate.username}
        </Text>
      </View>
      <RatingBadge rating={candidate.rating} />
      <VerifiedBadge verifiedAt={candidate.phone_verified_at} />
    </>
  );

  const basics = (
    <>
      <Text style={shared.sectionLabel}>EPA 608</Text>
      {/* shared.position is flex: 1 for rows; don't let it stretch in this column. */}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={[shared.position, { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' }]}
      >
        {formatWorkerEpa(candidate.epa_608_types)}
      </Text>
    </>
  );

  const location = candidate.location ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 }}>
      <MapPin size={15} color={c.textSecondary} strokeWidth={2} />
      <Text numberOfLines={1} style={[shared.note, { marginTop: 0, flex: 1, fontSize: 14 }]}>
        {candidate.location}
      </Text>
    </View>
  ) : null;

  const brief = (
    <>
      {basics}

      {!!(candidate.trade_role || candidate.trade_start_year) && (
        <View style={shared.tags}>
          {candidate.trade_role ? <Tag text={candidate.trade_role} /> : null}
          {candidate.trade_start_year ? (
            <Tag text={formatTradeStart(candidate.trade_start_year)!} />
          ) : null}
        </View>
      )}

      {location}

      {candidate.description ? (
        <Text numberOfLines={3} style={shared.note}>
          {candidate.description}
        </Text>
      ) : null}
    </>
  );

  const details = (
    <>
      {basics}

      {!!(candidate.trade_role || candidate.trade_start_year || candidate.has_drivers_license) && (
        <View style={shared.tags}>
          {candidate.trade_role ? <Tag text={candidate.trade_role} /> : null}
          {candidate.trade_start_year ? (
            <Tag text={formatTradeStart(candidate.trade_start_year)!} />
          ) : null}
          {candidate.has_drivers_license ? <Tag text="Valid driver's license" /> : null}
        </View>
      )}

      {location}

      {(candidate.open_schedules ?? []).length > 0 && (
        <>
          <Text style={[shared.sectionLabel, { marginTop: 18 }]}>OPEN TO</Text>
          <View style={[shared.tags, { marginTop: 8 }]}>
            {candidate.open_schedules.map((s: string) => (
              <Tag key={s} text={s} />
            ))}
          </View>
        </>
      )}

      <Text style={[shared.sectionLabel, { marginTop: 18 }]}>ABOUT</Text>
      <Text style={[shared.note, { marginTop: 8 }]}>
        {candidate.description || 'No description provided.'}
      </Text>

      {candidate.resume_url ? (
        <>
          <Pressable
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 18,
              paddingVertical: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: c.borderStrong,
            }}
            onPress={() => setResumeOpen(true)}
            accessibilityRole="button"
          >
            <FileText size={18} color={c.text} strokeWidth={2.2} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>View resume</Text>
          </Pressable>
          <ResumeViewerModal
            visible={resumeOpen}
            url={candidate.resume_url}
            name={candidate.name}
            onClose={() => setResumeOpen(false)}
          />
        </>
      ) : null}
    </>
  );

  return (
    <ExpandableCard
      avatarUrl={candidate.avatar_url}
      info={info}
      expanded={expanded}
      modal={modal}
      onCollapse={onCollapse}
      brief={brief}
      details={details}
    />
  );
}
