import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { supabase } from '../../../lib/supabase';
import { MAX_INTERESTS } from '../../constants/app';
import { InterestRow } from '../../types';

export function useInterests(
  session: Session | null,
  enabled: boolean,
  callbacks: { onAccepted: () => void; onWithdrawn: () => void }
) {
  const [sentInterests, setSentInterests] = useState<InterestRow[]>([]);
  const [receivedInterests, setReceivedInterests] = useState<InterestRow[]>([]);

  // Only pending sent interests hold a slot. Once one becomes a match it moves to
  // Messages and the slot is returned.
  const visibleSentInterests = sentInterests.filter((i) => i.status !== 'accepted');
  const activeSentCount = sentInterests.filter((i) => i.status === 'pending').length;
  const interestsRemaining = Math.max(0, MAX_INTERESTS - activeSentCount);
  const unseenReceivedCount = receivedInterests.length;

  const fetchInterests = async () => {
    if (!session) return;

    const { data: sent, error: sentError } = await supabase
      .from('interests')
      .select(
        '*, to_profile:profiles!to_user(id, name, username), position:positions(id, title, company)'
      )
      .eq('from_user', session.user.id);

    if (sentError) Alert.alert('Error', sentError.message);
    else setSentInterests(sent ?? []);

    const { data: received, error: receivedError } = await supabase
      .from('interests')
      .select(
        '*, from_profile:profiles!from_user(id, name, username, epa_608_types, trade_start_year), position:positions(id, title, company, epa_608_required, min_experience_years)'
      )
      .eq('to_user', session.user.id)
      .eq('status', 'pending');

    if (receivedError) Alert.alert('Error', receivedError.message);
    else setReceivedInterests(received ?? []);
  };

  useEffect(() => {
    if (enabled) fetchInterests();
  }, [session, enabled]);

  const sendInterest = async (toUserId: string, positionId: string | null) => {
    if (!session) return;

    const { error } = await supabase.from('interests').insert({
      from_user: session.user.id,
      to_user: toUserId,
      position_id: positionId,
    });

    if (error && error.code !== '23505') {
      // 23505 = unique violation (already sent) — safe to ignore silently
      Alert.alert('Error', error.message);
    } else {
      fetchInterests();
    }
  };

  const respondToInterest = async (interestId: string, status: 'accepted' | 'rejected') => {
    const { error } = await supabase
      .from('interests')
      .update({ status })
      .eq('id', interestId);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setReceivedInterests((prev) => prev.filter((r) => r.id !== interestId));

    if (status === 'accepted') {
      callbacks.onAccepted();
      fetchInterests();
    }
  };

  const withdrawInterest = (interest: InterestRow) => {
    Alert.alert(
      'Remove interest?',
      `This takes back your interest in ${interest.to_profile?.name ?? 'this person'} and gives you the slot back.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const { data, error } = await supabase
              .from('interests')
              .delete()
              .eq('id', interest.id)
              .eq('status', 'pending')
              .select('id');

            if (error) {
              Alert.alert('Error', error.message);
              return;
            }
            if (!data || data.length === 0) {
              Alert.alert('Could not remove', 'This interest was already answered.');
            }

            fetchInterests();
            callbacks.onWithdrawn();
          },
        },
      ]
    );
  };

  const handleReceivedPress = (interest: InterestRow) => {
    const name = interest.from_profile?.name ?? 'Someone';
    const positionText = interest.position?.title
      ? ` about ${interest.position.title}`
      : '';

    Alert.alert(
      name,
      `${name} is interested in connecting${positionText}.`,
      [
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => respondToInterest(interest.id, 'rejected'),
        },
        {
          text: 'Accept',
          style: 'default',
          onPress: () => respondToInterest(interest.id, 'accepted'),
        },
      ]
    );
  };

  return {
    visibleSentInterests,
    receivedInterests,
    interestsRemaining,
    unseenReceivedCount,
    fetchInterests,
    sendInterest,
    withdrawInterest,
    handleReceivedPress,
  };
}
