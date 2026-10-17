import { Session } from '@supabase/supabase-js';
import { ArrowLeft, BriefcaseBusiness, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../lib/app-theme';
import {
  EPA_TYPES,
  PAY_EXTRAS,
  PAY_TYPES,
  parseMinYears,
  getSchedules,
  parsePay,
  SCHEDULE_TYPES,
} from '../../../lib/hvac';
import {
  CLOSE_ERRORS,
  CLOSE_PRESETS,
  MAX_CLOSE_AHEAD_MS,
  REMINDER_LEAD_MS,
  checkCloseAt,
  closeAtToDate,
  closeLabel,
  closeState,
  presetCloseAt,
  sameInstant,
} from '../../../lib/close-date';
import { URGENCY, URGENCY_LEVELS, Urgency, urgencyOf } from '../../../lib/response-timers';
import { serverNow } from '../../../lib/time';
import { supabase } from '../../../lib/supabase';
import { RefreshableEmpty } from '../../components/refreshable-empty';
import { useNow } from '../../hooks/use-now';
import { useRefreshControl } from '../../hooks/use-refresh-control';
import { ChipSelect } from '../../components/chip-select';
import { DateTimeField } from '../../components/date-time-field';
import { useSharedStyles } from '../../styles/shared';
import { confirmPositionClose, promptClose, promptExtend, reopenPosition } from './position-close';

export function PositionsScreen({
  session,
  onBack,
}: {
  session: Session;
  onBack: () => void;
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const local = useLocalStyles();
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [defaultCompany, setDefaultCompany] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('standard');
  const [payType, setPayType] = useState('');
  const [payMin, setPayMin] = useState('');
  const [payMax, setPayMax] = useState('');
  const [payExtras, setPayExtras] = useState<string[]>([]);
  const [legacyPay, setLegacyPay] = useState('');
  const [location, setLocation] = useState('');
  const [scheduleTypes, setScheduleTypes] = useState<string[]>([]);
  const [epaRequired, setEpaRequired] = useState('');
  const [minYears, setMinYears] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [closeAt, setCloseAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const now = useNow();

  // `silent` keeps the current list on screen (used by pull-to-refresh) instead of
  // swapping it for a "Loading..." placeholder.
  const fetchPositions = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);

    // Make sure anything past its close date has actually been closed before listing.
    await supabase.rpc('close_expired_positions');

    const { data, error } = await supabase
      .from('positions')
      .select('*')
      .eq('recruiter_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) Alert.alert('Error', error.message);
    else setPositions(data ?? []);

    setLoading(false);
  };

  const refreshControl = useRefreshControl(() => fetchPositions({ silent: true }));

  useEffect(() => {
    fetchPositions();

    // New postings default to the company on the recruiter's profile.
    supabase
      .from('profiles')
      .select('company_name')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setDefaultCompany(data?.company_name ?? ''));
  }, []);

  const resetForm = () => {
    setTitle('');
    setCompany('');
    setUrgency('standard');
    setPayType('');
    setPayMin('');
    setPayMax('');
    setPayExtras([]);
    setLegacyPay('');
    setLocation('');
    setScheduleTypes([]);
    setEpaRequired('');
    setMinYears('');
    setDescription('');
    setSkills([]);
    setSkillInput('');
    setCloseAt(null);
    setEditingId(null);
  };

  const openAddForm = () => {
    resetForm();
    setCompany(defaultCompany);
    setView('form');
  };

  const openEditForm = (position: any) => {
    setTitle(position.title ?? '');
    setCompany(position.company ?? '');
    setUrgency(urgencyOf(position));
    setPayType(position.pay_type ?? '');
    setPayMin(position.pay_min != null ? String(position.pay_min) : '');
    setPayMax(position.pay_max != null ? String(position.pay_max) : '');
    setPayExtras(position.pay_extras ?? []);
    setLegacyPay(position.pay_range ?? '');
    setLocation(position.location ?? '');
    setScheduleTypes(getSchedules(position));
    setEpaRequired(position.epa_608_required ?? '');
    setMinYears(position.min_experience_years != null ? String(position.min_experience_years) : '');
    setDescription(position.description ?? '');
    setSkills(position.skills ?? []);
    setCloseAt(closeAtToDate(position.close_at));
    setEditingId(position.id);
    setView('form');
  };

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (!trimmed || skills.includes(trimmed)) {
      setSkillInput('');
      return;
    }
    setSkills((prev) => [...prev, trimmed]);
    setSkillInput('');
  };

  const removeSkill = (skill: string) => {
    setSkills((prev) => prev.filter((s) => s !== skill));
  };

  const handleSave = async () => {
    if (!title.trim() || !company.trim()) {
      Alert.alert('Missing info', 'Title and company are required.');
      return;
    }

    const parsedMinYears = parseMinYears(minYears);
    if (parsedMinYears === 'invalid') {
      Alert.alert('Invalid experience', 'Minimum experience must be a whole number of years.');
      return;
    }

    const parsedMin = parsePay(payMin);
    const parsedMax = parsePay(payMax);
    if (parsedMin === 'invalid' || parsedMax === 'invalid') {
      Alert.alert('Invalid pay', 'Enter pay as a number, e.g. 28 or 55000.');
      return;
    }
    const hasPay = parsedMin !== null || parsedMax !== null;
    if (hasPay && !payType) {
      Alert.alert('Pay type', 'Choose whether this pay is hourly or salary.');
      return;
    }
    if (parsedMin !== null && parsedMax !== null && parsedMin > parsedMax) {
      Alert.alert('Invalid pay', 'Minimum pay can\'t be higher than maximum pay.');
      return;
    }

    const checked = checkCloseAt(closeAt, serverNow());
    if (!checked.ok) {
      Alert.alert('Close date', CLOSE_ERRORS[checked.error]);
      return;
    }

    // Closing details only change when the date does, so re-saving other edits doesn't
    // undo a confirmation or reopen anything by accident.
    const existing = positions.find((p) => p.id === editingId);
    const sameDate =
      !!existing?.close_at && sameInstant(closeAtToDate(existing.close_at), closeAt);
    const closeFields = sameDate
      ? {}
      : {
          close_at: checked.iso,
          // A date chosen inside the reminder window was chosen on purpose; don't nag.
          close_confirmed_at:
            checked.iso && new Date(checked.iso).getTime() - serverNow() <= REMINDER_LEAD_MS
              ? new Date().toISOString()
              : null,
          // Picking a new date (or none) on a position that already closed reopens it.
          ...(existing?.closed_at ? { active: true, closed_at: null } : {}),
        };

    setSaving(true);

    const payload = {
      recruiter_id: session.user.id,
      title: title.trim(),
      company: company.trim(),
      // Structured pay replaces the old free-text range; keep the old text only
      // while no structured pay has been entered.
      urgency,
      pay_type: hasPay ? payType : null,
      pay_min: parsedMin,
      pay_max: parsedMax,
      pay_extras: payExtras,
      pay_range: hasPay ? null : legacyPay.trim() || null,
      location: location.trim() || null,
      schedule_types: scheduleTypes,
      schedule_type: null, // superseded by schedule_types
      epa_608_required: epaRequired || null,
      min_experience_years: parsedMinYears,
      description: description.trim() || null,
      skills,
      ...closeFields,
      ...(editingId ? {} : { active: true }),
    };

    const { error } = editingId
      ? await supabase.from('positions').update(payload).eq('id', editingId)
      : await supabase.from('positions').insert(payload);

    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setView('list');
    fetchPositions();
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete position', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('positions').delete().eq('id', id);
          if (error) Alert.alert('Error', error.message);
          else fetchPositions();
        },
      },
    ]);
  };

  if (view === 'form') {
    return (
      <SafeAreaView style={shared.authContainer}>
        <KeyboardAvoidingView
          style={shared.authInner}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
            <Pressable onPress={() => setView('list')} style={shared.chatBackButton}>
              <ArrowLeft size={22} color={c.text} strokeWidth={2.2} />
            </Pressable>

            <Text style={shared.logo}>bulletin.</Text>
            <Text style={shared.subtitle}>
              {editingId ? 'Edit position.' : 'Add a position.'}
            </Text>

            <TextInput
              style={shared.authInput}
              placeholder="Job title"
              placeholderTextColor={c.muted}
              value={title}
              onChangeText={setTitle}
            />

            <TextInput
              style={shared.authInput}
              placeholder="Company"
              placeholderTextColor={c.muted}
              value={company}
              onChangeText={setCompany}
            />

            <ChipSelect
              label="HOW URGENT IS THIS HIRE?"
              options={URGENCY_LEVELS.map((u) => URGENCY[u].label)}
              selected={[URGENCY[urgency].label]}
              onToggle={(o) => {
                const next = URGENCY_LEVELS.find((u) => URGENCY[u].label === o);
                if (next) setUrgency(next);
              }}
            />
            <Text style={shared.chipHint}>
              {URGENCY[urgency].blurb} You and candidates are each expected to reply within{' '}
              {URGENCY[urgency].windowLabel}. Timers only remind people; nothing is closed.
            </Text>

            <ChipSelect
              label="PAY TYPE"
              options={PAY_TYPES}
              selected={payType ? [payType] : []}
              onToggle={(o) => setPayType((prev) => (prev === o ? '' : o))}
            />

            <View style={local.payRow}>
              <View style={[shared.authInput, local.payField]}>
                <Text style={local.payDollar}>$</Text>
                <TextInput
                  style={local.payInput}
                  placeholder={payType === 'Salary' ? 'Min /yr' : 'Min /hr'}
                  placeholderTextColor={c.muted}
                  value={payMin}
                  onChangeText={setPayMin}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[shared.authInput, local.payField]}>
                <Text style={local.payDollar}>$</Text>
                <TextInput
                  style={local.payInput}
                  placeholder={payType === 'Salary' ? 'Max /yr' : 'Max /hr'}
                  placeholderTextColor={c.muted}
                  value={payMax}
                  onChangeText={setPayMax}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            {!!legacyPay && !payMin && !payMax && (
              <Text style={shared.chipHint}>Previously entered as: {legacyPay}</Text>
            )}

            <ChipSelect
              label="PAY EXTRAS (OPTIONAL)"
              options={PAY_EXTRAS}
              selected={payExtras}
              onToggle={(o) =>
                setPayExtras((prev) =>
                  prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]
                )
              }
            />

            <ChipSelect
              label="HIRE BY / CLOSE DATE (OPTIONAL)"
              options={CLOSE_PRESETS.map((p) => p.label)}
              selected={CLOSE_PRESETS.filter((p) =>
                sameInstant(presetCloseAt(p.days, serverNow()), closeAt)
              ).map((p) => p.label)}
              onToggle={(o) => {
                const preset = CLOSE_PRESETS.find((p) => p.label === o);
                if (preset) setCloseAt(presetCloseAt(preset.days, serverNow()));
              }}
            />
            <DateTimeField
              value={closeAt}
              onChange={setCloseAt}
              minimumDate={new Date(serverNow())}
              maximumDate={new Date(serverNow() + MAX_CLOSE_AHEAD_MS)}
              placeholder="Or pick a date and time"
            />
            <Text style={shared.chipHint}>
              When this passes, the position closes on its own: it leaves Discover and anyone
              still waiting on it gets their interest back. Chats stay open. You'll be reminded
              before it closes so you can extend or confirm.
            </Text>

            <TextInput
              style={shared.authInput}
              placeholder="Location"
              placeholderTextColor={c.muted}
              value={location}
              onChangeText={setLocation}
            />

            <ChipSelect
              label="SCHEDULE (SELECT ALL THAT APPLY)"
              options={SCHEDULE_TYPES}
              selected={scheduleTypes}
              onToggle={(o) =>
                setScheduleTypes((prev) =>
                  prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]
                )
              }
            />

            <ChipSelect
              label="EPA 608 REQUIRED (MINIMUM TYPE)"
              options={EPA_TYPES.map((t) => `Type ${t}`)}
              selected={epaRequired ? [`Type ${epaRequired}`] : []}
              onToggle={(o) => {
                const t = o.replace('Type ', '');
                setEpaRequired((prev) => (prev === t ? '' : t));
              }}
            />
            <Text style={shared.chipHint}>
              Universal-certified techs also qualify. Leave unselected if not required.
            </Text>

            <TextInput
              style={shared.authInput}
              placeholder="Minimum years of experience (e.g. 2)"
              placeholderTextColor={c.muted}
              value={minYears}
              onChangeText={setMinYears}
              keyboardType="number-pad"
              maxLength={2}
            />

            <View style={local.skillInputRow}>
              <TextInput
                style={[shared.authInput, local.skillInput]}
                placeholder="Add a skill or requirement"
                placeholderTextColor={c.muted}
                value={skillInput}
                onChangeText={setSkillInput}
                onSubmitEditing={addSkill}
                returnKeyType="done"
              />
              <Pressable style={local.skillAddButton} onPress={addSkill}>
                <Text style={local.skillAddButtonText}>Add</Text>
              </Pressable>
            </View>

            {skills.length > 0 && (
              <View style={shared.tags}>
                {skills.map((skill) => (
                  <Pressable
                    key={skill}
                    style={local.skillTag}
                    onPress={() => removeSkill(skill)}
                  >
                    <Text style={local.skillTagText}>{skill}</Text>
                    <X size={12} color={c.textStrong} strokeWidth={2.4} />
                  </Pressable>
                ))}
              </View>
            )}

            <TextInput
              style={[shared.authInput, shared.authTextArea]}
              placeholder="Description"
              placeholderTextColor={c.muted}
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <Pressable
              style={[shared.authButton, saving && shared.authButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={shared.authButtonText}>
                {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add position'}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={shared.simpleScreen}>
      <View style={shared.chatHeader}>
        <Pressable onPress={onBack} style={shared.chatBackButton}>
          <ArrowLeft size={22} color={c.text} strokeWidth={2.2} />
        </Pressable>
        <View style={shared.chatHeaderInfo}>
          <Text style={shared.chatHeaderName}>Your Positions</Text>
        </View>
      </View>

      {loading ? (
        <View style={shared.emptyState}>
          <Text style={shared.emptySubtitle}>Loading...</Text>
        </View>
      ) : positions.length === 0 ? (
        <RefreshableEmpty refreshControl={refreshControl}>
          <View style={shared.emptyState}>
            <BriefcaseBusiness size={48} color={c.muted} strokeWidth={1.5} />
            <Text style={shared.emptyTitle}>No positions yet</Text>
            <Text style={shared.emptySubtitle}>
              Add an open position for candidates to discover.
            </Text>
            <Pressable style={shared.refreshButton} onPress={openAddForm}>
              <Text style={shared.refreshText}>Add Position</Text>
            </Pressable>
          </View>
        </RefreshableEmpty>
      ) : (
        <FlatList
          data={positions}
          keyExtractor={(item) => item.id}
          refreshControl={refreshControl}
          contentContainerStyle={shared.interestsList}
          ListHeaderComponent={
            <Pressable
              style={[shared.refreshButton, { marginTop: 16, marginBottom: 12 }]}
              onPress={openAddForm}
            >
              <Text style={shared.refreshText}>Add Position</Text>
            </Pressable>
          }
          renderItem={({ item }) => (
            <Pressable style={shared.interestRow} onPress={() => openEditForm(item)}>
              <BriefcaseBusiness size={32} color={c.muted} strokeWidth={1.5} />
              <View style={shared.interestRowInfo}>
                <Text numberOfLines={1} style={shared.interestRowName}>
                  {item.title}
                </Text>
                <Text numberOfLines={1} style={shared.interestRowMeta}>
                  {item.company} · {URGENCY[urgencyOf(item)].label} (replies within{' '}
                  {URGENCY[urgencyOf(item)].windowLabel})
                </Text>
                {(() => {
                  const state = closeState(item, now);
                  const label = closeLabel(item, now);
                  const refresh = () => fetchPositions({ silent: true });
                  const closed = state.kind === 'closed';
                  return (
                    <>
                      {label ? (
                        <Text
                          numberOfLines={2}
                          style={[
                            local.closeLine,
                            state.kind === 'soon' && local.closeLineSoon,
                            closed && local.closeLineClosed,
                          ]}
                        >
                          {label}
                          {state.kind === 'confirmed' ? ' · confirmed' : ''}
                        </Text>
                      ) : null}
                      <View style={local.closeActions}>
                        {closed ? (
                          <Pressable
                            style={local.closeAction}
                            onPress={() => reopenPosition(item, now, refresh)}
                          >
                            <Text style={local.closeActionText}>Reopen</Text>
                          </Pressable>
                        ) : (
                          <>
                            {state.kind === 'soon' && (
                              <Pressable style={local.closeAction} onPress={() => promptExtend(item, refresh)}>
                                <Text style={local.closeActionText}>Extend</Text>
                              </Pressable>
                            )}
                            {state.kind === 'soon' && (
                              <Pressable
                                style={local.closeAction}
                                onPress={async () => {
                                  if (await confirmPositionClose(item)) refresh();
                                }}
                              >
                                <Text style={local.closeActionText}>Confirm closing</Text>
                              </Pressable>
                            )}
                            <Pressable
                              style={local.closeAction}
                              onPress={() => promptClose(item, refresh)}
                            >
                              <Text style={[local.closeActionText, { color: c.danger }]}>
                                Close position
                              </Text>
                            </Pressable>
                          </>
                        )}
                      </View>
                    </>
                  );
                })()}
              </View>
              <Pressable onPress={() => handleDelete(item.id)} style={{ padding: 6 }}>
                <X size={18} color={c.danger} strokeWidth={2.2} />
              </Pressable>
            </Pressable>
          )}
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
        closeLine: {
          marginTop: 4,
          fontSize: 12,
          color: c.textSecondary,
        },

        closeLineSoon: {
          color: c.amber,
          fontWeight: '700',
        },

        closeLineClosed: {
          color: c.danger,
          fontWeight: '700',
        },

        closeActions: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: 8,
        },

        closeAction: {
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.borderStrong,
        },

        closeActionText: {
          fontSize: 12,
          fontWeight: '700',
          color: c.text,
        },

        payRow: {
          flexDirection: 'row',
          gap: 10,
        },

        payField: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 0,
        },

        payDollar: {
          fontSize: 15,
          fontWeight: '600',
          color: c.textSecondary,
        },

        payInput: {
          flex: 1,
          paddingVertical: 14,
          fontSize: 15,
          color: c.text,
        },

        skillInputRow: {
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        },

        skillInput: {
          flex: 1,
          marginTop: 0,
        },

        skillAddButton: {
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderRadius: 14,
          backgroundColor: c.accent,
        },

        skillAddButtonText: {
          color: c.onAccent,
          fontWeight: '700',
          fontSize: 14,
        },

        skillTag: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 11,
          paddingVertical: 7,
          borderRadius: 20,
          backgroundColor: c.surfaceAlt,
        },

        skillTagText: {
          fontSize: 12,
          fontWeight: '600',
          color: c.textStrong,
        },
      }),
    [c]
  );
}
