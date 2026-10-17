import { X } from 'lucide-react-native';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../lib/app-theme';
import { supabase } from '../../../lib/supabase';
import { RecruiterCardContent } from '../discover/recruiter-card';
import { WorkerCardContent } from '../discover/worker-card';
import { useSharedStyles } from '../../styles/shared';

const PROFILE_COLUMNS =
  'id, name, username, avatar_url, description, is_recruiter, certifications, epa_608_types, trade_start_year, trade_role, location, has_drivers_license, open_schedules, company_name, recruiter_title, company_size, work_types, company_founded_year, licensed_insured, positions:positions!recruiter_id(id, title, company, pay_range, pay_type, pay_min, pay_max, pay_extras, urgency, location, work_style, experience_level, skills, description, active, epa_608_required, schedule_type, schedule_types, min_experience_years)';

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
    supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || !data) {
          setFailed(true);
          return;
        }
        const positions = ((data as any).positions ?? [])
          .filter((p: any) => p.active || p.id === positionId)
          .sort((a: any, b: any) => (a.id === positionId ? -1 : b.id === positionId ? 1 : 0));
        setProfile({ ...data, positions });
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
              <RecruiterCardContent recruiter={profile} me={me} expanded onCollapse={onClose} />
            ) : (
              <WorkerCardContent candidate={profile} expanded onCollapse={onClose} />
            )
          ) : (
            <View style={local.loading}>
              {failed ? (
                <Text style={shared.subtitle}>Couldn't load this profile.</Text>
              ) : (
                <ActivityIndicator color={c.muted} />
              )}
            </View>
          )}

          {footer ? <View style={local.footer}>{footer}</View> : null}
        </View>

        <Pressable style={local.close} onPress={onClose} hitSlop={10} accessibilityLabel="Close">
          <X size={20} color={c.text} strokeWidth={2.4} />
        </Pressable>
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
          paddingVertical: 48,
        },

        card: {
          width: '100%',
          maxWidth: 440,
          maxHeight: '100%',
          flexShrink: 1,
          height: '100%',
          backgroundColor: c.surface,
          borderRadius: 28,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: c.border,
        },

        loading: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },

        footer: {
          flexDirection: 'row',
          gap: 10,
          padding: 14,
          borderTopWidth: 1,
          borderTopColor: c.border,
          backgroundColor: c.surface,
        },

        close: {
          position: 'absolute',
          top: 10,
          right: 14,
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
        },
      }),
    [c]
  );
}
