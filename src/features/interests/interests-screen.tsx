import { Handshake, Trash2, X } from 'lucide-react-native';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../lib/app-theme';
import { reasonLabel } from '../../../lib/decline-reasons';
import { epaMismatchNote, experienceMismatchNote } from '../../../lib/hvac';
import { timerStatus, urgencyOf } from '../../../lib/response-timers';
import { Avatar } from '../../components/avatar';
import { RefreshableEmpty } from '../../components/refreshable-empty';
import { TimerChip } from '../../components/timer-chip';
import { useNow } from '../../hooks/use-now';
import { useRefreshControl } from '../../hooks/use-refresh-control';
import { MAX_INTERESTS } from '../../constants/app';
import { useSharedStyles } from '../../styles/shared';
import { InterestRow } from '../../types';
import { useT } from '../../../lib/i18n';

export function InterestsScreen({
  sentInterests,
  receivedInterests,
  onViewProfile,
  onWithdraw,
  onRemoveDeclined,
  interestsRemaining,
  subTab,
  onSubTabChange,
  onRefresh,
}: {
  sentInterests: InterestRow[];
  receivedInterests: InterestRow[];
  // Opens the other person's full card. `received` shows Accept / Decline there.
  onViewProfile: (interest: InterestRow, direction: 'sent' | 'received') => void;
  onWithdraw: (interest: InterestRow) => void;
  // Clears a declined interest from the list.
  onRemoveDeclined: (interest: InterestRow) => void;
  interestsRemaining: number;
  // Which list is showing. Owned by the parent so it survives switching tabs.
  subTab: 'sent' | 'received';
  onSubTabChange: (tab: 'sent' | 'received') => void;
  // Pull-to-refresh: reload interests (and matches); resolves when done.
  onRefresh: () => Promise<unknown> | void;
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const t = useT();
  const local = useLocalStyles();
  const now = useNow();
  const refreshControl = useRefreshControl(onRefresh);

  return (
    <View style={shared.simpleScreen}>
      <View style={shared.screenHeader}>
        <Text style={shared.screenTitle}>bulletin.</Text>
        <Text style={shared.subtitle}>
          {t('interests.subtitle', { left: interestsRemaining, max: MAX_INTERESTS })}
        </Text>
      </View>

      <View style={shared.subTabBar}>
        <Pressable
          style={[shared.subTabItem, subTab === 'received' && shared.subTabItemActive]}
          onPress={() => onSubTabChange('received')}
        >
          <Text
            style={[shared.subTabText, subTab === 'received' && shared.subTabTextActive]}
          >
            {t('interests.received', { count: receivedInterests.length })}
          </Text>
        </Pressable>

        <Pressable
          style={[shared.subTabItem, subTab === 'sent' && shared.subTabItemActive]}
          onPress={() => onSubTabChange('sent')}
        >
          <Text
            style={[shared.subTabText, subTab === 'sent' && shared.subTabTextActive]}
          >
            {t('interests.sent', { count: sentInterests.length })}
          </Text>
        </Pressable>
      </View>

      {subTab === 'received' ? (
        receivedInterests.length === 0 ? (
<RefreshableEmpty refreshControl={refreshControl}>
          <View style={shared.emptyState}>
            <Handshake size={48} color={c.muted} strokeWidth={1.5} />
            <Text style={shared.emptyTitle}>{t('interests.emptyTitle')}</Text>
            <Text style={shared.emptySubtitle}>
              {t('interests.emptyReceived')}
            </Text>
          </View>
</RefreshableEmpty>
        ) : (
          <FlatList
            data={receivedInterests}
            keyExtractor={(item) => item.id}
            refreshControl={refreshControl}
            contentContainerStyle={shared.interestsList}
            renderItem={({ item }) => (
              <Pressable style={shared.interestRow} onPress={() => onViewProfile(item, 'received')}>
                <Avatar uri={item.from_profile?.avatar_url} />
                <View style={shared.interestRowInfo}>
                  <Text numberOfLines={1} style={shared.interestRowName}>
                    {item.from_profile?.name ?? t('interests.unknown')}
                  </Text>
                  <Text numberOfLines={1} style={shared.interestRowMeta}>
                    @{item.from_profile?.username ?? t('interests.unknownUser')}
                    {item.position?.title ? ` · ${item.position.title}` : ` · ${t('interests.general')}`}
                  </Text>
                  {(() => {
                    const notes = [
                      epaMismatchNote(
                        item.position?.epa_608_required,
                        item.from_profile?.epa_608_types
                      ),
                      experienceMismatchNote(
                        item.position?.min_experience_years,
                        item.from_profile?.trade_start_year
                      ),
                    ].filter(Boolean);
                    return notes.length > 0 ? (
                      <Text numberOfLines={1} style={shared.mismatchText}>
                        {t('discover.headsUp', { notes: notes.join(' · ') })}
                      </Text>
                    ) : null;
                  })()}
                  {item.created_at ? (
                    <TimerChip
                      side="responder"
                      status={timerStatus(item.created_at, urgencyOf(item.position), now)}
                    />
                  ) : null}
                </View>
              </Pressable>
            )}
          />
        )
      ) : sentInterests.length === 0 ? (
<RefreshableEmpty refreshControl={refreshControl}>
        <View style={shared.emptyState}>
          <Handshake size={48} color={c.muted} strokeWidth={1.5} />
          <Text style={shared.emptyTitle}>{t('interests.emptyTitle')}</Text>
          <Text style={shared.emptySubtitle}>
            {t('interests.emptySent')}
          </Text>
        </View>
</RefreshableEmpty>
      ) : (
        <FlatList
          data={sentInterests}
          keyExtractor={(item) => item.id}
          refreshControl={refreshControl}
          contentContainerStyle={shared.interestsList}
          renderItem={({ item }) => (
            <Pressable style={shared.interestRow} onPress={() => onViewProfile(item, 'sent')}>
              <Avatar uri={item.to_profile?.avatar_url} />
              <View style={shared.interestRowInfo}>
                <Text numberOfLines={1} style={shared.interestRowName}>
                  {item.to_profile?.name ?? t('interests.unknown')}
                </Text>
                <Text numberOfLines={1} style={shared.interestRowMeta}>
                  {item.status === 'pending'
                    ? t('interests.pending')
                    : item.status === 'accepted'
                    ? t('interests.matched')
                    : t('interests.declined')}
                  {item.position?.title ? ` · ${item.position.title}` : ` · ${t('interests.general')}`}
                </Text>
                {item.status === 'rejected' && (
                  <View style={local.declineBox}>
                    <Text style={local.declineReason}>
                      {reasonLabel(item.decline_reason)
                        ? t('interests.reason', { reason: reasonLabel(item.decline_reason) })
                        : t('interests.noReason')}
                    </Text>
                    {item.decline_note ? (
                      <Text style={local.declineNote}>"{item.decline_note}"</Text>
                    ) : null}
                  </View>
                )}
                {item.status === 'pending' && item.created_at ? (
                  <TimerChip
                    side="waiting"
                    status={timerStatus(item.created_at, urgencyOf(item.position), now)}
                  />
                ) : null}
              </View>
              {item.status === 'pending' && (
                <Pressable
                  hitSlop={10}
                  style={local.interestRowAction}
                  onPress={() => onWithdraw(item)}
                >
                  <X size={18} color={c.textSecondary} strokeWidth={2.2} />
                </Pressable>
              )}
              {item.status === 'rejected' && (
                <Pressable
                  hitSlop={10}
                  style={local.interestRowAction}
                  onPress={() => onRemoveDeclined(item)}
                  accessibilityRole="button"
                  accessibilityLabel={t('interests.removeDeclined')}
                >
                  <Trash2 size={18} color={c.textSecondary} strokeWidth={2.2} />
                </Pressable>
              )}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        declineBox: {
          marginTop: 8,
          paddingLeft: 10,
          borderLeftWidth: 3,
          borderLeftColor: c.border,
          gap: 3,
        },

        declineReason: {
          fontSize: 13,
          fontWeight: '700',
          color: c.textStrong,
        },

        declineNote: {
          fontSize: 13,
          lineHeight: 18,
          fontStyle: 'italic',
          color: c.textSecondary,
        },

        interestRowAction: {
          padding: 6,
        },
      }),
    [c]
  );
}
