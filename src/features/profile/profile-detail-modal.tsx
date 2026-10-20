import { ReactNode, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../lib/app-theme';
import { supabase } from '../../../lib/supabase';
import { RecruiterCardContent } from '../discover/recruiter-card';
import { WorkerCardContent } from '../discover/worker-card';
import { fetchRatings } from './ratings';
import { fetchVerifications } from './verifications';
import { useSharedStyles } from '../../styles/shared';

const PROFILE_COLUMNS =
  'id, name, username, avatar_url, phone_verified_at, description, is_recruiter, certifications, epa_608_types, trade_start_year, trade_role, location, has_drivers_license, open_schedules, resume_url, company_name, recruiter_title, company_size, work_types, company_founded_year, licensed_insured, positions:positions!recruiter_id(id, title, company, pay_range, pay_type, pay_min, pay_max, pay_extras, urgency, location, work_style, experience_level, skills, description, active, epa_608_required, schedule_type, schedule_types, min_experience_years)';

// The same expanded card you see in Discover, opened from Interests or Messages.
// `positionId` puts the posting you're talking about first on a recruiter's card.
export function ProfileDetailModal({
  userId,
  positionId,
  me,
  footer,
  onClose,
}: {
  userId: string | null;
  positionId?: string | null;
  // Your own profile, so a recruiter card can flag certification/experience gaps.
  me?: any;
  footer?: ReactNode;
  onClose: () => void;
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const local = useLocalStyles();
  const [profile, setProfile] = useState<any | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setProfile(null);
    setFailed(false);
    if (!userId) return;

    let alive = true;
    Promise.all([
      fetchRatings([userId]),
      fetchVerifications([userId]),
      supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).single(),
    ]).then(([ratings, verifications, { data, error }]) => {
      if (!alive) return;
      if (error || !data) {
        setFailed(true);
        return;
      }
      const positions = ((data as any).positions ?? [])
        .filter((p: any) => p.active || p.id === positionId)
        .sort((a: any, b: any) => (a.id === positionId ? -1 : b.id === positionId ? 1 : 0));
      setProfile({ ...data, positions, rating: ratings[userId], verifications: verifications[userId] });
    });

    return () => {
      alive = false;
    };
  }, [userId, positionId]);

  return (
    <Modal visible={!!userId} transparent animationType="fade" onRequestClose={onClose}>
      <View style={local.overlay}>
        <View style={local.card}>
          {profile ? (
            profile.is_recruiter ? (
              <RecruiterCardContent
                recruiter={profile}
                me={me}
                expanded
                modal
                onCollapse={onClose}
              />
            ) : (
              <WorkerCardContent candidate={profile} expanded modal onCollapse={onClose} />
            )
          ) : (
            <View style={local.loading}>
              {failed ? (
                <>
                  <Text style={shared.subtitle}>Couldn't load this profile.</Text>
                  <Pressable onPress={onClose} style={local.loadingClose}>
                    <Text style={shared.refreshText}>Close</Text>
                  </Pressable>
                </>
              ) : (
                <ActivityIndicator color={c.muted} />
              )}
            </View>
          )}

          {footer ? <View style={local.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 16,
          paddingVertical: 32,
        },

        card: {
          width: '100%',
          maxWidth: 440,
          maxHeight: '100%',
          backgroundColor: c.surface,
          borderRadius: 28,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: c.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.2,
          shadowRadius: 24,
        },

        loading: {
          minHeight: 180,
          alignItems: 'center',
          justifyContent: 'center',
        },

        loadingClose: {
          marginTop: 12,
          padding: 10,
        },

        footer: {
          flexDirection: 'row',
          gap: 10,
          padding: 14,
          borderTopWidth: 1,
          borderTopColor: c.border,
          backgroundColor: c.surface,
        },
      }),
    [c]
  );
}
