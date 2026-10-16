import { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { handleAuthUrl } from '../../../lib/auth-links';
import { supabase } from '../../../lib/supabase';

// Session, email-link handling (confirm signup / reset password) and onboarding status.
export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  // Keyed by user: a stale `true` from a previous account must never apply to a
  // new one (that made the app fetch a profile row that didn't exist yet).
  const [onboardedState, setOnboardedState] = useState<{
    userId: string;
    value: boolean;
  } | null>(null);
  const userId = session?.user.id ?? null;
  const onboarded =
    onboardedState && onboardedState.userId === userId ? onboardedState.value : null;
  const setOnboarded = (value: boolean) => {
    if (userId) setOnboardedState({ userId, value });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // Email links (confirm signup / reset password) open the app with tokens in the URL.
  useEffect(() => {
    const onUrl = async (url: string | null) => {
      const result = await handleAuthUrl(url, (type) => {
        if (type === 'recovery') setRecovering(true);
      });
      if (result.error) {
        setRecovering(false);
        Alert.alert('Link problem', result.error);
      }
    };

    Linking.getInitialURL().then(onUrl);
    const sub = Linking.addEventListener('url', ({ url }) => onUrl(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!session) return;
    const uid = session.user.id;
    let cancelled = false;

    const ensureProfile = async () => {
      const { data: existing } = await supabase
        .from('profiles')
        .select('onboarded')
        .eq('id', uid)
        .maybeSingle();
      if (cancelled) return;

      if (!existing) {
        const { error } = await supabase.from('profiles').insert({
          id: uid,
          is_recruiter: session.user.user_metadata?.role === 'recruiter',
        });
        if (cancelled) return;
        // 23505 = row already exists (e.g. a sign-up trigger or a parallel run).
        if (error && error.code !== '23505') {
          Alert.alert('Could not set up your profile', error.message);
        }
        setOnboardedState({ userId: uid, value: false });
      } else {
        setOnboardedState({ userId: uid, value: existing.onboarded ?? false });
      }
    };

    ensureProfile();
    return () => {
      cancelled = true;
    };
    // Re-run per user, not on every token refresh.
  }, [userId]);

  return { session, authLoading, recovering, setRecovering, onboarded, setOnboarded };
}
