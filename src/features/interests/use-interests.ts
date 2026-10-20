import { Session } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { DeclineReason } from '../../../lib/decline-reasons';
import { supabase } from '../../../lib/supabase';
import { MAX_INTERESTS } from '../../constants/app';
import { InterestRow } from '../../types';

export function useInterests(
  session: Session | null,
  enabled: boolean,
  callbacks: { onAccepted: () => void; onWithdrawn: () => void },
  // Decides which reasons are offered when declining.
  isRecruiter: boolean
) {
  const [sentInterests, setSentInterests] = useState<InterestRow[]>([]);
  const [receivedInterests, setReceivedInterests] = useState<InterestRow[]>([]);
  // True once the first fetch has finished, so "new" can be told apart from "not loaded yet".
  const [loaded, setLoaded] = useState(false);
  // The interest the user is currently declining (shows the reason picker).
  const [decliningInterest, setDecliningInterest] = useState<InterestRow | null>(null);

  // Only pending sent interests hold a slot. Once one becomes a match it moves to
  // Messages (Active, then Archived when closed) and the slot is returned. An interest
  // whose position closed is returned too and leaves the list (you're told once).
  const visibleSentInterests = sentInterests.filter(
    (i) => i.status !== 'accepted' && i.status !== 'closed' && i.status !== 'position_closed'
  );
  const activeSentCount = sentInterests.filter((i) => i.status === 'pending').length;
  const interestsRemaining = Math.max(0, MAX_INTERESTS - activeSentCount);
  const unseenReceivedCount = receivedInterests.length;

  // `silent` is for background refreshes: don't pop an error alert every minute offline.
  // Only the newest fetch is applied: sending several interests at once starts overlapping
  // fetches, and an older one finishing last must not overwrite the newer result.
  const fetchSeq = useRef(0);

  const fetchInterests = async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    if (!session) return;
    const seq = ++fetchSeq.current;

    // Positions past their close date close now, returning interests still waiting on them.
    await supabase.rpc('close_expired_positions');

    const { data: sent, error: sentError } = await supabase
      .from('interests')
      .select(
        '*, to_profile:profiles!to_user(id, name, username, avatar_url), position:positions(id, title, company, urgency)'
      )
      .eq('from_user', session.user.id);

    if (seq !== fetchSeq.current) return;
    if (sentError) {
      if (!silent) Alert.alert('Error', sentError.message);
    } else {
      // Declined interests the sender has removed stay on record but out of sight.
      setSentInterests((sent ?? []).filter((i: InterestRow) => !i.sender_hidden));
      setLoaded(true);
    }

    const { data: received, error: receivedError } = await supabase
      .from('interests')
      .select(
        '*, from_profile:profiles!from_user(id, name, username, avatar_url, epa_608_types, trade_start_year), position:positions(id, title, company, epa_608_required, min_experience_years, urgency)'
      )
      .eq('to_user', session.user.id)
      .eq('status', 'pending');

    if (seq !== fetchSeq.current) return;
    if (receivedError) {
      if (!silent) Alert.alert('Error', receivedError.message);
    } else setReceivedInterests(received ?? []);
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

  // Declining goes through requestDecline + declineInterest (it needs a reason); accepting is one step.
  const acceptInterest = async (interestId: string) => {
    // Only a still-waiting interest addressed to you can be accepted. If it was taken back
    // (or already answered) while this screen was open, nothing changes and nothing matches.
    const { data, error } = await supabase
      .from('interests')
      .update({ status: 'accepted' })
      .eq('id', interestId)
      .eq('status', 'pending')
      .eq('to_user', session?.user.id ?? '')
      .select('id');

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    if (!data || data.length === 0) {
      Alert.alert('No longer available', 'This interest was taken back or already answered.');
      setReceivedInterests((prev) => prev.filter((r) => r.id !== interestId));
      fetchInterests();
      return;
    }

    setReceivedInterests((prev) => prev.filter((r) => r.id !== interestId));
    callbacks.onAccepted();
    fetchInterests();
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
              // Nothing was taken back, so no slot was freed: just refresh the list.
              fetchInterests();
              return;
            }

            fetchInterests();
            callbacks.onWithdrawn();
          },
        },
      ]
    );
  };

  // Declining always carries a reason (and an optional note) for the other person.
  // Returns true on success so the picker knows to close.
  const declineInterest = async (reason: DeclineReason, note: string | null): Promise<boolean> => {
    if (!decliningInterest) return false;

    const { error } = await supabase.rpc('decline_interest', {
      p_interest_id: decliningInterest.id,
      p_reason: reason,
      p_note: note,
    });

    if (error) {
      Alert.alert('Could not decline', error.message);
      return false;
    }

    setReceivedInterests((prev) => prev.filter((r) => r.id !== decliningInterest.id));
    setDecliningInterest(null);
    return true;
  };

  // Removes a declined interest from your list. (It's hidden, not deleted, so the person
  // who declined doesn't reappear in Discover.)
  const removeDeclinedInterest = (interest: InterestRow) => {
    Alert.alert(
      'Remove from your list?',
      `${interest.to_profile?.name ?? 'This person'} declined, so this just clears it from your list. They won't show up in Discover again.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.rpc('hide_declined_interest', {
              p_interest_id: interest.id,
            });
            if (error) {
              Alert.alert('Could not remove', error.message);
              return;
            }
            setSentInterests((prev) => prev.filter((i) => i.id !== interest.id));
          },
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
    removeDeclinedInterest,
    acceptInterest,
    requestDecline: setDecliningInterest,
    sentInterests,
    interestsLoaded: loaded,
    decliningInterest,
    cancelDecline: () => setDecliningInterest(null),
    declineInterest,
    declineAsRecruiter: isRecruiter,
  };
}
