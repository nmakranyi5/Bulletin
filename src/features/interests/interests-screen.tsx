import { Handshake, UserRound, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../lib/app-theme';
import { epaMismatchNote, experienceMismatchNote } from '../../../lib/hvac';
import { MAX_INTERESTS } from '../../constants/app';
import { useSharedStyles } from '../../styles/shared';
import { InterestRow } from '../../types';

export function InterestsScreen({
  sentInterests,
  receivedInterests,
  onReceivedPress,
  onWithdraw,
  interestsRemaining,
}: {
  sentInterests: InterestRow[];
  receivedInterests: InterestRow[];
  onReceivedPress: (interest: InterestRow) => void;
  onWithdraw: (interest: InterestRow) => void;
  interestsRemaining: number;
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const local = useLocalStyles();
  const [subTab, setSubTab] = useState<'sent' | 'received'>('received');

  return (
    <View style={shared.simpleScreen}>
      <View style={shared.screenHeader}>
        <Text style={shared.screenTitle}>bulletin.</Text>
        <Text style={shared.subtitle}>
          Explore your interests. {interestsRemaining} of {MAX_INTERESTS} left.
        </Text>
      </View>

      <View style={shared.subTabBar}>
        <Pressable
          style={[shared.subTabItem, subTab === 'received' && shared.subTabItemActive]}
          onPress={() => setSubTab('received')}
        >
          <Text
            style={[shared.subTabText, subTab === 'received' && shared.subTabTextActive]}
          >
            Received ({receivedInterests.length})
          </Text>
        </Pressable>

        <Pressable
          style={[shared.subTabItem, subTab === 'sent' && shared.subTabItemActive]}
          onPress={() => setSubTab('sent')}
        >
          <Text
            style={[shared.subTabText, subTab === 'sent' && shared.subTabTextActive]}
          >
            Sent ({sentInterests.length})
          </Text>
        </Pressable>
      </View>

      {subTab === 'received' ? (
        receivedInterests.length === 0 ? (
          <View style={shared.emptyState}>
            <Handshake size={48} color={c.muted} strokeWidth={1.5} />
            <Text style={shared.emptyTitle}>No interests yet</Text>
            <Text style={shared.emptySubtitle}>
              People who show interest in you will show up here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={receivedInterests}
            keyExtractor={(item) => item.id}
            contentContainerStyle={shared.interestsList}
            renderItem={({ item }) => (
              <Pressable style={shared.interestRow} onPress={() => onReceivedPress(item)}>
                <UserRound size={40} color={c.muted} strokeWidth={1.5} />
                <View style={shared.interestRowInfo}>
                  <Text numberOfLines={1} style={shared.interestRowName}>
                    {item.from_profile?.name ?? 'Unknown'}
                  </Text>
                  <Text numberOfLines={1} style={shared.interestRowMeta}>
                    @{item.from_profile?.username ?? 'unknown'}
                    {item.position?.title ? ` · ${item.position.title}` : ' · General'}
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
                        Heads up: {notes.join(' · ')}
                      </Text>
                    ) : null;
                  })()}
                </View>
              </Pressable>
            )}
          />
        )
      ) : sentInterests.length === 0 ? (
        <View style={shared.emptyState}>
          <Handshake size={48} color={c.muted} strokeWidth={1.5} />
          <Text style={shared.emptyTitle}>No interests yet</Text>
          <Text style={shared.emptySubtitle}>
            Swipe right on Discover to start expressing interest.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sentInterests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={shared.interestsList}
          renderItem={({ item }) => (
            <View style={shared.interestRow}>
              <UserRound size={40} color={c.muted} strokeWidth={1.5} />
              <View style={shared.interestRowInfo}>
                <Text numberOfLines={1} style={shared.interestRowName}>
                  {item.to_profile?.name ?? 'Unknown'}
                </Text>
                <Text numberOfLines={1} style={shared.interestRowMeta}>
                  {item.status === 'pending'
                    ? 'Pending'
                    : item.status === 'accepted'
                    ? 'Matched'
                    : item.status === 'closed'
                    ? 'Chat closed'
                    : 'Not interested'}
                  {item.position?.title ? ` · ${item.position.title}` : ' · General'}
                </Text>
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
            </View>
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
        interestRowAction: {
          padding: 6,
        },
      }),
    [c]
  );
}
