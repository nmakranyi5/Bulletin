import { ArrowLeft, BadgeCheck, FileText, ShieldCheck } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../lib/app-theme';
import {
  KIND_INFO,
  REJECT_REASONS,
  REJECT_REASONS_FOR,
  RejectReason,
  VerificationKind,
  isImagePath,
  isKind,
  rejectionText,
} from '../../../lib/verification';
import { supabase } from '../../../lib/supabase';
import { RefreshableEmpty } from '../../components/refreshable-empty';
import { ReasonModal } from '../../components/reason-modal';
import { ResumeViewerModal } from '../../components/resume-viewer-modal';
import { useRefreshControl } from '../../hooks/use-refresh-control';
import { useSharedStyles } from '../../styles/shared';

type Pending = {
  id: string;
  user_id: string;
  kind: VerificationKind;
  license_number: string | null;
  license_state: string | null;
  evidence_paths: string[];
  created_at: string;
  name: string | null;
  username: string | null;
  is_recruiter: boolean;
  company_name: string | null;
  location: string | null;
  epa_608_types: string[] | null;
  trade_start_year: number | null;
};

const BUCKET = 'verification-docs';

// For reviewers: everything waiting for a decision, with the evidence, what to check, and
// Approve / Reject. Files are deleted once a request is decided.
export function ReviewVerificationsScreen({ onBack }: { onBack: () => void }) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const local = useLocalStyles();
  const [items, setItems] = useState<Pending[]>([]);
  // Signed links for each file path, created when the list loads.
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState<Pending | null>(null);
  const [viewing, setViewing] = useState<{ url: string; title: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.rpc('list_pending_verifications');
    if (error) {
      Alert.alert('Could not load', error.message);
      setLoading(false);
      return;
    }
    const rows = ((data ?? []) as Pending[]).filter((r) => isKind(r.kind));
    setItems(rows);

    const paths = rows.flatMap((r) => r.evidence_paths ?? []);
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
      const map: Record<string, string> = {};
      (signed ?? []).forEach((s) => {
        if (s.path && s.signedUrl) map[s.path] = s.signedUrl;
      });
      setUrls(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const refreshControl = useRefreshControl(load);

  const finish = async (req: Pending) => {
    // Evidence is only kept while a request is waiting.
    if (req.evidence_paths?.length) {
      await supabase.storage
        .from(BUCKET)
        .remove(req.evidence_paths)
        .catch(() => {});
    }
    setItems((prev) => prev.filter((r) => r.id !== req.id));
  };

  const approve = (req: Pending) => {
    Alert.alert(
      `Approve ${KIND_INFO[req.kind].title}?`,
      `${req.name ?? 'This person'} gets the "${KIND_INFO[req.kind].badge}" badge.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setBusyId(req.id);
            const { error } = await supabase.rpc('review_verification', {
              p_request_id: req.id,
              p_approve: true,
              p_reason: null,
            });
            setBusyId(null);
            if (error) Alert.alert('Could not approve', error.message);
            else await finish(req);
          },
        },
      ]
    );
  };

  const reject = async (req: Pending, reason: RejectReason, note: string | null) => {
    const { error } = await supabase.rpc('review_verification', {
      p_request_id: req.id,
      p_approve: false,
      p_reason: rejectionText(reason, note),
    });
    if (error) {
      Alert.alert('Could not reject', error.message);
      return false;
    }
    setRejecting(null);
    await finish(req);
    return true;
  };

  return (
    <SafeAreaView style={shared.simpleScreen}>
      <View style={shared.chatHeader}>
        <Pressable onPress={onBack} style={shared.chatBackButton} accessibilityLabel="Go back">
          <ArrowLeft size={22} color={c.text} strokeWidth={2.2} />
        </Pressable>
        <View style={shared.chatHeaderInfo}>
          <Text style={shared.chatHeaderName}>Review verifications</Text>
        </View>
      </View>

      {loading ? (
        <View style={shared.emptyState}>
          <Text style={shared.emptySubtitle}>Loading...</Text>
        </View>
      ) : items.length === 0 ? (
        <RefreshableEmpty refreshControl={refreshControl}>
          <View style={shared.emptyState}>
            <ShieldCheck size={48} color={c.muted} strokeWidth={1.5} />
            <Text style={shared.emptyTitle}>All caught up</Text>
            <Text style={shared.emptySubtitle}>New requests show up here.</Text>
          </View>
        </RefreshableEmpty>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          refreshControl={refreshControl}
          contentContainerStyle={local.list}
          renderItem={({ item: r }) => {
            const info = KIND_INFO[r.kind];
            return (
              <View style={local.card}>
                <View style={local.titleRow}>
                  <Text style={local.kind}>{info.title}</Text>
                  <Text style={local.role}>{r.is_recruiter ? 'Recruiter' : 'Job seeker'}</Text>
                </View>
                <Text style={local.name}>
                  {r.name ?? 'Unknown'}
                  {r.username ? ` · @${r.username}` : ''}
                </Text>

                {/* What they say about themselves, to compare against the evidence. */}
                <View style={local.facts}>
                  {r.company_name ? (
                    <Text style={local.fact}>Company: {r.company_name}</Text>
                  ) : null}
                  {r.location ? <Text style={local.fact}>Location: {r.location}</Text> : null}
                  {!r.is_recruiter && (r.epa_608_types ?? []).length > 0 ? (
                    <Text style={local.fact}>
                      Claims EPA 608 Type {(r.epa_608_types ?? []).join(', ')}
                    </Text>
                  ) : null}
                  {r.license_number ? (
                    <Text style={local.fact}>
                      License: {r.license_number} ({r.license_state})
                    </Text>
                  ) : null}
                </View>

                {(r.evidence_paths ?? []).map((path) => {
                  const url = urls[path];
                  if (!url) {
                    return (
                      <Text key={path} style={local.missingFile}>
                        Couldn't load an attached file. Pull down to retry before deciding.
                      </Text>
                    );
                  }
                  return isImagePath(path) ? (
                    <Pressable
                      key={path}
                      onPress={() =>
                        setViewing({ url, title: `${info.title} · ${r.name ?? 'Unknown'}` })
                      }
                    >
                      <Image source={{ uri: url }} style={local.image} resizeMode="contain" />
                    </Pressable>
                  ) : (
                    <Pressable
                      key={path}
                      style={local.docButton}
                      onPress={() =>
                        setViewing({ url, title: `${info.title} · ${r.name ?? 'Unknown'}` })
                      }
                    >
                      <FileText size={16} color={c.text} strokeWidth={2.2} />
                      <Text style={local.docText}>Open document</Text>
                    </Pressable>
                  );
                })}

                <Text style={local.checklist}>
                  Check:{' '}
                  {info.checklist({
                    name: r.name ?? 'the applicant',
                    company: r.company_name,
                    state: r.license_state,
                  })}
                </Text>

                <View style={local.actions}>
                  <Pressable
                    style={[local.rejectButton, busyId === r.id && local.disabled]}
                    onPress={() => setRejecting(r)}
                    disabled={busyId === r.id}
                  >
                    <Text style={local.rejectText}>Reject</Text>
                  </Pressable>
                  <Pressable
                    style={[local.approveButton, busyId === r.id && local.disabled]}
                    onPress={() => approve(r)}
                    disabled={busyId === r.id}
                  >
                    <BadgeCheck size={16} color={c.onAccent} strokeWidth={2.4} />
                    <Text style={local.approveText}>Approve</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}

      <ReasonModal<RejectReason>
        visible={!!rejecting}
        title="Why not?"
        subtitle={`${rejecting?.name ?? 'They'} will see this reason and can send a new request.`}
        options={(rejecting ? REJECT_REASONS_FOR[rejecting.kind] : []).map((key) => ({
          key,
          label: REJECT_REASONS[key],
        }))}
        submitLabel="Reject request"
        onCancel={() => setRejecting(null)}
        onSubmit={(reason, note) =>
          rejecting ? reject(rejecting, reason, note) : Promise.resolve(false)
        }
      />

      {viewing && (
        <ResumeViewerModal
          visible
          url={viewing.url}
          title={viewing.title}
          onClose={() => setViewing(null)}
        />
      )}
    </SafeAreaView>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        list: {
          padding: 16,
          gap: 14,
          paddingBottom: 40,
        },

        card: {
          padding: 16,
          borderRadius: 20,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
          gap: 8,
        },

        titleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },

        kind: {
          fontSize: 13,
          fontWeight: '800',
          color: c.textSecondary,
          letterSpacing: 0.4,
        },

        role: {
          fontSize: 12,
          fontWeight: '700',
          color: c.textSecondary,
        },

        name: {
          fontSize: 18,
          fontWeight: '800',
          color: c.text,
        },

        facts: {
          gap: 2,
        },

        fact: {
          fontSize: 14,
          color: c.textSecondary,
        },

        image: {
          width: '100%',
          height: 220,
          borderRadius: 12,
          backgroundColor: c.surfaceAlt,
        },

        docButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 12,
          backgroundColor: c.surfaceAlt,
        },

        docText: {
          fontSize: 14,
          fontWeight: '700',
          color: c.text,
        },

        missingFile: {
          fontSize: 13,
          fontWeight: '600',
          color: c.danger,
        },

        checklist: {
          marginTop: 4,
          fontSize: 13,
          lineHeight: 19,
          color: c.textSecondary,
        },

        actions: {
          flexDirection: 'row',
          gap: 10,
          marginTop: 6,
        },

        rejectButton: {
          flex: 1,
          alignItems: 'center',
          paddingVertical: 12,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: c.danger,
        },

        rejectText: {
          fontSize: 15,
          fontWeight: '700',
          color: c.danger,
        },

        approveButton: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 12,
          borderRadius: 14,
          backgroundColor: c.accent,
        },

        approveText: {
          fontSize: 15,
          fontWeight: '700',
          color: c.onAccent,
        },

        disabled: {
          opacity: 0.5,
        },
      }),
    [c]
  );
}
