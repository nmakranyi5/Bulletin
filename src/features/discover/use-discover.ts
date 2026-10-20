import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Alert, LayoutAnimation } from 'react-native';

import { isOpenForCandidates } from '../../../lib/close-date';
import { supabase } from '../../../lib/supabase';
import { serverNow } from '../../../lib/time';
import { fetchRatings } from '../profile/ratings';
import { fetchVerifications } from '../profile/verifications';
import { MyProfile } from '../profile/use-my-profile';

export function useDiscover(
  session: Session | null,
  myProfile: MyProfile | null,
  interestsRemaining: number,
  sendInterest: (toUserId: string, positionId: string | null) => void
) {
  const [discoverCards, setDiscoverCards] = useState<any[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [myPositions, setMyPositions] = useState<any[]>([]);
  const [pendingInterestTarget, setPendingInterestTarget] = useState<{
    card: any;
    positions: any[];
  } | null>(null);

  const topCard = discoverCards[0];

  // Which card is expanded to its full details; only ever the top card.
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const expandTopCard = () => {
    if (!topCard) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCardId(topCard.id);
  };
  const collapseCard = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCardId(null);
  };

  // Your open positions, fresh from the database (closing or reopening one elsewhere changes
  // which can be offered). Returns null if they couldn't be loaded.
  const fetchMyPositions = async (): Promise<any[] | null> => {
    if (!session) return null;

    const { data, error } = await supabase
      .from('positions')
      .select('id, title, active, close_at')
      .eq('recruiter_id', session.user.id)
      .eq('active', true);

    if (error) {
      Alert.alert('Error', error.message);
      return null;
    }

    const open = (data ?? []).filter((p) => isOpenForCandidates(p, serverNow()));
    setMyPositions(open);
    return open;
  };

  // Attaches each person's response rating so the card can show it.
  const withRatings = async (cards: any[]) => {
    const ids = cards.map((c) => c.id);
    const [ratings, verifications] = await Promise.all([
      fetchRatings(ids),
      fetchVerifications(ids),
    ]);
    return cards.map((c) => ({ ...c, rating: ratings[c.id], verifications: verifications[c.id] }));
  };

  const fetchDiscoverCards = async () => {
    if (!session || !myProfile) return;

    setDiscoverLoading(true);

    await supabase.rpc('close_expired_positions');

    // Skip everyone you already have history with, in either direction: people you've sent
    // an interest to, and people who sent one to you (they're in your Interests, and swiping
    // them here would create a second, reversed interest). Someone whose position closed can
    // show up again (they may have others open).
    const [sentTo, receivedFrom] = await Promise.all([
      supabase
        .from('interests')
        .select('to_user')
        .eq('from_user', session.user.id)
        .neq('status', 'position_closed'),
      supabase
        .from('interests')
        .select('from_user')
        .eq('to_user', session.user.id)
        .neq('status', 'position_closed'),
    ]);

    // If this can't be read, don't build a deck: without it everyone you've already
    // contacted would reappear. Keep the cards already on screen.
    if (sentTo.error || receivedFrom.error) {
      Alert.alert('Error', (sentTo.error ?? receivedFrom.error)!.message);
      setDiscoverLoading(false);
      return;
    }

    const excludeIds = [
      ...(sentTo.data ?? []).map((r: any) => r.to_user),
      ...(receivedFrom.data ?? []).map((r: any) => r.from_user),
      session.user.id,
    ];

    if (myProfile.is_recruiter) {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, name, username, avatar_url, phone_verified_at, description, certifications, epa_608_types, trade_start_year, trade_role, location, has_drivers_license, open_schedules, resume_url'
        )
        .eq('is_recruiter', false)
        .not('id', 'in', `(${excludeIds.join(',')})`);

      if (error) Alert.alert('Error', error.message);
      else setDiscoverCards(await withRatings(data ?? []));
    } else {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, name, username, avatar_url, phone_verified_at, description, company_name, recruiter_title, company_size, work_types, company_founded_year, licensed_insured, location, positions:positions!recruiter_id(id, title, company, pay_range, pay_type, pay_min, pay_max, pay_extras, urgency, close_at, location, work_style, experience_level, skills, description, active, epa_608_required, schedule_type, schedule_types, min_experience_years)'
        )
        .eq('is_recruiter', true)
        .not('id', 'in', `(${excludeIds.join(',')})`);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        const withOpenPositions = (data ?? [])
          .map((r: any) => ({
            ...r,
            positions: (r.positions ?? []).filter((p: any) => isOpenForCandidates(p, serverNow())),
          }))
          .filter((r: any) => r.positions.length > 0);
        setDiscoverCards(await withRatings(withOpenPositions));
      }
    }

    setDiscoverLoading(false);
  };

  useEffect(() => {
    if (myProfile) {
      fetchDiscoverCards();
      if (myProfile.is_recruiter) fetchMyPositions();
    }
  }, [myProfile?.is_recruiter]);

  const handlePositionSubmit = (selectedIds: string[]) => {
    if (!pendingInterestTarget) return;

    const ids = selectedIds.slice(0, interestsRemaining);
    if (ids.length < selectedIds.length) {
      Alert.alert(
        'Interest limit',
        `You only had room for ${ids.length} more, so the rest weren't sent.`
      );
    }

    if (selectedIds.length === 0) {
      sendInterest(pendingInterestTarget.card.id, null);
    } else {
      ids.forEach((id) => sendInterest(pendingInterestTarget.card.id, id));
    }

    setPendingInterestTarget(null);
  };

  /*
   * JS-side state update.
   * This is only called through runOnJS from gesture animations.
   */
  const removeTopCard = async (interested: number) => {
    const swipedCard = discoverCards[0];

    setDiscoverCards((prev) => prev.slice(1));

    if (interested > 0 && swipedCard) {
      let relevantPositions: any[];
      if (myProfile?.is_recruiter) {
        // Re-read your positions so one you've just closed isn't offered.
        relevantPositions = (await fetchMyPositions()) ?? myPositions;
      } else {
        const listed = swipedCard.positions ?? [];
        relevantPositions = listed.filter((p: any) => isOpenForCandidates(p, serverNow()));
        if (listed.length > 0 && relevantPositions.length === 0) {
          Alert.alert(
            'Position closed',
            `${swipedCard.company_name || swipedCard.name} is no longer hiring for that role.`
          );
          return;
        }
      }

      if (relevantPositions.length === 0) {
        sendInterest(swipedCard.id, null);
      } else {
        setPendingInterestTarget({ card: swipedCard, positions: relevantPositions });
      }
    }
  };

  return {
    discoverCards,
    discoverLoading,
    topCard,
    expandedCardId,
    expandTopCard,
    collapseCard,
    fetchDiscoverCards,
    pendingInterestTarget,
    clearPendingInterestTarget: () => setPendingInterestTarget(null),
    handlePositionSubmit,
    removeTopCard,
  };
}
