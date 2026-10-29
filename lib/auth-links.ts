import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Where Supabase email links (confirm signup, reset password) send the user back to. On the
// web that's the page you're on (it may live under a sub-path, e.g. on GitHub Pages); on
// phones it's the app's own link.
export const authRedirectUrl = () =>
  Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.location.origin + window.location.pathname
    : Linking.createURL('/');

type AuthLinkResult = { handled: boolean; type?: string; error?: string };

/*
 * Handles the URL Supabase redirects to after an email link is opened.
 * `onType` is called with the link type (e.g. 'recovery') before the session is
 * set, so the caller can react before the auth state change re-renders the app.
 */
export async function handleAuthUrl(
  url: string | null,
  onType?: (type: string) => void
): Promise<AuthLinkResult> {
  if (!url) return { handled: false };

  const hashIndex = url.indexOf('#');
  const hash = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const queryStart = url.indexOf('?');
  const query =
    queryStart >= 0 ? url.slice(queryStart + 1, hashIndex >= 0 ? hashIndex : undefined) : '';

  const params = new URLSearchParams(query);
  new URLSearchParams(hash).forEach((value, key) => params.set(key, value));

  const errorDescription = params.get('error_description');
  if (errorDescription) {
    return { handled: true, error: errorDescription.replace(/\+/g, ' ') };
  }

  const type = params.get('type') ?? undefined;
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const code = params.get('code');

  if (accessToken && refreshToken) {
    if (type) onType?.(type);
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return { handled: true, type, error: error?.message };
  }

  if (code) {
    if (type) onType?.(type);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return { handled: true, type, error: error?.message };
  }

  return { handled: false };
}