import { UserRound } from 'lucide-react-native';
import { Image, Text, View } from 'react-native';
import { useTheme } from '../../../lib/app-theme';
import { formatTradeStart, formatWorkerEpa } from '../../../lib/hvac';
import { Tag } from '../../components/tag';
import { useSharedStyles } from '../../styles/shared';

export function WorkerCardContent({ candidate }: { candidate: any }) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  return (
    <>
      <View style={shared.profileSection}>
        {candidate.avatar_url ? (
          <Image source={{ uri: candidate.avatar_url }} style={shared.cardAvatarPreview} />
        ) : (
          <UserRound size={92} color={c.muted} strokeWidth={1.5} />
        )}

        <View style={shared.profileInfo}>
          <Text numberOfLines={1} style={shared.name}>
            {candidate.name}
          </Text>

          <View style={shared.recruiterMeta}>
            <Text numberOfLines={1} style={shared.recruiterTitle}>
              @{candidate.username}
            </Text>
          </View>
        </View>
      </View>

      <View style={shared.content}>
        <Text style={shared.sectionLabel}>EPA 608</Text>
        <Text style={shared.position}>{formatWorkerEpa(candidate.epa_608_types)}</Text>

        {!!(candidate.trade_role || candidate.trade_start_year) && (
          <View style={shared.tags}>
            {candidate.trade_role ? <Tag text={candidate.trade_role} /> : null}
            {candidate.trade_start_year ? (
              <Tag text={formatTradeStart(candidate.trade_start_year)!} />
            ) : null}
          </View>
        )}

        <Text style={[shared.sectionLabel, { marginTop: 18 }]}>ABOUT</Text>
        <Text style={shared.note}>{candidate.description || 'No description provided.'}</Text>
      </View>
    </>
  );
}
