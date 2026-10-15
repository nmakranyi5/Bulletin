import { MapPin } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { useTheme } from '../../../lib/app-theme';
import { formatTradeStart, formatWorkerEpa } from '../../../lib/hvac';
import { Tag } from '../../components/tag';
import { useSharedStyles } from '../../styles/shared';
import { ExpandableCard } from './expandable-card';

export function WorkerCardContent({
  candidate,
  expanded = false,
  onCollapse,
}: {
  candidate: any;
  expanded?: boolean;
  onCollapse?: () => void;
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();

  const info = (
    <>
      <Text numberOfLines={1} style={shared.name}>
        {candidate.name}
      </Text>

      <View style={shared.recruiterMeta}>
        <Text numberOfLines={1} style={shared.recruiterTitle}>
          @{candidate.username}
        </Text>
      </View>
    </>
  );

  const basics = (
    <>
      <Text style={shared.sectionLabel}>EPA 608</Text>
      <Text style={shared.position}>{formatWorkerEpa(candidate.epa_608_types)}</Text>
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
    </>
  );

  return (
    <ExpandableCard
      avatarUrl={candidate.avatar_url}
      info={info}
      expanded={expanded}
      onCollapse={onCollapse}
      brief={brief}
      details={details}
    />
  );
}
