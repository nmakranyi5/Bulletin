import { Session } from '@supabase/supabase-js';
import { ArrowLeft, BriefcaseBusiness, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
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
import { LocationField } from '../../components/location-field';
import { FormStep, StepForm } from '../../components/step-form';
import { useSharedStyles } from '../../styles/shared';
import { confirmPositionClose, promptClose, promptExtend, reopenPosition } from './position-close';
import { useT } from '../../../lib/i18n';

export function PositionsScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const t = useT();
  const local = useLocalStyles();
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [formStep, setFormStep] = useState(0);
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
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
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

    if (error) Alert.alert(t('common.error'), error.message);
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
    setLocationLat(null);
    setLocationLng(null);
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
    setFormStep(0);
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
    setLocationLat(typeof position.location_lat === 'number' ? position.location_lat : null);
    setLocationLng(typeof position.location_lng === 'number' ? position.location_lng : null);
    setScheduleTypes(getSchedules(position));
    setEpaRequired(position.epa_608_required ?? '');
    setMinYears(position.min_experience_years != null ? String(position.min_experience_years) : '');
    setDescription(position.description ?? '');
    setSkills(position.skills ?? []);
    setCloseAt(closeAtToDate(position.close_at));
    setEditingId(position.id);
    setFormStep(0);
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
    for (const step of STEPS) {
      const problem = stepProblem(step.key);
      if (problem) {
        Alert.alert(problem.title, problem.message);
        if (wizard) setFormStep(STEPS.indexOf(step));
        return;
      }
    }

    const parsedMinYears = parseMinYears(minYears) as number | null;
    const parsedMin = parsePay(payMin) as number | null;
    const parsedMax = parsePay(payMax) as number | null;
    const hasPay = parsedMin !== null || parsedMax !== null;

    const checked = checkCloseAt(closeAt, serverNow());
    if (!checked.ok) {
      Alert.alert(t('pos.closeDate'), CLOSE_ERRORS[checked.error]);
      return;
    }

    // Closing details only change when the date does, so re-saving other edits doesn't
    // undo a confirmation or reopen anything by accident.
    const existing = positions.find((p) => p.id === editingId);
    const sameDate = !!existing?.close_at && sameInstant(closeAtToDate(existing.close_at), closeAt);
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
      location_lat: location.trim() ? locationLat : null,
      location_lng: location.trim() ? locationLng : null,
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
      Alert.alert(t('common.error'), error.message);
      return;
    }

    setView('list');
    fetchPositions();
  };

  const handleDelete = (id: string) => {
    Alert.alert(t('pos.deleteTitle'), t('pos.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('positions').delete().eq('id', id);
          if (error) Alert.alert(t('common.error'), error.message);
          else fetchPositions();
        },
      },
    ]);
  };

  const STEPS: FormStep[] = [
    {
      key: 'basics',
      title: t('pos.basics.title'),
      subtitle: t('pos.basics.subtitle'),
    },
    { key: 'pay', title: t('pos.pay.title'), subtitle: t('pos.pay.subtitle') },
    { key: 'where', title: t('pos.where.title'), subtitle: t('pos.where.subtitle') },
    {
      key: 'requirements',
      title: t('pos.req.title'),
      subtitle: t('pos.req.subtitle'),
    },
    {
      key: 'details',
      title: t('pos.details.title'),
      subtitle: t('pos.details.subtitle'),
    },
    {
      key: 'timeline',
      title: t('pos.timeline.title'),
      subtitle: t('pos.timeline.subtitle'),
    },
  ];

  // Adding walks through one step at a time; editing shows everything together.
  const wizard = !editingId;

  const stepProblem = (key: string): { title: string; message: string } | null => {
    if (key === 'basics' && (!title.trim() || !company.trim())) {
      return { title: t('common.missingInfo'), message: t('pos.titleCompanyRequired') };
    }
    if (key === 'pay') {
      const min = parsePay(payMin);
      const max = parsePay(payMax);
      if (min === 'invalid' || max === 'invalid') {
        return { title: t('pos.invalidPay'), message: t('pos.payNumber') };
      }
      if ((min !== null || max !== null) && !payType) {
        return { title: t('pos.payType'), message: t('pos.payTypeBody') };
      }
      if (min !== null && max !== null && min > max) {
        return { title: t('pos.invalidPay'), message: t('pos.payMinMax') };
      }
    }
    if (key === 'requirements' && parseMinYears(minYears) === 'invalid') {
      return {
        title: t('pos.invalidExp'),
        message: t('pos.expBody'),
      };
    }
    if (key === 'timeline') {
      const checked = checkCloseAt(closeAt, serverNow());
      if (!checked.ok) return { title: t('pos.closeDate'), message: CLOSE_ERRORS[checked.error] };
    }
    return null;
  };

  const renderStep = (key: string) => {
    if (key === 'basics') {
      return (
        <>
          <TextInput
            style={shared.authInput}
            placeholder={t('pos.jobTitle')}
            placeholderTextColor={c.muted}
            value={title}
            onChangeText={setTitle}
          />

          <TextInput
            style={shared.authInput}
            placeholder={t('pos.company')}
            placeholderTextColor={c.muted}
            value={company}
            onChangeText={setCompany}
          />

          <ChipSelect
            label={t('pos.howUrgent')}
            options={URGENCY_LEVELS.map((u) => URGENCY[u].label)}
            selected={[URGENCY[urgency].label]}
            onToggle={(o) => {
              const next = URGENCY_LEVELS.find((u) => URGENCY[u].label === o);
              if (next) setUrgency(next);
            }}
          />
          <Text style={shared.chipHint}>
            {t('pos.urgencyHint', {
              blurb: URGENCY[urgency].blurb,
              window: URGENCY[urgency].windowLabel,
            })}
          </Text>
        </>
      );
    }
    if (key === 'pay') {
      return (
        <>
          <ChipSelect
            label={t('pos.payTypeLabel')}
            options={PAY_TYPES}
            selected={payType ? [payType] : []}
            onToggle={(o) => setPayType((prev) => (prev === o ? '' : o))}
          />

          <View style={local.payRow}>
            <View style={[shared.authInput, local.payField]}>
              <Text style={local.payDollar}>$</Text>
              <TextInput
                style={local.payInput}
                placeholder={payType === 'Salary' ? t('pos.minYr') : t('pos.minHr')}
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
                placeholder={payType === 'Salary' ? t('pos.maxYr') : t('pos.maxHr')}
                placeholderTextColor={c.muted}
                value={payMax}
                onChangeText={setPayMax}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          {!!legacyPay && !payMin && !payMax && (
            <Text style={shared.chipHint}>{t('pos.previously', { text: legacyPay })}</Text>
          )}

          <ChipSelect
            label={t('pos.payExtras')}
            options={PAY_EXTRAS}
            selected={payExtras}
            onToggle={(o) =>
              setPayExtras((prev) =>
                prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]
              )
            }
          />
        </>
      );
    }
    if (key === 'where') {
      return (
        <>
          <LocationField
            placeholder={t('pos.location')}
            value={{ text: location, lat: locationLat, lng: locationLng }}
            onChange={(p) => {
              setLocation(p.text);
              setLocationLat(p.lat);
              setLocationLng(p.lng);
            }}
          />

          <ChipSelect
            label={t('pos.schedule')}
            options={SCHEDULE_TYPES}
            selected={scheduleTypes}
            onToggle={(o) =>
              setScheduleTypes((prev) =>
                prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]
              )
            }
          />
        </>
      );
    }
    if (key === 'requirements') {
      return (
        <>
          <ChipSelect
            label={t('pos.epaRequired')}
            options={EPA_TYPES.map((ty) => `Type ${ty}`)}
            selected={epaRequired ? [`Type ${epaRequired}`] : []}
            onToggle={(o) => {
              const ty = o.replace('Type ', '');
              setEpaRequired((prev) => (prev === ty ? '' : ty));
            }}
          />
          <Text style={shared.chipHint}>
            {t('pos.epaHint')}
          </Text>

          <TextInput
            style={shared.authInput}
            placeholder={t('pos.minYears')}
            placeholderTextColor={c.muted}
            value={minYears}
            onChangeText={setMinYears}
            keyboardType="number-pad"
            maxLength={2}
          />

          <View style={local.skillInputRow}>
            <TextInput
              style={[shared.authInput, local.skillInput]}
              placeholder={t('pos.addSkill')}
              placeholderTextColor={c.muted}
              value={skillInput}
              onChangeText={setSkillInput}
              onSubmitEditing={addSkill}
              returnKeyType="done"
            />
            <Pressable style={local.skillAddButton} onPress={addSkill}>
              <Text style={local.skillAddButtonText}>{t('pos.add')}</Text>
            </Pressable>
          </View>

          {skills.length > 0 && (
            <View style={shared.tags}>
              {skills.map((skill) => (
                <Pressable key={skill} style={local.skillTag} onPress={() => removeSkill(skill)}>
                  <Text style={local.skillTagText}>{skill}</Text>
                  <X size={12} color={c.textStrong} strokeWidth={2.4} />
                </Pressable>
              ))}
            </View>
          )}
        </>
      );
    }
    if (key === 'details') {
      return (
        <TextInput
          style={[shared.authInput, shared.authTextArea]}
          placeholder={t('pos.description')}
          placeholderTextColor={c.muted}
          value={description}
          onChangeText={setDescription}
          multiline
        />
      );
    }
    return (
      <>
        <ChipSelect
          label={t('pos.hireBy')}
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
          placeholder={t('pos.pickDate')}
        />
        <Text style={shared.chipHint}>
          {t('pos.closeHint')}
        </Text>
      </>
    );
  };

  if (view === 'form') {
    return (
      <StepForm
        steps={STEPS}
        stepIndex={formStep}
        onStepChange={setFormStep}
        wizard={wizard}
        renderStep={renderStep}
        stepProblem={stepProblem}
        onSubmit={handleSave}
        submitting={saving}
        submitLabel={t('pos.addPosition')}
        saveLabel={t('onb.saveChanges')}
        editingSubtitle={t('pos.editPosition')}
        exit={
          wizard
            ? { kind: 'close', label: t('common.cancel'), onPress: () => setView('list') }
            : { kind: 'back', label: t('onb.goBack'), onPress: () => setView('list') }
        }
      />
    );
  }

  return (
    <SafeAreaView style={shared.simpleScreen}>
      <View style={shared.chatHeader}>
        <Pressable onPress={onBack} style={shared.chatBackButton}>
          <ArrowLeft size={22} color={c.text} strokeWidth={2.2} />
        </Pressable>
        <View style={shared.chatHeaderInfo}>
          <Text style={shared.chatHeaderName}>{t('pos.yourPositions')}</Text>
        </View>
      </View>

      {loading ? (
        <View style={shared.emptyState}>
          <Text style={shared.emptySubtitle}>{t('common.loading')}</Text>
        </View>
      ) : positions.length === 0 ? (
        <RefreshableEmpty refreshControl={refreshControl}>
          <View style={shared.emptyState}>
            <BriefcaseBusiness size={48} color={c.muted} strokeWidth={1.5} />
            <Text style={shared.emptyTitle}>{t('pos.none')}</Text>
            <Text style={shared.emptySubtitle}>
              {t('pos.noneHint')}
            </Text>
            <Pressable style={shared.refreshButton} onPress={openAddForm}>
              <Text style={shared.refreshText}>{t('pos.addButton')}</Text>
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
              <Text style={shared.refreshText}>{t('pos.addButton')}</Text>
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
                  {t('pos.meta', {
                    company: item.company,
                    urgency: URGENCY[urgencyOf(item)].label,
                    window: URGENCY[urgencyOf(item)].windowLabel,
                  })}
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
                          {state.kind === 'confirmed' ? t('pos.confirmed') : ''}
                        </Text>
                      ) : null}
                      <View style={local.closeActions}>
                        {closed ? (
                          <Pressable
                            style={local.closeAction}
                            onPress={() => reopenPosition(item, now, refresh)}
                          >
                            <Text style={local.closeActionText}>{t('pos.reopen')}</Text>
                          </Pressable>
                        ) : (
                          <>
                            {state.kind === 'soon' && (
                              <Pressable
                                style={local.closeAction}
                                onPress={() => promptExtend(item, refresh)}
                              >
                                <Text style={local.closeActionText}>{t('pos.extend')}</Text>
                              </Pressable>
                            )}
                            {state.kind === 'soon' && (
                              <Pressable
                                style={local.closeAction}
                                onPress={async () => {
                                  if (await confirmPositionClose(item)) refresh();
                                }}
                              >
                                <Text style={local.closeActionText}>{t('pos.confirmClosing')}</Text>
                              </Pressable>
                            )}
                            <Pressable
                              style={local.closeAction}
                              onPress={() => promptClose(item, refresh)}
                            >
                              <Text style={[local.closeActionText, { color: c.danger }]}>
                                {t('pos.closePosition')}
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
          // Lets the field shrink on narrow web screens (inputs have a minimum width there).
          minWidth: 0,
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
