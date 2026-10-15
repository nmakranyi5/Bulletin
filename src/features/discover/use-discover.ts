import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { supabase } from '../../../lib/supabase';
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

  const fetchMyPositions = async () => {
    if (!session) return;

    const { data, error } = await supabase
      .from('positions')
      .select('id, title')
      .eq('recruiter_id', session.user.id)
      .eq('active', true);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setMyPositions(data ?? []);
  };

  const fetchDiscoverCards = async () => {
    if (!session || !myProfile) return;

    setDiscoverLoading(true);

    const { data: alreadyContacted } = await supabase
      .from('interests')
      .select('to_user')
      .eq('from_user', session.user.id);

    const excludeIds = (alreadyContacted ?? []).map((r) => r.to_user);
    excludeIds.push(session.user.id);

    if (myProfile.is_recruiter) {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, name, username, avatar_url, description, certifications, epa_608_types, trade_start_year, trade_role, location, has_drivers_license, open_schedules'
        )
        .eq('is_recruiter', false)
        .not('id', 'in', `(${excludeIds.join(',')})`);

      if (error) Alert.alert('Error', error.message);
      else setDiscoverCards(data ?? []);
    } else {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, name, username, avatar_url, description, company_name, recruiter_title, company_size, work_types, company_founded_year, licensed_insured, location, positions:positions!recruiter_id(id, title, company, pay_range, pay_type, pay_min, pay_max, pay_extras, location, work_style, experience_level, skills, description, active, epa_608_required, schedule_type, schedule_types, min_experience_years)'
        )
        .eq('is_recruiter', true)
        .not('id', 'in', `(${excludeIds.join(',')})`);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        const withOpenPositions = (data ?? [])
          .map((r: any) => ({
            ...r,
            positions: (r.positions ?? []).filter((p: any) => p.active),
          }))
          .filter((r: any) => r.positions.length > 0);
        setDiscoverCards(withOpenPositions);
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
    fetchDiscoverCards,
    pendingInterestTarget,
    clearPendingInterestTarget: () => setPendingInterestTarget(null),
    handlePositionSubmit,
    removeTopCard,
  };
}
