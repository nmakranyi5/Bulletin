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
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

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

    const ensureProfile = async () => {
      const { data: existing } = await supabase
        .from('profiles')
        .select('onboarded')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from('profiles').insert({
          id: session.user.id,
          is_recruiter: session.user.user_metadata?.role === 'recruiter',
        });
        setOnboarded(false);
      } else {
        setOnboarded(existing.onboarded ?? false);
      }
    };

    ensureProfile();
  }, [session]);

  return { session, authLoading, recovering, setRecovering, onboarded, setOnboarded };
}
