import { useEffect, useState } from 'react';
import { resumeStoragePath } from '../../lib/resume';
import { supabase } from '../../lib/supabase';

// A link that will actually open a resume. Resumes live in a private bucket, so the saved
// link alone returns "404 Bucket not found"; this asks for a short-lived signed link
// instead, and falls back to the saved link if that isn't possible.
export function useResumeUrl(url: string, active: boolean): { url: string | null; error: boolean } {
  const [state, setState] = useState<{ url: string | null; error: boolean }>({
    url: null,
    error: false,
  });

  useEffect(() => {
    if (!active) return;
    let alive = true;
    setState({ url: null, error: false });

    const path = resumeStoragePath(url);
    if (!path) {
      setState({ url, error: false });
      return;
    }

    supabase.storage
      .from('resumes')
      .createSignedUrl(path, 60 * 60)
      .then(({ data, error }) => {
        if (!alive) return;
        setState({ url: error || !data?.signedUrl ? url : data.signedUrl, error: false });
      })
      .catch(() => alive && setState({ url, error: false }));

    return () => {
      alive = false;
    };
  }, [url, active]);

  return state;
}
