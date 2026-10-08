import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { supabase } from '../../../lib/supabase';

export type MyProfile = {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_recruiter: boolean;
  epa_608_types: string[] | null;
  trade_start_year: number | null;
};

export function useMyProfile(session: Session | null, onboarded: boolean | null) {
  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);

  const fetchMyProfile = async () => {
    if (!session) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, username, avatar_url, is_recruiter, epa_608_types, trade_start_year')
      .eq('id', session.user.id)
      .single();

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setMyProfile(data);
  };

  useEffect(() => {
    if (session && onboarded) fetchMyProfile();
  }, [session, onboarded]);

  return { myProfile, fetchMyProfile };
}
