import { Session } from '@supabase/supabase-js';
import {
  BriefcaseBusiness,
  ChevronRight,
  Pencil,
  Settings,
  Trash2,
  UserRound,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../lib/app-theme';
import { formatWorkerEpa } from '../../../lib/hvac';
import { supabase } from '../../../lib/supabase';
import { useRefreshControl } from '../../hooks/use-refresh-control';
import { useSharedStyles } from '../../styles/shared';
import { DeleteAccountModal } from './delete-account-modal';

export function ProfileScreen({
  session,
  onEditProfile,
  onManagePositions,
}: {
  session: Session;
  onEditProfile: () => void;
  onManagePositions: () => void;
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const local = useLocalStyles();
  const [profile, setProfile] = useState<{
    name: string | null;
    username: string | null;
    avatar_url: string | null;
    is_recruiter: boolean;
    company_name: string | null;
    recruiter_title: string | null;
    trade_role: string | null;
    epa_608_types: string[] | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const { mode, setMode } = useTheme();

  const loadProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'name, username, avatar_url, is_recruiter, company_name, recruiter_title, trade_role, epa_608_types'
      )
      .eq('id', session.user.id)
      .maybeSingle();

    if (error) {
      Alert.alert('Error', error.message);
    } else if (data) {
      setProfile(data);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const refreshControl = useRefreshControl(loadProfile);

  const roleLine = profile?.is_recruiter
    ? [profile.recruiter_title, profile.company_name].filter(Boolean).join(' at ')
    : [profile?.trade_role, profile && formatWorkerEpa(profile.epa_608_types)]
        .filter(Boolean)
        .join(' · ');

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <ScrollView
      style={shared.simpleScreen}
      refreshControl={refreshControl}
      contentContainerStyle={local.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={shared.screenHeader}>
        <Text style={shared.screenTitle}>bulletin.</Text>
        <Text style={shared.subtitle}>Manage your account.</Text>
      </View>

      <View style={local.profileCard}>
        <Pressable style={local.profileEditButton} onPress={onEditProfile}>
          <Pencil size={16} color={c.onAccent} strokeWidth={2.4} />
        </Pressable>

        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={shared.avatarPreview} />
        ) : (
          <UserRound size={72} color={c.muted} strokeWidth={1.5} />
        )}

        {loading ? (
          <Text style={local.profileSubtext}>Loading...</Text>
        ) : (
          <>
            <Text style={local.profileName}>{profile?.name || 'Your Name'}</Text>
            <Text style={local.profileSubtext}>
              {profile?.username ? `@${profile.username}` : 'Complete your profile'}
            </Text>
            {roleLine ? <Text style={local.profileRoleLine}>{roleLine}</Text> : null}
          </>
        )}
      </View>

      <View style={local.accountActions}>
        {profile?.is_recruiter && (
          <Pressable style={local.accountActionRow} onPress={onManagePositions}>
            <BriefcaseBusiness size={20} color={c.textSecondary} strokeWidth={2} />
            <Text style={local.accountActionText}>Manage Positions</Text>
            <ChevronRight size={18} color={c.muted} strokeWidth={2} />
          </Pressable>
        )}

        <Pressable
          style={[local.accountActionRow, !showSettings && { borderBottomWidth: 0 }]}
          onPress={() => setShowSettings((v) => !v)}
        >
          <Settings size={20} color={c.textSecondary} strokeWidth={2} />
          <Text style={local.accountActionText}>Settings</Text>
          <ChevronRight
            size={18}
            color={c.muted}
            strokeWidth={2}
            style={showSettings ? { transform: [{ rotate: '90deg' }] } : undefined}
          />
        </Pressable>

        {showSettings && (
          <View style={local.settingsPanel}>
            <Text style={shared.sectionLabel}>APPEARANCE</Text>
            <View style={[shared.subTabBar, local.settingsToggle]}>
              {(['light', 'dark'] as const).map((m) => (
                <Pressable
                  key={m}
                  style={[shared.subTabItem, mode === m && shared.subTabItemActive]}
                  onPress={() => setMode(m)}
                >
                  <Text style={[shared.subTabText, mode === m && shared.subTabTextActive]}>
                    {m === 'light' ? 'Light' : 'Dark'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={local.deleteAccountRow} onPress={() => setShowDelete(true)}>
              <Trash2 size={18} color={c.danger} strokeWidth={2.2} />
              <Text style={local.deleteAccountText}>Delete account</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Pressable style={local.signOutButton} onPress={handleSignOut}>
        <Text style={local.signOutText}>Sign Out</Text>
      </Pressable>

      <DeleteAccountModal
        visible={showDelete}
        userId={session.user.id}
        isRecruiter={!!profile?.is_recruiter}
        onCancel={() => setShowDelete(false)}
      />
    </ScrollView>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        profileName: {
          fontSize: 20,
          fontWeight: '800',
          color: c.text,
          marginTop: 8,
        },

        scrollContent: {
          paddingBottom: 24,
        },

        deleteAccountRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginTop: 18,
          paddingVertical: 10,
        },

        deleteAccountText: {
          fontSize: 15,
          fontWeight: '600',
          color: c.danger,
        },

        profileRoleLine: {
          marginTop: 6,
          fontSize: 13,
          fontWeight: '600',
          color: c.textStrong,
          textAlign: 'center',
        },

        profileSubtext: {
          fontSize: 14,
          color: c.textSecondary,
        },

        settingsPanel: {
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 6,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        },

        settingsToggle: {
          marginHorizontal: 0,
          marginTop: 8,
        },

        signOutButton: {
          marginTop: 20,
          marginHorizontal: 22,
          paddingVertical: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: c.danger,
          alignItems: 'center',
        },

        signOutText: {
          color: c.danger,
          fontWeight: '700',
          fontSize: 15,
        },

        profileCard: {
          marginTop: 24,
          marginHorizontal: 22,
          padding: 28,
          borderRadius: 24,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
          alignItems: 'center',
          gap: 6,
          position: 'relative',
        },

        profileEditButton: {
          position: 'absolute',
          top: 14,
          right: 14,
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: c.accent,
          alignItems: 'center',
          justifyContent: 'center',
        },

        accountActions: {
          marginTop: 16,
          marginHorizontal: 22,
          borderRadius: 18,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
          overflow: 'hidden',
        },

        accountActionRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 18,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        },

        accountActionText: {
          flex: 1,
          fontSize: 15,
          fontWeight: '600',
          color: c.text,
        },
      }),
    [c]
  );
}
