import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Alert, LayoutAnimation } from 'react-native';

import { isOpenForCandidates } from '../../../lib/close-date';
import { supabase } from '../../../lib/supabase';
import { serverNow } from '../../../lib/time';
import { fetchRatings } from '../profile/ratings';
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

  const fetchMyPositions = async () => {
    if (!session) return;

    const { data, error } = await supabase
      .from('positions')
      .select('id, title, active, close_at')
      .eq('recruiter_id', session.user.id)
      .eq('active', true);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setMyPositions((data ?? []).filter((p) => isOpenForCandidates(p, serverNow())));
  };

  // Attaches each person's response rating so the card can show it.
  const withRatings = async (cards: any[]) => {
    const ratings = await fetchRatings(cards.map((c) => c.id));
    return cards.map((c) => ({ ...c, rating: ratings[c.id] }));
  };

  const fetchDiscoverCards = async () => {
    if (!session || !myProfile) return;

    setDiscoverLoading(true);

    await supabase.rpc('close_expired_positions');

    // Someone whose position closed on you can show up again (they may have others open).
    const { data: alreadyContacted } = await supabase
      .from('interests')
      .select('to_user')
      .eq('from_user', session.user.id)
      .neq('status', 'position_closed');

    const excludeIds = (alreadyContacted ?? []).map((r) => r.to_user);
    excludeIds.push(session.user.id);

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
  const removeTopCard = (interested: number) => {
    const swipedCard = discoverCards[0];

    setDiscoverCards((prev) => prev.slice(1));

    if (interested > 0 && swipedCard) {
      const relevantPositions = myProfile?.is_recruiter
        ? myPositions
        : swipedCard.positions ?? [];

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
