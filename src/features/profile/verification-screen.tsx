import { Session } from '@supabase/supabase-js';
import * as DocumentPicker from 'expo-document-picker';
import { ArrowLeft, BadgeCheck, Clock, FileText, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../lib/app-theme';
import {
  KIND_INFO,
  MAX_EVIDENCE_FILES,
  VerificationKind,
  cleanLicenseNumber,
  cleanState,
  evidenceExtension,
  isStateCode,
  kindsFor,
} from '../../../lib/verification';
import { supabase } from '../../../lib/supabase';
import { useRefreshControl } from '../../hooks/use-refresh-control';
import { useSharedStyles } from '../../styles/shared';
import { uploadFileToBucket } from './upload';

type RequestRow = {
  kind: VerificationKind;
  status: 'pending' | 'approved' | 'rejected';
  reject_reason: string | null;
  created_at: string;
};
type BadgeRow = { kind: VerificationKind; expires_at: string | null };
type Picked = { uri: string; name: string; mimeType: string };

// Where people ask to have a certification or license checked, and see where each request
// stands. A reviewer looks at it and approves or rejects it; approved checks become badges.
export function VerificationScreen({
  session,
  isRecruiter,
  onBack,
}: {
  session: Session;
  isRecruiter: boolean;
  onBack: () => void;
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const local = useLocalStyles();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [loading, setLoading] = useState(true);
  // Which kind has its form open.
  const [openKind, setOpenKind] = useState<VerificationKind | null>(null);
  const [files, setFiles] = useState<Picked[]>([]);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseState, setLicenseState] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const [reqs, bdg] = await Promise.all([
      supabase
        .from('verification_requests')
        .select('kind, status, reject_reason, created_at')
        .order('created_at', { ascending: false }),
      supabase.from('user_verifications').select('kind, expires_at').eq('user_id', session.user.id),
    ]);
    if (!reqs.error) setRequests((reqs.data ?? []) as RequestRow[]);
    if (!bdg.error) setBadges((bdg.data ?? []) as BadgeRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const refreshControl = useRefreshControl(load);

  const latest = (kind: VerificationKind) => requests.find((r) => r.kind === kind);
  const activeBadge = (kind: VerificationKind) =>
    badges.find(
      (b) => b.kind === kind && (!b.expires_at || new Date(b.expires_at).getTime() > Date.now())
    );

  const openForm = (kind: VerificationKind) => {
    setOpenKind(kind);
    setFiles([]);
    setLicenseNumber('');
    setLicenseState('');
  };

  const pickFile = async () => {
    if (files.length >= MAX_EVIDENCE_FILES) return;
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setFiles((prev) => [
      ...prev,
      {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? 'application/octet-stream',
      },
    ]);
  };

  const submit = async (kind: VerificationKind) => {
    const needsFile = kind !== 'contractor_license';
    if (needsFile && files.length === 0) {
      Alert.alert('Add a file', 'Attach a clear photo or PDF.');
      return;
    }
    if (kind === 'contractor_license') {
      if (!cleanLicenseNumber(licenseNumber)) {
        Alert.alert('License number', 'Enter your license number.');
        return;
      }
      if (!isStateCode(licenseState)) {
        Alert.alert('State', 'Enter the two-letter state that issued it, e.g. TX.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const paths: string[] = [];
      for (const [i, file] of files.entries()) {
        const ext = evidenceExtension(file.name, file.mimeType);
        const path = `${session.user.id}/${kind}-${Date.now()}-${i}.${ext}`;
        await uploadFileToBucket('verification-docs', path, file.uri, file.mimeType);
        paths.push(path);
      }

      const { error } = await supabase.rpc('submit_verification', {
        p_kind: kind,
        p_license_number: kind === 'contractor_license' ? cleanLicenseNumber(licenseNumber) : null,
        p_license_state: kind === 'contractor_license' ? licenseState : null,
        p_paths: paths,
        p_note: null,
      });
      if (error) throw error;

      setOpenKind(null);
      await load();
      Alert.alert('Request sent', "A reviewer will take a look. You'll see the result here.");
    } catch (err: any) {
      Alert.alert('Could not send', err?.message ?? 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={shared.simpleScreen}>
      <View style={shared.chatHeader}>
        <Pressable onPress={onBack} style={shared.chatBackButton} accessibilityLabel="Go back">
          <ArrowLeft size={22} color={c.text} strokeWidth={2.2} />
        </Pressable>
        <View style={shared.chatHeaderInfo}>
          <Text style={shared.chatHeaderName}>Get verified</Text>
        </View>
      </View>

      <ScrollView
        refreshControl={refreshControl}
        contentContainerStyle={local.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={shared.subtitle}>
          {isRecruiter
            ? 'Show candidates your business is real. A reviewer checks what you send, then adds a badge to your profile.'
            : 'Show recruiters your certification is real. A reviewer checks what you send, then adds a badge to your profile.'}
        </Text>
        <Text style={local.privacy}>
          Your files are only seen by reviewers, and they're deleted once a decision is made. Other
          people see the badge, never your documents or numbers.
        </Text>

        {loading ? (
          <Text style={shared.subtitle}>Loading...</Text>
        ) : (
          kindsFor(isRecruiter).map((kind) => {
            const info = KIND_INFO[kind];
            const last = latest(kind);
            const badge = activeBadge(kind);
            const pending = last?.status === 'pending';
            const rejected = last?.status === 'rejected' && !badge;

            return (
              <View key={kind} style={local.card}>
                <Text style={local.cardTitle}>{info.title}</Text>

                {badge ? (
                  <View style={local.statusRow}>
                    <BadgeCheck size={16} color={c.green} strokeWidth={2.4} />
                    <Text style={[local.status, { color: c.green }]}>
                      Verified
                      {badge.expires_at
                        ? ` until ${new Date(badge.expires_at).toLocaleDateString('en-US', {
                            month: 'short',
                            year: 'numeric',
                          })}`
                        : ''}
                    </Text>
                  </View>
                ) : pending ? (
                  <View style={local.statusRow}>
                    <Clock size={16} color={c.amber} strokeWidth={2.4} />
                    <Text style={[local.status, { color: c.amber }]}>Waiting for review</Text>
                  </View>
                ) : (
                  <>
                    <Text style={local.ask}>{info.ask}</Text>
                    {rejected && (
                      <Text style={local.rejected}>
                        Not approved: {last?.reject_reason ?? 'no reason given'}. You can try again.
                      </Text>
                    )}
                  </>
                )}

                {!badge && !pending && openKind !== kind && (
                  <Pressable style={local.button} onPress={() => openForm(kind)}>
                    <Text style={local.buttonText}>{rejected ? 'Try again' : 'Start'}</Text>
                  </Pressable>
                )}

                {openKind === kind && !badge && !pending && (
                  <View style={local.form}>
                    {kind === 'contractor_license' && (
                      <View style={local.licenseRow}>
                        <TextInput
                          style={[shared.authInput, local.licenseNumber]}
                          placeholder="License number"
                          placeholderTextColor={c.muted}
                          value={licenseNumber}
                          onChangeText={setLicenseNumber}
                          autoCapitalize="characters"
                          maxLength={40}
                        />
                        <TextInput
                          style={[shared.authInput, local.licenseState]}
                          placeholder="TX"
                          placeholderTextColor={c.muted}
                          value={licenseState}
                          onChangeText={(t) => setLicenseState(cleanState(t))}
                          autoCapitalize="characters"
                        />
                      </View>
                    )}

                    {files.map((f, i) => (
                      <View key={`${f.uri}-${i}`} style={local.fileRow}>
                        <FileText size={16} color={c.textSecondary} strokeWidth={2.2} />
                        <Text style={local.fileName} numberOfLines={1}>
                          {f.name}
                        </Text>
                        <Pressable
                          onPress={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                          hitSlop={10}
                          accessibilityLabel="Remove file"
                        >
                          <X size={16} color={c.textSecondary} strokeWidth={2.4} />
                        </Pressable>
                      </View>
                    ))}

                    {files.length < MAX_EVIDENCE_FILES && (
                      <Pressable style={local.attach} onPress={pickFile}>
                        <Text style={local.attachText}>
                          {files.length === 0
                            ? kind === 'contractor_license'
                              ? 'Attach a photo of the license (optional)'
                              : 'Attach a photo or PDF'
                            : 'Attach another file'}
                        </Text>
                      </Pressable>
                    )}

                    <Pressable
                      style={[shared.authButton, submitting && shared.authButtonDisabled]}
                      onPress={() => submit(kind)}
                      disabled={submitting}
                    >
                      <Text style={shared.authButtonText}>
                        {submitting ? 'Sending...' : 'Send for review'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={local.cancel}
                      onPress={() => setOpenKind(null)}
                      disabled={submitting}
                    >
                      <Text style={local.cancelText}>Cancel</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        content: {
          padding: 22,
          gap: 14,
          paddingBottom: 40,
        },

        privacy: {
          fontSize: 13,
          lineHeight: 19,
          color: c.muted,
        },

        card: {
          padding: 18,
          borderRadius: 20,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
          gap: 10,
        },

        cardTitle: {
          fontSize: 17,
          fontWeight: '800',
          color: c.text,
        },

        ask: {
          fontSize: 14,
          lineHeight: 20,
          color: c.textSecondary,
        },

        statusRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },

        status: {
          fontSize: 14,
          fontWeight: '700',
        },

        rejected: {
          fontSize: 14,
          lineHeight: 20,
          fontWeight: '600',
          color: c.danger,
        },

        button: {
          alignSelf: 'flex-start',
          paddingHorizontal: 20,
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor: c.accent,
        },

        buttonText: {
          fontSize: 14,
          fontWeight: '700',
          color: c.onAccent,
        },

        form: {
          gap: 10,
          marginTop: 4,
        },

        licenseRow: {
          flexDirection: 'row',
          gap: 10,
        },

        licenseNumber: {
          flex: 1,
          minWidth: 0,
        },

        licenseState: {
          width: 64,
          flexShrink: 0,
          paddingHorizontal: 8,
          textAlign: 'center',
        },

        fileRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor: c.surfaceAlt,
        },

        fileName: {
          flex: 1,
          fontSize: 14,
          color: c.text,
        },

        attach: {
          paddingVertical: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: c.borderStrong,
          alignItems: 'center',
        },

        attachText: {
          fontSize: 14,
          fontWeight: '600',
          color: c.textSecondary,
        },

        cancel: {
          alignItems: 'center',
          paddingVertical: 6,
        },

        cancelText: {
          fontSize: 14,
          fontWeight: '600',
          color: c.textSecondary,
        },
      }),
    [c]
  );
}
